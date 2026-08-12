-- 001_bootstrap.sql
-- sdkwork:seed
-- module: partner
-- purpose: commercial default catalog for the partner center. Seven partner
--   levels forming the full agency pyramid (Agent -> Silver -> Gold ->
--   Strategic -> City Partner -> Provincial Agent -> Regional Distributor)
--   with differential (级差) commission pools, paid onboarding join fees,
--   and the per-level benefit (权益) ladder, plus the global commission
--   config row. Seeding targets the default tenant 100001 and uses
--   ON CONFLICT DO NOTHING so operator edits are never overwritten by
--   re-seeds or restarts. Level names and benefit copy are localized by the
--   locale seed files (seeds/locales/<locale>/001_levels_locale.sql).
--
-- Commission model: differential (级差) allocation. Each level ratio is the
--   commission pool of that level; ancestors earn the positive difference
--   against the best ratio below them, so the aggregated payout never
--   exceeds the highest ratio in the chain (30% default worst case).
--
-- Full tier design and go-to-market plan:
--   docs/product/ops/partner-tier-program.md

INSERT INTO partner_level (
    id, uuid, tenant_id, organization_id, level_no, name,
    customer_revenue_ratio, join_fee_commission_ratio, join_fee, status, sort_order, benefits
) VALUES
  (1001, 'seed-level-1001', 100001, 0, 1, 'Agent', 10.00, 8.00, 5999.00, 'ACTIVE', 1,
   ('[{"code":"commission_pool","name":"Customer revenue commission pool","value":"10% of customer profit (revenue × margin)","sort":1},' ||
   '{"code":"referral_link","name":"Exclusive referral link","value":"Track and attribute every customer","sort":2},' ||
   '{"code":"marketing_kit","name":"Marketing kit templates","value":"Banners, posters, and copy templates","sort":3},' ||
   '{"code":"onboarding_training","name":"Onboarding training","value":"Self-paced onboarding video course","sort":4},' ||
   '{"code":"online_support","name":"Standard online support","value":"Business-hours chat support","sort":5}]')::jsonb),
  (1002, 'seed-level-1002', 100001, 0, 2, 'Silver Agent', 12.00, 10.00, 9999.00, 'ACTIVE', 2,
   ('[{"code":"commission_pool","name":"Customer revenue commission pool","value":"12% of customer profit (revenue × margin)","sort":1},' ||
   '{"code":"performance_rank","name":"Performance leaderboard","value":"Monthly partner ranking exposure","sort":2},' ||
   '{"code":"advanced_training","name":"Advanced training","value":"Sales and product deep-dive courses","sort":3},' ||
   '{"code":"leads_monthly","name":"Qualified leads","value":"3 qualified leads per month","sort":4},' ||
   '{"code":"tech_sla","name":"Technical support SLA","value":"Next-business-day technical support","sort":5}]')::jsonb),
  (1003, 'seed-level-1003', 100001, 0, 3, 'Gold Agent', 15.00, 12.00, 19999.00, 'ACTIVE', 3,
   ('[{"code":"commission_pool","name":"Customer revenue commission pool","value":"15% of customer profit (revenue × margin)","sort":1},' ||
   '{"code":"account_manager","name":"Dedicated account manager","value":"1:1 account manager support","sort":2},' ||
   '{"code":"leads_monthly","name":"Qualified leads","value":"10 qualified leads per month","sort":3},' ||
   '{"code":"region_protection","name":"City region protection","value":"Protected territory for your city","sort":4},' ||
   '{"code":"annual_rebate","name":"Annual tiered rebate","value":"Extra rebate at annual sales tiers","sort":5},' ||
   '{"code":"certification","name":"Partner certification","value":"Official agent certification badge","sort":6}]')::jsonb),
  (1004, 'seed-level-1004', 100001, 0, 4, 'Strategic Agent', 18.00, 14.00, 49999.00, 'ACTIVE', 4,
   ('[{"code":"commission_pool","name":"Customer revenue commission pool","value":"18% of customer profit (revenue × margin)","sort":1},' ||
   '{"code":"account_manager","name":"Dedicated account manager","value":"Priority 1:1 account manager","sort":2},' ||
   '{"code":"co_marketing","name":"Co-marketing support","value":"Joint campaigns and co-branded assets","sort":3},' ||
   '{"code":"quarterly_incentive","name":"Quarterly incentive plan","value":"Performance-based quarterly bonus","sort":4},' ||
   '{"code":"trade_show","name":"Industry event slots","value":"Exhibition and event allocation","sort":5},' ||
   '{"code":"custom_solution","name":"Custom solutions","value":"Tailored solution consulting","sort":6},' ||
   '{"code":"priority_settlement","name":"Priority settlement","value":"Faster commission settlement cycles","sort":7}]')::jsonb),
  (1005, 'seed-level-1005', 100001, 0, 5, 'City Partner', 22.00, 16.00, 99999.00, 'ACTIVE', 5,
   ('[{"code":"commission_pool","name":"Customer revenue commission pool","value":"22% of customer profit (revenue × margin)","sort":1},' ||
   '{"code":"city_exclusive","name":"City exclusivity","value":"Exclusive rights for your city","sort":2},' ||
   '{"code":"leads_priority","name":"Priority lead pool","value":"20 priority leads per month","sort":3},' ||
   '{"code":"co_branding","name":"Co-branded campaigns","value":"Joint market investment with HQ","sort":4},' ||
   '{"code":"dedicated_api","name":"Dedicated API channel","value":"Exclusive API access and capacity","sort":5},' ||
   '{"code":"annual_summit","name":"Annual partner summit","value":"Invitation to the annual partner summit","sort":6},' ||
   '{"code":"express_settlement","name":"Express settlement","value":"Faster settlement via express channel","sort":7}]')::jsonb),
  (1006, 'seed-level-1006', 100001, 0, 6, 'Provincial Agent', 26.00, 18.00, 199999.00, 'ACTIVE', 6,
   ('[{"code":"commission_pool","name":"Customer revenue commission pool","value":"26% of customer profit (revenue × margin)","sort":1},' ||
   '{"code":"province_exclusive","name":"Province exclusivity","value":"Protected territory across your province","sort":2},' ||
   '{"code":"leads_priority","name":"Priority lead pool","value":"50 priority leads per month","sort":3},' ||
   '{"code":"presales_consultant","name":"Dedicated presales consultant","value":"Solution consulting for enterprise deals","sort":4},' ||
   '{"code":"solution_architect","name":"Solution architect","value":"Architecture support for large deals","sort":5},' ||
   '{"code":"private_deploy","name":"Private deployment support","value":"Private or custom deployment delivery","sort":6},' ||
   '{"code":"channel_conference","name":"Province channel conference","value":"Host province channel events","sort":7}]')::jsonb),
  (1007, 'seed-level-1007', 100001, 0, 7, 'Regional Distributor', 30.00, 20.00, 499999.00, 'ACTIVE', 7,
   ('[{"code":"commission_pool","name":"Customer revenue commission pool","value":"30% of customer profit (revenue × margin)","sort":1},' ||
   '{"code":"region_exclusive","name":"Regional exclusivity","value":"Exclusive distribution rights for your region","sort":2},' ||
   '{"code":"region_allowance","name":"Regional management allowance","value":"Allowance on downstream channel performance","sort":3},' ||
   '{"code":"joint_solution","name":"Joint solution building","value":"Co-build solutions with HQ","sort":4},' ||
   '{"code":"rnd_access","name":"R&D resource channel","value":"Dedicated R&D support channel","sort":5},' ||
   '{"code":"custom_sla","name":"Custom SLA contract","value":"Negotiated service-level agreement","sort":6},' ||
   '{"code":"summit_host","name":"Annual summit host","value":"Host or keynote at the annual partner summit","sort":7},' ||
   '{"code":"equity_plan","name":"Strategic equity plan","value":"Investment or equity incentive plan","sort":8}]')::jsonb)
ON CONFLICT (tenant_id, organization_id, level_no) DO NOTHING;

-- Global commission configuration for the default tenant:
--   differential settlement enabled for usage and recharge revenue,
--   commission depth capped at 3, CNY, minimum withdrawal 100.00.
-- Profit-based rebate: customer revenue commissions are allocated on
--   revenue × profit_margin_ratio (40.00 default); join-fee commissions use
--   the full join fee.
INSERT INTO partner_commission_config (
    id, uuid, tenant_id, organization_id, enabled, revenue_sources,
    max_commission_depth, currency, min_withdrawal_amount, profit_margin_ratio
) VALUES
  (9001, 'seed-commission-config-100001', 100001, 0, TRUE,
   '{"usage_settlement":true,"recharge":true}', 3, 'CNY', 100.00, 40.00)
ON CONFLICT (tenant_id, organization_id) DO NOTHING;
