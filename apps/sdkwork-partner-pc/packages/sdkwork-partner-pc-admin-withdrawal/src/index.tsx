import { useCallback, useEffect, useState } from 'react';
import { getPartnerBackendClient } from '@sdkwork/partner-pc-admin-core';
import type { WithdrawalItem } from '@sdkwork/partner-backend-sdk';

export function WithdrawalAdmin() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [total, setTotal] = useState('0');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (targetPage: number) => {
    setError(null);
    try {
      const result = await getPartnerBackendClient().partners.withdrawals.list({
        page: targetPage,
        pageSize: 20,
      });
      setWithdrawals(result.items);
      setTotal(result.pageInfo.totalItems);
      setPage(targetPage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  async function review(withdrawalId: string, approve: boolean) {
    setError(null);
    try {
      await getPartnerBackendClient().partners.withdrawalReviews.update(withdrawalId, {
        approve,
        reviewRemark: approve ? '管理员审核通过' : '管理员驳回',
      });
      await load(page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function pay(withdrawalId: string) {
    setError(null);
    try {
      await getPartnerBackendClient().partners.withdrawalPayments.update(withdrawalId, {
        remark: '线下打款完成',
      });
      await load(page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <section style={{ padding: 24 }}>
      <h2>提现管理</h2>
      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
      <table border={1} cellPadding={6} style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>合作伙伴</th>
            <th>金额</th>
            <th>状态</th>
            <th>申请时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {withdrawals.map((withdrawal) => (
            <tr key={withdrawal.id}>
              <td>{withdrawal.id}</td>
              <td>{withdrawal.partnerId}</td>
              <td>{withdrawal.amount}</td>
              <td>{withdrawal.status}</td>
              <td>{withdrawal.createdAt}</td>
              <td>
                {withdrawal.status === 'PENDING' ? (
                  <>
                    <button onClick={() => void review(String(withdrawal.id), true)}>通过</button>{' '}
                    <button onClick={() => void review(String(withdrawal.id), false)}>驳回</button>
                  </>
                ) : null}
                {withdrawal.status === 'APPROVED' ? (
                  <button onClick={() => void pay(String(withdrawal.id))}>标记已打款</button>
                ) : null}
              </td>
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
