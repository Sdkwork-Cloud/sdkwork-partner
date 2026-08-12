//! Partner wallet port backed by the sdkwork-account ledger (S4).
//!
//! Partner commission balances live in `acct_account` with
//! `owner_type=PARTNER`, `account_purpose=SETTLEMENT`, asset `cash` and the
//! configured commission currency. All balance writes go through
//! `PostgresCommerceAccountStore` — the account ledger (`acct_*`) is the only
//! writer of balances. Idempotency keys tie each ledger mutation to the
//! partner-domain record (payment/settlement/withdrawal id), so a crash
//! between the account commit and the partner row commit replays safely.

use std::future::Future;
use std::pin::Pin;

use sdkwork_account_repository_sqlx::PostgresCommerceAccountStore;
use sdkwork_account_service::{
    AppendLedgerEntryCommand, CreateAccountHoldCommand, ReleaseAccountHoldCommand,
    SettleAccountHoldCommand, WalletAccountListQuery,
};
use sdkwork_contract_service::{
    CommerceAccountAssetType, CommerceLedgerDirection, CommerceMoney, CommerceRequestHash,
    CommerceServiceError,
};
use sdkwork_utils_rust::sha256_hash;
use sqlx::{PgPool, Row};

pub const PARTNER_OWNER_TYPE: &str = "PARTNER";
pub const PARTNER_SETTLEMENT_PURPOSE: &str = "SETTLEMENT";
pub const PARTNER_WALLET_ASSET: CommerceAccountAssetType = CommerceAccountAssetType::Cash;

pub type PartnerWalletFuture<'a, T> =
    Pin<Box<dyn Future<Output = Result<T, CommerceServiceError>> + Send + 'a>>;

/// Partner wallet operations over the account-domain ledger.
pub trait PartnerWalletPort: Send + Sync {
    /// Credits commission earnings (join fee / usage / recharge commission or
    /// a manual adjustment IN). Returns the account ledger entry id.
    #[allow(clippy::too_many_arguments)]
    fn credit_commission<'a>(
        &'a self,
        tenant_id: i64,
        organization_id: i64,
        partner_id: i64,
        currency: &'a str,
        amount_cents: i64,
        business_type: &'a str,
        source_type: &'a str,
        source_id: i64,
        remark: &'a str,
        idempotency_key: &'a str,
    ) -> PartnerWalletFuture<'a, i64>;

    /// Debits a manual adjustment OUT. Returns the account ledger entry id.
    #[allow(clippy::too_many_arguments)]
    fn debit_commission<'a>(
        &'a self,
        tenant_id: i64,
        organization_id: i64,
        partner_id: i64,
        currency: &'a str,
        amount_cents: i64,
        source_type: &'a str,
        source_id: i64,
        remark: &'a str,
        idempotency_key: &'a str,
    ) -> PartnerWalletFuture<'a, i64>;

    /// Freezes commission for a withdrawal application. Returns the account
    /// hold id.
    #[allow(clippy::too_many_arguments)]
    fn create_withdrawal_hold<'a>(
        &'a self,
        tenant_id: i64,
        organization_id: i64,
        partner_id: i64,
        currency: &'a str,
        amount_cents: i64,
        business_no: &'a str,
        withdrawal_id: i64,
        idempotency_key: &'a str,
    ) -> PartnerWalletFuture<'a, i64>;

    /// Releases a rejected withdrawal hold (funds return to available).
    fn release_withdrawal_hold<'a>(
        &'a self,
        tenant_id: i64,
        hold_id: i64,
        idempotency_key: &'a str,
    ) -> PartnerWalletFuture<'a, ()>;

    /// Settles a paid withdrawal hold (funds leave the wallet).
    fn settle_withdrawal_hold<'a>(
        &'a self,
        tenant_id: i64,
        hold_id: i64,
        business_type: &'a str,
        transaction_no: &'a str,
        idempotency_key: &'a str,
    ) -> PartnerWalletFuture<'a, ()>;

    /// Current available balance in cents.
    fn available_balance_cents<'a>(
        &'a self,
        tenant_id: i64,
        organization_id: i64,
        partner_id: i64,
        currency: &'a str,
    ) -> PartnerWalletFuture<'a, i64>;

    /// Total earned (credits minus settled withdrawals) in cents.
    fn total_earned_cents<'a>(
        &'a self,
        tenant_id: i64,
        organization_id: i64,
        partner_id: i64,
        currency: &'a str,
    ) -> PartnerWalletFuture<'a, i64>;
}

/// `PostgresCommerceAccountStore` adapter for partner wallet operations.
#[derive(Clone)]
pub struct PartnerAccountWalletAdapter {
    pool: PgPool,
    store: PostgresCommerceAccountStore,
}

impl PartnerAccountWalletAdapter {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool: pool.clone(),
            store: PostgresCommerceAccountStore::new(pool),
        }
    }
}

