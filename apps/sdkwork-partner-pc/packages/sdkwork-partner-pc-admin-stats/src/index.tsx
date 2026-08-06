import { useCallback, useEffect, useState } from 'react';
import { getPartnerBackendClient } from '@sdkwork/partner-pc-admin-core';
import type { PartnerStatItem, StatSnapshotItem, StatsOverviewItem } from '@sdkwork/partner-backend-sdk';

export function StatsAdmin() {
  const [overview, setOverview] = useState<StatsOverviewItem | null>(null);
  const [snapshots, setSnapshots] = useState<StatSnapshotItem[]>([]);
  const [partnerId, setPartnerId] = useState('');
  const [partnerStats, setPartnerStats] = useState<PartnerStatItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [overviewResult, snapshotsResult] = await Promise.all([
        getPartnerBackendClient().partners.statsOverview.list(),
        getPartnerBackendClient().partners.stats.list({ page: 1, pageSize: 20 }),
      ]);
      setOverview(overviewResult);
      setSnapshots(snapshotsResult.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadPartnerStats() {
    setError(null);
    try {
      setPartnerStats(
        await getPartnerBackendClient().partners.stats.retrieve(partnerId),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <section style={{ padding: 24 }}>
      <h2>业绩统计</h2>
      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
      {overview ? (
        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          <div>
            <strong>{overview.totalPartners}</strong>
            <p>合作伙伴总数（活跃 {overview.activePartners}）</p>
          </div>
          <div>
            <strong>{overview.totalJoinFee}</strong>
            <p>加盟费合计</p>
          </div>
          <div>
            <strong>{overview.totalCommission}</strong>
            <p>累计发放提成</p>
          </div>
          <div>
            <strong>{overview.pendingWithdrawalCount}</strong>
            <p>待处理提现（{overview.pendingWithdrawalAmount} 元）</p>
          </div>
        </div>
      ) : null}
      <h3>单合作伙伴统计</h3>
      <label>
        合作伙伴ID <input value={partnerId} onChange={(e) => setPartnerId(e.target.value)} />
      </label>{' '}
      <button onClick={() => void loadPartnerStats()}>查询</button>
      {partnerStats ? (
        <table border={1} cellPadding={6} style={{ borderCollapse: 'collapse', marginTop: 12 }}>
          <tbody>
            <tr>
              <td>加盟费合计</td>
              <td>{partnerStats.totalJoinFee}</td>
            </tr>
            <tr>
              <td>累计提成</td>
              <td>{partnerStats.totalCommission}</td>
            </tr>
            <tr>
              <td>可用余额</td>
              <td>{partnerStats.availableBalance}</td>
            </tr>
            <tr>
              <td>冻结金额</td>
              <td>{partnerStats.withdrawingAmount}</td>
            </tr>
            <tr>
              <td>已提现</td>
              <td>{partnerStats.withdrawnAmount}</td>
            </tr>
            <tr>
              <td>绑定客户数</td>
              <td>{partnerStats.customerCount}</td>
            </tr>
            <tr>
              <td>下级代理商数</td>
              <td>{partnerStats.downstreamPartnerCount}</td>
            </tr>
          </tbody>
        </table>
      ) : null}
      <h3 style={{ marginTop: 24 }}>周期快照</h3>
      <table border={1} cellPadding={6} style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th>合作伙伴</th>
            <th>周期</th>
            <th>加盟费</th>
            <th>客户数</th>
            <th>收益基数</th>
            <th>提成</th>
            <th>下级数</th>
          </tr>
        </thead>
        <tbody>
          {snapshots.map((snapshot) => (
            <tr key={snapshot.id}>
              <td>{snapshot.partnerId}</td>
              <td>
                {snapshot.periodType} {snapshot.periodStart}
              </td>
              <td>{snapshot.joinFeeTotal}</td>
              <td>{snapshot.customerCount}</td>
              <td>{snapshot.revenueBase}</td>
              <td>{snapshot.commissionEarned}</td>
              <td>{snapshot.downstreamPartnerCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
