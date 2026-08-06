import type { CustomerBindingItem } from './customer-binding-item';

export interface CustomerBindingItemEnvelope {
  code: 0;
  traceId: string;
  data?: { item: CustomerBindingItem; };
}
