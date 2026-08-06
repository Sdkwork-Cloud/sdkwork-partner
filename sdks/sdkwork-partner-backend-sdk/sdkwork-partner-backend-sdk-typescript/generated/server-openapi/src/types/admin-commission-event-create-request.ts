export interface AdminCommissionEventCreateRequest {
  /** Source reference (unique for MANUAL events). */
  sourceRef: string;
  /** Customer (IAM user) id. */
  customerUserId: string;
  /** Commissionable base amount. */
  baseAmount: string;
  /** Revenue event timestamp (default now). */
  eventAt?: string;
  /** Remark. */
  remark?: string;
}
