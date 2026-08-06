import type { JoinFeePaymentItem } from './join-fee-payment-item';
import type { PageInfo } from './page-info';

export interface JoinFeePaymentListEnvelope {
  code: 0;
  traceId: string;
  data?: { items: JoinFeePaymentItem[]; pageInfo: PageInfo; };
}
