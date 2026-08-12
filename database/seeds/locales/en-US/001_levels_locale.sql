-- 001_levels_locale.sql
-- sdkwork:seed-locale
-- module: partner
-- locale: en-US
-- purpose: re-assert the English level catalog display fields. The common
--   seed already inserts these values; this file keeps the en-US locale set
--   complete and idempotent so activating en-US later yields consistent
--   display text. Rows are keyed by the fixed seed primary keys.

UPDATE partner_level SET name = 'Agent', updated_at = CURRENT_TIMESTAMP WHERE id = 1001;
UPDATE partner_level SET name = 'Silver Agent', updated_at = CURRENT_TIMESTAMP WHERE id = 1002;
UPDATE partner_level SET name = 'Gold Agent', updated_at = CURRENT_TIMESTAMP WHERE id = 1003;
UPDATE partner_level SET name = 'Strategic Agent', updated_at = CURRENT_TIMESTAMP WHERE id = 1004;
UPDATE partner_level SET name = 'City Partner', updated_at = CURRENT_TIMESTAMP WHERE id = 1005;
UPDATE partner_level SET name = 'Provincial Agent', updated_at = CURRENT_TIMESTAMP WHERE id = 1006;
UPDATE partner_level SET name = 'Regional Distributor', updated_at = CURRENT_TIMESTAMP WHERE id = 1007;

-- L1 Agent (5,999 join fee; entry distribution tier)
UPDATE partner_level SET
    benefits = ('[{"code":"commission_pool","name":"Customer revenue commission pool","value":"10% of customer profit (revenue × margin)","sort":1},' ||
               '{"code":"referral_link","name":"Exclusive referral link","value":"Track and attribute every customer","sort":2},' ||
               '{"code":"marketing_kit","name":"Marketing kit templates","value":"Banners, posters, and copy templates","sort":3},' ||
               '{"code":"onboarding_training","name":"Onboarding training","value":"Self-paced onboarding video course","sort":4},' ||
               '{"code":"online_support","name":"Standard online support","value":"Business-hours chat support","sort":5}]')::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1001;

-- L2 Silver Agent (9,999 join fee; growth tier)
UPDATE partner_level SET
    benefits = ('[{"code":"commission_pool","name":"Customer revenue commission pool","value":"12% of customer profit (revenue × margin)","sort":1},' ||
               '{"code":"performance_rank","name":"Performance leaderboard","value":"Monthly partner ranking exposure","sort":2},' ||
               '{"code":"advanced_training","name":"Advanced training","value":"Sales and product deep-dive courses","sort":3},' ||
               '{"code":"leads_monthly","name":"Qualified leads","value":"3 qualified leads per month","sort":4},' ||
               '{"code":"tech_sla","name":"Technical support SLA","value":"Next-business-day technical support","sort":5}]')::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1002;

-- L3 Gold Agent (19,999 join fee; core channel tier)
UPDATE partner_level SET
    benefits = ('[{"code":"commission_pool","name":"Customer revenue commission pool","value":"15% of customer profit (revenue × margin)","sort":1},' ||
               '{"code":"account_manager","name":"Dedicated account manager","value":"1:1 account manager support","sort":2},' ||
               '{"code":"leads_monthly","name":"Qualified leads","value":"10 qualified leads per month","sort":3},' ||
               '{"code":"region_protection","name":"City region protection","value":"Protected territory for your city","sort":4},' ||
               '{"code":"annual_rebate","name":"Annual tiered rebate","value":"Extra rebate at annual sales tiers","sort":5},' ||
               '{"code":"certification","name":"Partner certification","value":"Official agent certification badge","sort":6}]')::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1003;

-- L4 Strategic Agent (49,999 join fee; regional operation tier)
UPDATE partner_level SET
    benefits = ('[{"code":"commission_pool","name":"Customer revenue commission pool","value":"18% of customer profit (revenue × margin)","sort":1},' ||
               '{"code":"account_manager","name":"Dedicated account manager","value":"Priority 1:1 account manager","sort":2},' ||
               '{"code":"co_marketing","name":"Co-marketing support","value":"Joint campaigns and co-branded assets","sort":3},' ||
               '{"code":"quarterly_incentive","name":"Quarterly incentive plan","value":"Performance-based quarterly bonus","sort":4},' ||
               '{"code":"trade_show","name":"Industry event slots","value":"Exhibition and event allocation","sort":5},' ||
               '{"code":"custom_solution","name":"Custom solutions","value":"Tailored solution consulting","sort":6},' ||
               '{"code":"priority_settlement","name":"Priority settlement","value":"Faster commission settlement cycles","sort":7}]')::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1004;

-- L5 City Partner (99,999 join fee; city exclusivity tier)
UPDATE partner_level SET
    benefits = ('[{"code":"commission_pool","name":"Customer revenue commission pool","value":"22% of customer profit (revenue × margin)","sort":1},' ||
               '{"code":"city_exclusive","name":"City exclusivity","value":"Exclusive rights for your city","sort":2},' ||
               '{"code":"leads_priority","name":"Priority lead pool","value":"20 priority leads per month","sort":3},' ||
               '{"code":"co_branding","name":"Co-branded campaigns","value":"Joint market investment with HQ","sort":4},' ||
               '{"code":"dedicated_api","name":"Dedicated API channel","value":"Exclusive API access and capacity","sort":5},' ||
               '{"code":"annual_summit","name":"Annual partner summit","value":"Invitation to the annual partner summit","sort":6},' ||
               '{"code":"express_settlement","name":"Express settlement","value":"Faster settlement via express channel","sort":7}]')::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1005;

-- L6 Provincial Agent (199,999 join fee; province operation and channel tier)
UPDATE partner_level SET
    benefits = ('[{"code":"commission_pool","name":"Customer revenue commission pool","value":"26% of customer profit (revenue × margin)","sort":1},' ||
               '{"code":"province_exclusive","name":"Province exclusivity","value":"Protected territory across your province","sort":2},' ||
               '{"code":"leads_priority","name":"Priority lead pool","value":"50 priority leads per month","sort":3},' ||
               '{"code":"presales_consultant","name":"Dedicated presales consultant","value":"Solution consulting for enterprise deals","sort":4},' ||
               '{"code":"solution_architect","name":"Solution architect","value":"Architecture support for large deals","sort":5},' ||
               '{"code":"private_deploy","name":"Private deployment support","value":"Private or custom deployment delivery","sort":6},' ||
               '{"code":"channel_conference","name":"Province channel conference","value":"Host province channel events","sort":7}]')::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1006;

-- L7 Regional Distributor (499,999 join fee; regional master distribution tier)
UPDATE partner_level SET
    benefits = ('[{"code":"commission_pool","name":"Customer revenue commission pool","value":"30% of customer profit (revenue × margin)","sort":1},' ||
               '{"code":"region_exclusive","name":"Regional exclusivity","value":"Exclusive distribution rights for your region","sort":2},' ||
               '{"code":"region_allowance","name":"Regional management allowance","value":"Allowance on downstream channel performance","sort":3},' ||
               '{"code":"joint_solution","name":"Joint solution building","value":"Co-build solutions with HQ","sort":4},' ||
               '{"code":"rnd_access","name":"R&D resource channel","value":"Dedicated R&D support channel","sort":5},' ||
               '{"code":"custom_sla","name":"Custom SLA contract","value":"Negotiated service-level agreement","sort":6},' ||
               '{"code":"summit_host","name":"Annual summit host","value":"Host or keynote at the annual partner summit","sort":7},' ||
               '{"code":"equity_plan","name":"Strategic equity plan","value":"Investment or equity incentive plan","sort":8}]')::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1007;