/// Holds are addressed by uuid in the account store; the partner domain stores
/// the internal numeric id (`partner_withdrawal.hold_id`), so resolve it back.
async fn hold_uuid_for_internal_id(
    pool: &PgPool,
    tenant_id: i64,
    hold_id: i64,
) -> Result<String, CommerceServiceError> {
    let row = sqlx::query("SELECT uuid FROM acct_hold WHERE tenant_id = $1 AND id = $2")
        .bind(tenant_id)
        .bind(hold_id)
        .fetch_optional(pool)
        .await
        .map_err(|error| {
            CommerceServiceError::storage(format!("failed to load account hold: {error}"))
        })?
        .ok_or_else(|| CommerceServiceError::not_found("account hold was not found"))?;
    Ok(row.get("uuid"))
}

impl PartnerWalletPort for PartnerAccountWalletAdapter {
    fn credit_commission<'a>(
        &'a self,
        tenant_id: i64,
        organization_id: i64,
        partner_id: i64,
        currency: &'a str,
        amount_cents: i64,
        business_type: &'a str,
        source_type: &'a str,
        source_id: i64,
        remark: &'a str,
        idempotency_key: &'a str,
    ) -> PartnerWalletFuture<'a, i64> {
        Box::pin(async move {
            let append = AppendLedgerEntryCommand {
                tenant_id: tenant_id.to_string(),
                organization_id: Some(organization_id.to_string()),
                owner_user_id: partner_id.to_string(),
                account_id: String::new(),
                asset_type: PARTNER_WALLET_ASSET,
                currency_code: Some(currency.to_owned()),
                direction: CommerceLedgerDirection::Credit,
                amount: CommerceMoney::new(&amount_cents.to_string())
                    .map_err(CommerceServiceError::validation)?,
                business_type: business_type.to_owned(),
                transaction_no: idempotency_key.to_owned(),
                request_no: idempotency_key.to_owned(),
                idempotency_key: idempotency_key.to_owned(),
                owner_type: Some(PARTNER_OWNER_TYPE.to_owned()),
                account_purpose: Some(PARTNER_SETTLEMENT_PURPOSE.to_owned()),
                expires_at: None,
                reversed_ledger_id: None,
            };
            let ledger = self
                .store
                .append_ledger_entry(append, partner_request_hash(idempotency_key))
                .await?
                .ledger_entry;
            tracing::debug!(
                tenant_id,
                partner_id,
                amount_cents,
                business_type,
                source_type,
                source_id,
                remark,
                "partner commission credited through the account ledger"
            );
            Ok(ledger.id.parse::<i64>().unwrap_or(0))
        })
    }

    fn debit_commission<'a>(
        &'a self,
        tenant_id: i64,
        organization_id: i64,
        partner_id: i64,
        currency: &'a str,
        amount_cents: i64,
        source_type: &'a str,
        source_id: i64,
        remark: &'a str,
        idempotency_key: &'a str,
    ) -> PartnerWalletFuture<'a, i64> {
        Box::pin(async move {
            let append = AppendLedgerEntryCommand {
                tenant_id: tenant_id.to_string(),
                organization_id: Some(organization_id.to_string()),
                owner_user_id: partner_id.to_string(),
                account_id: String::new(),
                asset_type: PARTNER_WALLET_ASSET,
                currency_code: Some(currency.to_owned()),
                direction: CommerceLedgerDirection::Debit,
                amount: CommerceMoney::new(&amount_cents.to_string())
                    .map_err(CommerceServiceError::validation)?,
                business_type: "commission_adjustment".to_owned(),
                transaction_no: idempotency_key.to_owned(),
                request_no: idempotency_key.to_owned(),
                idempotency_key: idempotency_key.to_owned(),
                owner_type: Some(PARTNER_OWNER_TYPE.to_owned()),
                account_purpose: Some(PARTNER_SETTLEMENT_PURPOSE.to_owned()),
                expires_at: None,
                reversed_ledger_id: None,
            };
            let ledger = self
                .store
                .append_ledger_entry(append, partner_request_hash(idempotency_key))
                .await?
                .ledger_entry;
            tracing::debug!(
                tenant_id,
                partner_id,
                amount_cents,
                source_type,
                source_id,
                remark,
                "partner commission debited through the account ledger"
            );
            Ok(ledger.id.parse::<i64>().unwrap_or(0))
        })
    }

    fn create_withdrawal_hold<'a>(
        &'a self,
        tenant_id: i64,
        organization_id: i64,
        partner_id: i64,
        _currency: &'a str,
        amount_cents: i64,
        business_no: &'a str,
        withdrawal_id: i64,
        idempotency_key: &'a str,
    ) -> PartnerWalletFuture<'a, i64> {
        Box::pin(async move {
            let command = CreateAccountHoldCommand {
                tenant_id: tenant_id.to_string(),
                organization_id: Some(organization_id.to_string()),
                owner_user_id: partner_id.to_string(),
                account_id: String::new(),
                asset_type: PARTNER_WALLET_ASSET,
                amount: CommerceMoney::new(&amount_cents.to_string())
                    .map_err(CommerceServiceError::validation)?,
                business_type: "commission_withdraw_hold".to_owned(),
                business_no: business_no.to_owned(),
                source_type: "PARTNER_WITHDRAWAL".to_owned(),
                source_id: withdrawal_id.to_string(),
                request_no: idempotency_key.to_owned(),
                idempotency_key: idempotency_key.to_owned(),
                expires_at: None,
                owner_type: Some(PARTNER_OWNER_TYPE.to_owned()),
                account_purpose: Some(PARTNER_SETTLEMENT_PURPOSE.to_owned()),
            };
            let outcome = self
                .store
                .create_account_hold(command, partner_request_hash(idempotency_key))
                .await?;
            Ok(outcome.hold.id.parse::<i64>().unwrap_or(0))
        })
    }

    fn release_withdrawal_hold<'a>(
        &'a self,
        tenant_id: i64,
        hold_id: i64,
        idempotency_key: &'a str,
    ) -> PartnerWalletFuture<'a, ()> {
        Box::pin(async move {
            let hold_uuid = hold_uuid_for_internal_id(&self.pool, tenant_id, hold_id).await?;
            let command = ReleaseAccountHoldCommand {
                tenant_id: tenant_id.to_string(),
                hold_id: hold_uuid,
                request_no: idempotency_key.to_owned(),
                idempotency_key: idempotency_key.to_owned(),
            };
            self.store
                .release_account_hold(command, partner_request_hash(idempotency_key))
                .await?;
            Ok(())
        })
    }

    fn settle_withdrawal_hold<'a>(
        &'a self,
        tenant_id: i64,
        hold_id: i64,
        business_type: &'a str,
        transaction_no: &'a str,
        idempotency_key: &'a str,
    ) -> PartnerWalletFuture<'a, ()> {
        Box::pin(async move {
            let hold_uuid = hold_uuid_for_internal_id(&self.pool, tenant_id, hold_id).await?;
            let command = SettleAccountHoldCommand {
                tenant_id: tenant_id.to_string(),
                hold_id: hold_uuid,
                business_type: business_type.to_owned(),
                transaction_no: transaction_no.to_owned(),
                request_no: idempotency_key.to_owned(),
                idempotency_key: idempotency_key.to_owned(),
            };
            self.store
                .settle_account_hold(command, partner_request_hash(idempotency_key))
                .await?;
            Ok(())
        })
    }

    fn available_balance_cents<'a>(
        &'a self,
        tenant_id: i64,
        organization_id: i64,
        partner_id: i64,
        _currency: &'a str,
    ) -> PartnerWalletFuture<'a, i64> {
        Box::pin(async move {
            let mut query = WalletAccountListQuery::new(
                &tenant_id.to_string(),
                Some(&organization_id.to_string()),
                &partner_id.to_string(),
                Some(PARTNER_WALLET_ASSET),
            )?;
            query.owner_type = Some(PARTNER_OWNER_TYPE.to_owned());
            match self
                .store
                .retrieve_wallet_account_for_asset(query, PARTNER_WALLET_ASSET)
                .await
            {
                Ok(account) => Ok(parse_account_cents(account.available_amount.as_str())),
                Err(error) if error.code() == "not-found" => Ok(0),
                Err(error) => Err(error),
            }
        })
    }

    fn total_earned_cents<'a>(
        &'a self,
        tenant_id: i64,
        organization_id: i64,
        partner_id: i64,
        _currency: &'a str,
    ) -> PartnerWalletFuture<'a, i64> {
        Box::pin(async move {
            let mut query = WalletAccountListQuery::new(
                &tenant_id.to_string(),
                Some(&organization_id.to_string()),
                &partner_id.to_string(),
                Some(PARTNER_WALLET_ASSET),
            )?;
            query.owner_type = Some(PARTNER_OWNER_TYPE.to_owned());
            match self
                .store
                .retrieve_wallet_account_for_asset(query, PARTNER_WALLET_ASSET)
                .await
            {
                Ok(account) => {
                    let available = parse_account_cents(account.available_amount.as_str());
                    let frozen = parse_account_cents(account.frozen_amount.as_str());
                    Ok(available + frozen)
                }
                Err(error) if error.code() == "not-found" => Ok(0),
                Err(error) => Err(error),
            }
        })
    }
}

fn partner_request_hash(idempotency_key: &str) -> CommerceRequestHash {
    let digest = sha256_hash(format!("partner-wallet:{idempotency_key}").as_bytes());
    CommerceRequestHash::new(&digest).expect("partner wallet request hash is never empty")
}

fn parse_account_cents(value: &str) -> i64 {
    value.trim().parse::<i64>().unwrap_or(0)
}
