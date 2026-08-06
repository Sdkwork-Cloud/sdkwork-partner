//! Partner domain drafts, money/ratio value helpers, and the commission engine.

pub mod commission_engine;

use sdkwork_contract_service::CommerceServiceError;

/// Parse a decimal money string ("1234.56") into integer minor units (cents).
pub fn parse_money_to_cents(field: &str, value: &str) -> Result<i64, CommerceServiceError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(CommerceServiceError::validation(format!(
            "{field} must not be empty"
        )));
    }
    let negative = trimmed.starts_with('-');
    let digits: String = trimmed
        .chars()
        .filter(|ch| ch.is_ascii_digit() || *ch == '.')
        .collect();
    let mut parts = digits.split('.');
    let whole = parts.next().unwrap_or("");
    let frac = parts.next().unwrap_or("");
    if parts.next().is_some()
        || whole.is_empty()
        || frac.len() > 2
        || !whole.chars().all(|c| c.is_ascii_digit())
        || !frac.chars().all(|c| c.is_ascii_digit())
    {
        return Err(CommerceServiceError::validation(format!(
            "{field} must be a decimal amount with at most 2 fraction digits"
        )));
    }
    let whole_value: i64 = whole
        .parse()
        .map_err(|_| CommerceServiceError::validation(format!("{field} is out of range")))?;
    let frac_value: i64 = if frac.is_empty() {
        0
    } else {
        format!("{frac:0<2}")
            .parse()
            .map_err(|_| CommerceServiceError::validation(format!("{field} is out of range")))?
    };
    let cents = whole_value
        .checked_mul(100)
        .and_then(|v| v.checked_add(frac_value))
        .ok_or_else(|| CommerceServiceError::validation(format!("{field} is out of range")))?;
    Ok(if negative { -cents } else { cents })
}

/// Format integer minor units (cents) as a decimal money string.
pub fn cents_to_decimal(cents: i64) -> String {
    let negative = cents < 0;
    let absolute = cents.unsigned_abs();
    let whole = absolute / 100;
    let frac = absolute % 100;
    format!("{}{}.{:02}", if negative { "-" } else { "" }, whole, frac)
}

/// Parse a percentage string ("20.00") into a per-10000 integer (2000).
pub fn parse_ratio_per_10000(field: &str, value: &str) -> Result<i64, CommerceServiceError> {
    let cents = parse_money_to_cents(field, value)?;
    if cents < 0 {
        return Err(CommerceServiceError::validation(format!(
            "{field} must not be negative"
        )));
    }
    // percent with 2 decimals -> per-10000: 20.00% -> 2000
    Ok(cents)
}

/// Format a per-10000 integer as a percentage string ("20.00").
pub fn ratio_per_10000_to_decimal(per_10000: i64) -> String {
    cents_to_decimal(per_10000)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_money_to_cents() {
        assert_eq!(parse_money_to_cents("amount", "1234.56").unwrap(), 123456);
        assert_eq!(parse_money_to_cents("amount", "100").unwrap(), 10000);
        assert_eq!(parse_money_to_cents("amount", "0.01").unwrap(), 1);
        assert_eq!(parse_money_to_cents("amount", "-5.00").unwrap(), -500);
        assert!(parse_money_to_cents("amount", "1.234").is_err());
        assert!(parse_money_to_cents("amount", "abc").is_err());
        assert!(parse_money_to_cents("amount", "").is_err());
    }

    #[test]
    fn formats_cents_to_decimal() {
        assert_eq!(cents_to_decimal(123456), "1234.56");
        assert_eq!(cents_to_decimal(1), "0.01");
        assert_eq!(cents_to_decimal(0), "0.00");
        assert_eq!(cents_to_decimal(-500), "-5.00");
    }

    #[test]
    fn parses_ratios() {
        assert_eq!(parse_ratio_per_10000("ratio", "20.00").unwrap(), 2000);
        assert_eq!(parse_ratio_per_10000("ratio", "100").unwrap(), 10000);
        assert_eq!(parse_ratio_per_10000("ratio", "0.5").unwrap(), 50);
        assert!(parse_ratio_per_10000("ratio", "-1").is_err());
    }
}
