export interface CustomerBindingItem {
  /** Binding id. */
  id: string;
  /** Partner id. */
  partnerId: string;
  /** Customer (IAM user) id. */
  customerUserId: string;
  /** Binding type. */
  bindingType: 'ADMIN_BIND';
  /** Binding status. */
  status: 'ACTIVE' | 'UNBOUND';
  /** Bound timestamp. */
  boundAt: string;
  /** Operator id that bound the customer. */
  boundBy: string;
  /** Unbound timestamp. */
  unboundAt?: string | null;
  /** Operator id that unbound the customer. */
  unboundBy?: string | null;
  /** Created timestamp. */
  createdAt: string;
}
