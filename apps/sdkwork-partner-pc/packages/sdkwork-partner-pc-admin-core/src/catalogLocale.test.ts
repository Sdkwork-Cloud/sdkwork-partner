import { describe, expect, it } from 'vitest';
import { localizeBenefit, localizeLevelName, normalizeCatalogLocale } from './catalogLocale';

describe('normalizeCatalogLocale', () => {
  it('normalizes zh/en language tags to the catalog locales', () => {
    expect(normalizeCatalogLocale('zh-CN')).toBe('zh-CN');
    expect(normalizeCatalogLocale('zh')).toBe('zh-CN');
    expect(normalizeCatalogLocale('en-US')).toBe('en-US');
    expect(normalizeCatalogLocale('en')).toBe('en-US');
  });

  it('keeps other locales and empty input raw', () => {
    expect(normalizeCatalogLocale('ja-JP')).toBe('ja-JP');
    expect(normalizeCatalogLocale(undefined)).toBe('');
  });
});

describe('localizeLevelName', () => {
  it('translates known default level names both ways', () => {
    expect(localizeLevelName('Agent', 'zh-CN')).toBe('普通代理');
    expect(localizeLevelName('普通代理', 'en-US')).toBe('Agent');
    expect(localizeLevelName('Regional Distributor', 'zh-CN')).toBe('区域总代');
    expect(localizeLevelName('区域总代', 'en-US')).toBe('Regional Distributor');
  });

  it('leaves admin-customized level names raw', () => {
    expect(localizeLevelName('Elite Partner', 'zh-CN')).toBe('Elite Partner');
    expect(localizeLevelName('精英伙伴', 'en-US')).toBe('精英伙伴');
  });

  it('falls back to the raw name for unsupported locales', () => {
    expect(localizeLevelName('Agent', 'ja-JP')).toBe('Agent');
  });
});

describe('localizeBenefit', () => {
  it('translates known default benefits (name and value) by code', () => {
    expect(
      localizeBenefit(
        { code: 'commission_pool', name: 'Customer revenue commission pool', value: '10% of customer profit (revenue × margin)' },
        'zh-CN',
      ),
    ).toEqual({ name: '客户消费返佣池', value: '客户收益利润 10% 返佣' });
    expect(
      localizeBenefit(
        { code: 'commission_pool', name: '客户消费返佣池', value: '客户收益利润 10% 返佣' },
        'en-US',
      ),
    ).toEqual({ name: 'Customer revenue commission pool', value: '10% of customer profit (revenue × margin)' });
  });

  it('keeps level-specific value variants intact', () => {
    expect(
      localizeBenefit(
        { code: 'leads_monthly', name: '商机线索', value: '每月 3 条优质商机线索' },
        'en-US',
      ),
    ).toEqual({ name: 'Qualified leads', value: '3 qualified leads per month' });
    expect(
      localizeBenefit(
        { code: 'leads_priority', name: 'Priority lead pool', value: '50 priority leads per month' },
        'zh-CN',
      ),
    ).toEqual({ name: '商机池优先分配', value: '每月 50 条优先商机线索' });
  });

  it('keeps admin-customized names and values raw even for known codes', () => {
    expect(
      localizeBenefit({ code: 'commission_pool', name: '超级返佣池', value: '客户收益利润 10% 返佣' }, 'en-US'),
    ).toEqual({ name: '超级返佣池', value: '10% of customer profit (revenue × margin)' });
    expect(
      localizeBenefit({ code: 'commission_pool', name: '客户消费返佣池', value: '内部特批比例' }, 'en-US'),
    ).toEqual({ name: 'Customer revenue commission pool', value: '内部特批比例' });
  });

  it('falls back to raw data for unknown codes, unsupported locales, and undefined values', () => {
    expect(localizeBenefit({ code: 'custom_benefit', name: '自定义权益', value: '自定义说明' }, 'zh-CN')).toEqual({
      name: '自定义权益',
      value: '自定义说明',
    });
    expect(
      localizeBenefit(
        { code: 'commission_pool', name: '客户消费返佣池', value: '客户收益利润 10% 返佣' },
        'ja-JP',
      ),
    ).toEqual({ name: '客户消费返佣池', value: '客户收益利润 10% 返佣' });
    expect(localizeBenefit({ code: 'referral_link', name: '专属推广链接', value: undefined }, 'en-US')).toEqual({
      name: 'Exclusive referral link',
      value: '',
    });
  });
});
