export interface AuditLogItem {
  id: string;
  operatorId: string;
  operatorType: string;
  /** Admin action performed (e.g. partner.create). */
  action: string;
  /** Target entity type (partner/level/withdrawal/...). */
  targetType: string;
  targetId?: string;
  /** JSON payload snapshot of the mutation. */
  payload: string;
  createdAt: string;
}
