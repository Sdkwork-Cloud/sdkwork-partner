import type { JoinFeePaymentItem } from './join-fee-payment-item';

export interface JoinFeePaymentItemEnvelope {
  code: 0;
  traceId: string;
  data?: { item: JoinFeePaymentItem; };
}
