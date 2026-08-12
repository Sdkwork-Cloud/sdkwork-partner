import { useCallback, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, GitBranch, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PartnerItem, PartnerStatItem, PartnerTreeItem } from '@sdkwork/partner-backend-sdk';
import {
  errorMessage,
  formatDateTime,
  formatDecimal,
  InlineError,
  Modal,
  PageShell,
  PartnerPickerField,
  primaryButtonClass,
  secondaryButtonClass,
  Tooltip,
} from '@sdkwork/partner-pc-admin-core/ui';
import { partnerService } from '../services/partnerService';
import { useRequestGuard } from '@sdkwork/partner-pc-admin-core';
import { PartnerStatusBadge } from '../components/status';

// The tree endpoint requires a positive integer root partner id
// (GET /backend/v3/api/partners/{partnerId}/tree).
const POSITIVE_INTEGER_RE = /^[1-9]\d*$/;

export function PartnerTreePage() {
  const { t } = useTranslation();
  const guard = useRequestGuard();
  const [appliedRootId, setAppliedRootId] = useState('');
  const [tree, setTree] = useState<PartnerTreeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<PartnerItem | null>(null);
  const [selectedStats, setSelectedStats] = useState<PartnerStatItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = async (root: string) => {
    const rootId = root.trim();
    if (!POSITIVE_INTEGER_RE.test(rootId)) {
      // Never send an empty or non-numeric root id to the API; reset to the
      // idle state instead. Clearing the input or submitting invalid values
      // must not produce a 400 "partnerId must be a positive integer".
      setTree([]);
      setExpanded(new Set());
      setError(
        rootId === ''
          ? null
          : t('admin.partner.tree.errors.invalidRoot', { defaultValue: 'Root partner ID must be a positive integer.' }),
      );
      return;
    }
    const seq = guard.next();
    setLoading(true);
    setError(null);
    try {
      const result = await partnerService.partners.tree(rootId);
      if (!guard.isCurrent(seq)) return;
      setTree(result);
      setExpanded(new Set());
    } catch (cause) {
      setError(errorMessage(cause, t('admin.partner.tree.errors.loadFailed', { defaultValue: 'Failed to load the partner tree.' })));
    } finally {
      if (guard.isCurrent(seq)) setLoading(false);
    }
  };

  const openNode = useCallback(async (id: string) => {
    const seq = guard.next();
    setSelectedId(id);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const [partner, stats] = await Promise.all([
        partnerService.partners.retrieve(id),
        partnerService.stats.retrieve(id).catch(() => null),
      ]);
      if (!guard.isCurrent(seq)) return;
      setSelectedPartner(partner);
      setSelectedStats(stats);
    } catch (cause) {
      setDetailError(errorMessage(cause, t('admin.partner.tree.errors.nodeFailed', { defaultValue: 'Failed to load the node details.' })));
    } finally {
      if (guard.isCurrent(seq)) setDetailLoading(false);
    }
  }, [guard, t]);

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const countNodes = (nodes: PartnerTreeItem[]): number =>
    nodes.reduce((sum, node) => sum + 1 + countNodes(node.children), 0);

  const collectNodeIds = (nodes: PartnerTreeItem[], acc: Set<string> = new Set()): Set<string> => {
    for (const node of nodes) {
      acc.add(node.id);
      collectNodeIds(node.children, acc);
    }
    return acc;
  };

  const expandAll = () => setExpanded(collectNodeIds(tree));

  const collapseAll = () => setExpanded(new Set());

  return (
    <PageShell>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <PartnerPickerField
              name="rootId"
              placeholder={t('admin.partner.tree.rootPlaceholder', { defaultValue: 'Select root partner…' })}
              onChange={(ids) => {
                setAppliedRootId(ids);
                void load(ids);
              }}
            />
            <Tooltip content={t('common.actions.refresh', { defaultValue: 'Refresh' })}>
              <button
                type="button"
                className={secondaryButtonClass}
                disabled={loading}
                onClick={() => void load(appliedRootId)}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </Tooltip>
          </div>
          <div className="flex items-center gap-2">
            {tree.length > 0 ? (
              <>
                <button type="button" className={secondaryButtonClass} onClick={expandAll}>
                  <ChevronsUpDown className="h-4 w-4" />
                  {t('admin.partner.tree.expandAll', { defaultValue: 'Expand all' })}
                </button>
                <button type="button" className={secondaryButtonClass} onClick={collapseAll}>
                  <ChevronsDownUp className="h-4 w-4" />
                  {t('admin.partner.tree.collapseAll', { defaultValue: 'Collapse all' })}
                </button>
                <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <GitBranch className="h-4 w-4" />
                  {t('admin.partner.tree.totalNodes', { defaultValue: '{{count}} nodes', count: countNodes(tree) })}
                </span>
              </>
            ) : null}
          </div>
        </div>
        <InlineError message={error} />
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#171717]">
          {!appliedRootId ? (
            <p className="py-12 text-center text-sm text-slate-500">
              {t('admin.partner.tree.empty', { defaultValue: 'Enter a root partner ID and load the tree.' })}
            </p>
          ) : loading ? (
            <p className="py-12 text-center text-sm text-slate-500">{t('admin.partner.tree.loading', { defaultValue: 'Loading tree…' })}</p>
          ) : tree.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              {t('admin.partner.tree.noNodes', { defaultValue: 'No partners under this root.' })}
            </p>
          ) : (
            <div className="grid gap-0.5">
              {tree.map((node) => (
                <TreeNode key={node.id} node={node} depth={0} expanded={expanded} onToggle={toggle} onSelect={openNode} />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedId ? (
        <Modal
          title={selectedPartner?.name ?? t('admin.partner.tree.nodeTitle', { defaultValue: 'Partner node' })}
          description={t('admin.partner.tree.nodeSubtitle', { defaultValue: 'Partner #{{id}} · Level {{level}}', id: selectedId, level: selectedPartner?.levelNo ?? '-' })}
          busy={false}
          submitLabel={t('common.actions.close', { defaultValue: 'Close' })}
          onSubmit={(event) => {
            event.preventDefault();
            setSelectedId(null);
          }}
          onClose={() => setSelectedId(null)}
        >
          {detailLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">{t('admin.partner.tree.loading', { defaultValue: 'Loading tree…' })}</p>
          ) : detailError ? (
            <InlineError message={detailError} />
          ) : selectedPartner ? (
            <div className="grid gap-5">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <NodeRow label={t('admin.partner.partners.form.name', { defaultValue: 'Name' })} value={selectedPartner.name} />
                <NodeRow label={t('admin.partner.partners.table.status', { defaultValue: 'Status' })} value={<PartnerStatusBadge status={selectedPartner.status} />} />
                <NodeRow label={t('admin.partner.partners.form.level', { defaultValue: 'Level' })} value={`L${selectedPartner.levelNo}`} />
                <NodeRow label={t('admin.partner.partners.form.parentPartnerId', { defaultValue: 'Parent partner ID' })} value={selectedPartner.parentPartnerId ?? '-'} mono />
                <NodeRow label={t('admin.partner.partners.form.contactName', { defaultValue: 'Contact name' })} value={selectedPartner.contactName || '-'} />
                <NodeRow label={t('admin.partner.partners.form.phone', { defaultValue: 'Phone' })} value={selectedPartner.phone || '-'} />
                <NodeRow label={t('admin.partner.partners.detail.joinedAt', { defaultValue: 'Joined' })} value={formatDateTime(selectedPartner.joinedAt)} />
                <NodeRow label={t('admin.partner.partners.table.joinFee', { defaultValue: 'Join fee' })} value={formatDecimal(selectedPartner.joinFeeAmount)} />
              </div>
              {selectedStats ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <MiniStat label={t('admin.partner.partners.summary.available', { defaultValue: 'Available balance' })} value={formatDecimal(selectedStats.availableBalance)} />
                  <MiniStat label={t('admin.partner.partners.summary.commission', { defaultValue: 'Commission earned' })} value={formatDecimal(selectedStats.totalCommission)} />
                  <MiniStat label={t('admin.partner.partners.summary.customers', { defaultValue: 'Bound customers' })} value={selectedStats.customerCount} />
                  <MiniStat label={t('admin.partner.stats.partner.downstream', { defaultValue: 'Downstream partners' })} value={selectedStats.downstreamPartnerCount} />
                </div>
              ) : null}
            </div>
          ) : null}
        </Modal>
      ) : null}
    </PageShell>
  );
}

