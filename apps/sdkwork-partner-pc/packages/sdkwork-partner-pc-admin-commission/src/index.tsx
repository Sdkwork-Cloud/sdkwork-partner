import { useCallback, useEffect, useState } from 'react';
import { getPartnerBackendClient } from '@sdkwork/partner-pc-admin-core';
import type {
  CommissionConfigItem,
  CommissionEventItem,
  LedgerEntryItem,
  PartnerLevelItem,
  SettlementRunResult,
} from '@sdkwork/partner-backend-sdk';

type CommissionAdminTab = 'levels' | 'config' | 'events' | 'ledger';

const DEFAULT_TAB: CommissionAdminTab = 'levels';

function resolveTab(sectionId: string | undefined): CommissionAdminTab {
  if (sectionId === 'config') return 'config';
  if (sectionId === 'events') return 'events';
  if (sectionId === 'ledger') return 'ledger';
  return 'levels';
}

export function CommissionAdmin({ sectionId }: { sectionId?: string } = {}) {
  const tab = resolveTab(sectionId);
  switch (tab) {
    case 'config':
      return <ConfigPage />;
    case 'events':
      return <EventsPage />;
    case 'ledger':
      return <LedgerPage />;
    default:
      return <LevelsPage />;
  }
}

function LevelsPage() {
  const [levels, setLevels] = useState<PartnerLevelItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [levelNo, setLevelNo] = useState(1);
  const [name, setName] = useState('');
  const [revenueRatio, setRevenueRatio] = useState('20.00');
  const [joinFeeRatio, setJoinFeeRatio] = useState('10.00');
  const [joinFee, setJoinFee] = useState('10000.00');

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await getPartnerBackendClient().partners.levels.list();
      setLevels(result.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createLevel() {
    setError(null);
    try {
      await getPartnerBackendClient().partners.levels.create({
        levelNo,
        name,
        customerRevenueRatio: revenueRatio,
        joinFeeCommissionRatio: joinFeeRatio,
        joinFee,
      });
      setShowCreate(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function toggleLevel(level: PartnerLevelItem) {
    setError(null);
    try {
      const nextStatus = level.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
      await getPartnerBackendClient().partners.levels.update(String(level.id), {
        name: level.name,
        customerRevenueRatio: level.customerRevenueRatio,
        joinFeeCommissionRatio: level.joinFeeCommissionRatio,
        joinFee: level.joinFee,
        status: nextStatus,
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <section style={{ padding: 24 }}>
      <h2>等级与返佣比例配置</h2>
      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => setShowCreate((value) => !value)}>新建等级</button>
      </div>
      {showCreate ? (
        <div style={{ border: '1px solid #d1d5db', padding: 12, marginBottom: 12 }}>
          <h3>新建等级</h3>
          <label>
            等级号 <input type="number" min={1} value={levelNo} onChange={(e) => setLevelNo(Number(e.target.value))} />
          </label>{' '}
          <label>
            名称 <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>{' '}
          <label>
            客户收益比例(%) <input value={revenueRatio} onChange={(e) => setRevenueRatio(e.target.value)} />
          </label>{' '}
          <label>
            加盟费提成比例(%) <input value={joinFeeRatio} onChange={(e) => setJoinFeeRatio(e.target.value)} />
          </label>{' '}
          <label>
            加盟费(元) <input value={joinFee} onChange={(e) => setJoinFee(e.target.value)} />
          </label>{' '}
          <button onClick={() => void createLevel()}>创建</button>
        </div>
      ) : null}
      <table border={1} cellPadding={6} style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>等级</th>
            <th>名称</th>
            <th>客户收益比例</th>
            <th>加盟费提成比例</th>
            <th>加盟费</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {levels.map((level) => (
            <tr key={level.id}>
              <td>{level.id}</td>
              <td>{level.levelNo}</td>
              <td>{level.name}</td>
              <td>{level.customerRevenueRatio}%</td>
              <td>{level.joinFeeCommissionRatio}%</td>
              <td>{level.joinFee}</td>
              <td>{level.status}</td>
              <td>
                <button onClick={() => void toggleLevel(level)}>
                  {level.status === 'ACTIVE' ? '停用' : '启用'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ConfigPage() {
  const [config, setConfig] = useState<CommissionConfigItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setConfig(await getPartnerBackendClient().partners.commissionConfig.retrieve());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!config) return;
    setError(null);
    try {
      await getPartnerBackendClient().partners.commissionConfig.update({
        enabled: config.enabled,
        usageSettlementEnabled: config.usageSettlementEnabled,
        rechargeEnabled: config.rechargeEnabled,
        maxCommissionDepth: config.maxCommissionDepth,
        currency: config.currency,
        minWithdrawalAmount: config.minWithdrawalAmount,
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <section style={{ padding: 24 }}>
      <h2>全局提成配置</h2>
      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
      {config ? (
        <div style={{ border: '1px solid #d1d5db', padding: 12 }}>
          <label>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            />{' '}
            启用提成结算
          </label>{' '}
          <label>
            <input
              type="checkbox"
              checked={config.usageSettlementEnabled}
              onChange={(e) => setConfig({ ...config, usageSettlementEnabled: e.target.checked })}
            />{' '}
            使用量结算收益
          </label>{' '}
          <label>
            <input
              type="checkbox"
              checked={config.rechargeEnabled}
              onChange={(e) => setConfig({ ...config, rechargeEnabled: e.target.checked })}
            />{' '}
            充值收益
          </label>{' '}
          <label>
            最大提成层级(0=不限){' '}
            <input
              type="number"
              min={0}
              value={config.maxCommissionDepth}
              onChange={(e) => setConfig({ ...config, maxCommissionDepth: e.target.value })}
            />
          </label>{' '}
          <label>
            最低提现金额(元){' '}
            <input
              value={config.minWithdrawalAmount}
              onChange={(e) => setConfig({ ...config, minWithdrawalAmount: e.target.value })}
            />
          </label>{' '}
          <button onClick={() => void save()}>保存</button>
        </div>
      ) : (
        <p>加载中…</p>
      )}
    </section>
  );
}

function EventsPage() {
  const [events, setEvents] = useState<CommissionEventItem[]>([]);
  const [total, setTotal] = useState('0');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<SettlementRunResult | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [sourceRef, setSourceRef] = useState('');
  const [customerUserId, setCustomerUserId] = useState('');
  const [baseAmount, setBaseAmount] = useState('');

  const load = useCallback(async (targetPage: number) => {
    setError(null);
    try {
      const result = await getPartnerBackendClient().partners.commissionEvents.list({
        page: targetPage,
        pageSize: 20,
      });
      setEvents(result.items);
      setTotal(result.pageInfo.totalItems);
      setPage(targetPage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  async function runSettlement() {
    setError(null);
    try {
      const result = await getPartnerBackendClient().partners.settlements.run({ limit: "100" });
      setRunResult(result);
      await load(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function createManualEvent() {
    setError(null);
    try {
      await getPartnerBackendClient().partners.commissionEvents.create({
        sourceRef,
        customerUserId,
        baseAmount,
      });
      setShowManual(false);
      setSourceRef('');
      setCustomerUserId('');
      setBaseAmount('');
      await load(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <section style={{ padding: 24 }}>
      <h2>收益事件与结算</h2>
      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => void runSettlement()}>运行结算</button>{' '}
        <button onClick={() => setShowManual((value) => !value)}>手工登记收益事件</button>
      </div>
      {runResult ? (
        <p>
          结算完成：处理 {runResult.processed}，成功 {runResult.settled}，跳过 {runResult.skipped}，
          失败 {runResult.failed}
        </p>
      ) : null}
      {showManual ? (
        <div style={{ border: '1px solid #d1d5db', padding: 12, marginBottom: 12 }}>
          <h3>手工登记收益事件</h3>
          <label>
            来源引用 <input value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} />
          </label>{' '}
          <label>
            客户用户ID <input value={customerUserId} onChange={(e) => setCustomerUserId(e.target.value)} />
          </label>{' '}
          <label>
            收益基数(元) <input value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)} />
          </label>{' '}
          <button onClick={() => void createManualEvent()}>登记</button>
        </div>
      ) : null}
      <table border={1} cellPadding={6} style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>来源</th>
            <th>客户</th>
            <th>基数</th>
            <th>事件时间</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>{event.id}</td>
              <td>
                {event.sourceType}:{event.sourceRef}
              </td>
              <td>{event.customerUserId}</td>
              <td>{event.baseAmount}</td>
              <td>{event.eventAt}</td>
              <td>{event.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 12 }}>
        第 {page} 页（共 {Number(total)} 条）{' '}
        <button disabled={page <= 1} onClick={() => void load(page - 1)}>
          上一页
        </button>{' '}
        <button disabled={page * 20 >= Number(total)} onClick={() => void load(page + 1)}>
          下一页
        </button>
      </div>
    </section>
  );
}

function LedgerPage() {
  const [partnerId, setPartnerId] = useState('');
  const [entries, setEntries] = useState<LedgerEntryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const result = await getPartnerBackendClient().partners.ledgerEntries.list(partnerId, {
        page: 1,
        pageSize: 50,
      });
      setEntries(result.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <section style={{ padding: 24 }}>
      <h2>收益流水</h2>
      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
      <label>
        合作伙伴ID <input value={partnerId} onChange={(e) => setPartnerId(e.target.value)} />
      </label>{' '}
      <button onClick={() => void load()}>查询</button>
      <table border={1} cellPadding={6} style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>类型</th>
            <th>方向</th>
            <th>金额</th>
            <th>余额</th>
            <th>时间</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>{entry.id}</td>
              <td>{entry.entryType}</td>
              <td>{entry.direction}</td>
              <td>{entry.amount}</td>
              <td>{entry.balanceAfter}</td>
              <td>{entry.createdAt}</td>
              <td>{entry.remark}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
