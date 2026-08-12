import { partnerJoinEnUsApplyMessages } from './en-US/commerce/partner-join/apply';
import { partnerJoinEnUsCommonMessages } from './en-US/commerce/partner-join/common';
import { partnerJoinEnUsLandingMessages } from './en-US/commerce/partner-join/landing';
import { partnerJoinEnUsStatusMessages } from './en-US/commerce/partner-join/status';
import { partnerJoinZhCnApplyMessages } from './zh-CN/commerce/partner-join/apply';
import { partnerJoinZhCnCommonMessages } from './zh-CN/commerce/partner-join/common';
import { partnerJoinZhCnLandingMessages } from './zh-CN/commerce/partner-join/landing';
import { partnerJoinZhCnStatusMessages } from './zh-CN/commerce/partner-join/status';

export const partnerJoinMessages = {
  en: {
    ...partnerJoinEnUsCommonMessages,
    ...partnerJoinEnUsLandingMessages,
    ...partnerJoinEnUsApplyMessages,
    ...partnerJoinEnUsStatusMessages,
  },
  zh: {
    ...partnerJoinZhCnCommonMessages,
    ...partnerJoinZhCnLandingMessages,
    ...partnerJoinZhCnApplyMessages,
    ...partnerJoinZhCnStatusMessages,
  },
};
