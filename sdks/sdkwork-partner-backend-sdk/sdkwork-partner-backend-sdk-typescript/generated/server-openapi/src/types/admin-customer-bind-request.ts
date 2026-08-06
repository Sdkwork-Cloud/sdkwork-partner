export interface AdminCustomerBindRequest {
  /** Partner id. */
  partnerId: string;
  /** Customer (IAM user) id. */
  customerUserId: string;
  /** Binding type (default ADMIN_BIND). */
  bindingType?: 'ADMIN_BIND';
}
