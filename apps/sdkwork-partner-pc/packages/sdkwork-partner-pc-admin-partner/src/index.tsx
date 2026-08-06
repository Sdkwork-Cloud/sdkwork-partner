import { useCallback, useEffect, useState } from 'react';
import { getPartnerBackendClient } from '@sdkwork/partner-pc-admin-core';
import type { PartnerItem, PartnerTreeItem } from '@sdkwork/partner-backend-sdk';

type PartnerAdminTab = 'partners' | 'tree';

const DEFAULT_TAB: PartnerAdminTab = 'partners';

function resolveTab(sectionId: string | undefined): PartnerAdminTab {
  return sectionId === 'tree' ? 'tree' : DEFAULT_TAB;
}

export function PartnerAdmin({ sectionId }: { sectionId?: string } = {}) {
  const tab = resolveTab(sectionId);
  return tab === 'tree' ? <PartnerTreePage /> : <PartnersPage />;
}

function PartnersPage() {
  const [partners, setPartners] = useState<PartnerItem[]>([]);
  const [total, setTotal] = useState('0');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [levelNo, setLevelNo] = useState(1);
  const [userAccountId, setUserAccountId] = useState('');
  const [joinFeePartnerId, setJoinFeePartnerId] = useState('');
  const [joinFeeAmount, setJoinFeeAmount] = useState('');

  const load = useCallback(async (targetPage: number) => {
    setError(null);
    try {
      const result = await getPartnerBackendClient().partners.list({
        page: targetPage,
        pageSize: 20,
      });
      setPartners(result.items);
      setTotal(result.pageInfo.totalItems);
      setPage(targetPage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  async function createPartner() {
    setError(null);
    try {
      await getPartnerBackendClient().partners.create({
        name,
        levelNo,
        userAccountId,
      });
      setShowCreate(false);
      setName('');
      setLevelNo(1);
      setUserAccountId('');
      await load(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function recordJoinFee(partnerId: string) {
    setError(null);
    try {
      await getPartnerBackendClient().partners.joinFeePayments.create(
        partnerId,
        { amount: joinFeeAmount },
      );
      setJoinFeePartnerId('');
      setJoinFeeAmount('');
      await load(page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  const pageCount = Math.max(1, Math.ceil(Number(total) / 20));

  return (
    <section style={{ padding: 24 }}>
      <h2>合作伙伴管理</h2>
      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => setShowCreate((value) => !value)}>新建合作伙伴</button>
      </div>
      {showCreate ? (
        <div style={{ border: '1px solid #d1d5db', padding: 12, marginBottom: 12 }}>
          <h3>新建合作伙伴</h3>
          <label>
            名称 <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>{' '}
          <label>
            等级 <input type="number" min={1} value={levelNo} onChange={(e) => setLevelNo(Number(e.target.value))} />
          </label>{' '}
          <label>
            IAM 用户ID <input value={userAccountId} onChange={(e) => setUserAccountId(e.target.value)} />
          </label>{' '}
          <button onClick={() => void createPartner()}>创建</button>
        </div>
      ) : null}
      <table border={1} cellPadding={6} style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>名称</th>
            <th>等级</th>
            <th>上级ID</th>
            <th>状态</th>
            <th>加盟费</th>
            <th>登记加盟费</th>
          </tr>
        </thead>
        <tbody>
          {partners.map((partner) => (
            <tr key={partner.id}>
              <td>{partner.id}</td>
              <td>{partner.name}</td>
              <td>{partner.levelNo}</td>
              <td>{partner.parentPartnerId ?? '-'}</td>
              <td>{partner.status}</td>
              <td>
                {partner.joinFeeAmount}（{partner.joinFeeStatus}）
              </td>
              <td>
                {joinFeePartnerId === String(partner.id) ? (
                  <>
                    <input value={joinFeeAmount} onChange={(e) => setJoinFeeAmount(e.target.value)} placeholder="金额" />
                    <button onClick={() => void recordJoinFee(String(partner.id))}>确认登记</button>
                  </>
                ) : (
                  <button onClick={() => setJoinFeePartnerId(String(partner.id))}>登记加盟费</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 12 }}>
        <button disabled={page <= 1} onClick={() => void load(page - 1)}>
          上一页
        </button>{' '}
        第 {page} / {pageCount} 页{' '}
        <button disabled={page >= pageCount} onClick={() => void load(page + 1)}>
          下一页
        </button>
      </div>
    </section>
  );
}

function PartnerTreePage() {
  const [rootId, setRootId] = useState('');
  const [tree, setTree] = useState<PartnerTreeItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadTree() {
    setError(null);
    try {
      const result = await getPartnerBackendClient().partners.tree.list(rootId);
      setTree(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  function renderNodes(nodes: PartnerTreeItem[], depth: number): React.ReactNode {
    return nodes.map((node) => (
      <div key={node.id} style={{ marginLeft: depth * 24 }}>
        {node.name}（等级 {node.levelNo}，{node.status}）
        {node.children.length > 0 ? renderNodes(node.children, depth + 1) : null}
      </div>
    ));
  }

  return (
    <section style={{ padding: 24 }}>
      <h2>代理树</h2>
      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
      <label>
        根合作伙伴ID <input value={rootId} onChange={(e) => setRootId(e.target.value)} />
      </label>{' '}
      <button onClick={() => void loadTree()}>加载</button>
      <div style={{ marginTop: 12 }}>{renderNodes(tree, 0)}</div>
    </section>
  );
}
