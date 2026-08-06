import type { CustomerBindingItem } from './customer-binding-item';
import type { PageInfo } from './page-info';

export interface CustomerBindingListEnvelope {
  code: 0;
  traceId: string;
  data?: { items: CustomerBindingItem[]; pageInfo: PageInfo; };
}