function TreeNode({
  node,
  depth,
  expanded,
  onToggle,
  onSelect,
}: {
  node: PartnerTreeItem;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  return (
    <div>
      <div
        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-white/[0.03]"
        style={{ marginLeft: depth * 24 }}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren ? (
          <Tooltip content={t('admin.partner.tree.toggle', { defaultValue: 'Expand / collapse' })}>
            <button
              type="button"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
              aria-label={t('admin.partner.tree.toggle', { defaultValue: 'Expand / collapse' })}
              onClick={(event) => {
                event.stopPropagation();
                onToggle(node.id);
              }}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </Tooltip>
        ) : (
          <span className="h-5 w-5 shrink-0" aria-hidden="true" />
        )}
        <span className="min-w-0">
          <span className="block truncate font-medium text-slate-800 dark:text-slate-100">{node.name}</span>
          <span className="block font-mono text-[11px] text-slate-400">
            #{node.id} · {t('admin.partner.tree.level', { defaultValue: 'L{{level}}', level: node.levelNo })}
            {hasChildren ? ` · ${t('admin.partner.tree.children', { defaultValue: '{{count}} children', count: node.children.length })}` : ''}
          </span>
        </span>
        <span className="ml-auto shrink-0">
          <PartnerStatusBadge status={node.status} />
        </span>
      </div>
      {hasChildren && isExpanded
        ? node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} onSelect={onSelect} />
          ))
        : null}
    </div>
  );
}

function NodeRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] items-center gap-2">
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={`min-w-0 truncate ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 px-3 py-2 dark:border-white/10">
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm font-semibold text-slate-900 dark:text-white">{value}</dd>
    </div>
  );
}
