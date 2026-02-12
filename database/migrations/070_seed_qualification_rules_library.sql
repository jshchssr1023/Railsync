-- ============================================================================
-- Migration 070: Populate Qualification Rules Library
-- Adds realistic AAR/FRA-based rule variants per car type and commodity
-- ============================================================================

-- ============================================================================
-- 1. Car-type-specific Tank Requalification rules
-- DOT-111 has shorter inspection cycles due to safety concerns
-- DOT-117 enhanced tanks have standard 10-year cycles
-- ============================================================================
INSERT INTO qualification_rules (
  qualification_type_id, rule_name, interval_months,
  warning_days_90, warning_days_60, warning_days_30,
  applies_to_car_types, applies_to_commodities,
  exemption_conditions, regulatory_reference, effective_date, is_active
)
SELECT
  qt.id,
  rd.rule_name,
  rd.interval_months,
  rd.warning_days_90,
  rd.warning_days_60,
  rd.warning_days_30,
  rd.applies_to_car_types::jsonb,
  rd.applies_to_commodities::jsonb,
  rd.exemption_conditions::jsonb,
  rd.regulatory_reference,
  rd.effective_date::date,
  TRUE
FROM qualification_types qt
JOIN (VALUES
  -- TANK_REQUALIFICATION variants
  ('TANK_REQUALIFICATION', 'Tank Requalification - DOT-111 (Non-Jacketed)', 96,
    TRUE, TRUE, TRUE,
    '["DOT111","DOT-111","111A"]', '[]',
    '{"requires": "non_jacketed"}',
    '49 CFR 180.509', '2020-01-01'),
  ('TANK_REQUALIFICATION', 'Tank Requalification - DOT-111 (Jacketed)', 120,
    TRUE, TRUE, TRUE,
    '["DOT111","DOT-111","111A"]', '[]',
    '{"requires": "jacketed"}',
    '49 CFR 180.509', '2020-01-01'),
  ('TANK_REQUALIFICATION', 'Tank Requalification - DOT-117', 120,
    TRUE, TRUE, TRUE,
    '["DOT117","DOT-117"]', '[]',
    '{}',
    '49 CFR 180.509', '2020-01-01'),
  ('TANK_REQUALIFICATION', 'Tank Requalification - Chlorine Service', 60,
    TRUE, TRUE, TRUE,
    '[]', '["Chlorine"]',
    '{}',
    '49 CFR 180.509; CGA C-1', '2020-01-01'),
  ('TANK_REQUALIFICATION', 'Tank Requalification - Anhydrous Ammonia', 120,
    TRUE, TRUE, TRUE,
    '[]', '["Anhydrous Ammonia","Ammonia"]',
    '{}',
    '49 CFR 180.509', '2020-01-01'),

  -- AIR_BRAKE variants
  ('AIR_BRAKE', 'Air Brake - Standard (Clean Service)', 48,
    TRUE, TRUE, TRUE,
    '[]', '[]',
    '{}',
    'AAR S-486', '2020-01-01'),
  ('AIR_BRAKE', 'Air Brake - Corrosive Service', 36,
    TRUE, TRUE, TRUE,
    '[]', '["Chlorine","Sulfuric Acid","Hydrochloric Acid","Hydrofluoric Acid"]',
    '{}',
    'AAR S-486', '2020-01-01'),

  -- SAFETY_APPLIANCE variants
  ('SAFETY_APPLIANCE', 'Safety Appliance - DOT-111 General', 60,
    TRUE, TRUE, TRUE,
    '["DOT111","DOT-111","111A"]', '[]',
    '{}',
    '49 CFR 231', '2020-01-01'),
  ('SAFETY_APPLIANCE', 'Safety Appliance - DOT-117 Enhanced', 60,
    TRUE, TRUE, TRUE,
    '["DOT117","DOT-117"]', '[]',
    '{}',
    '49 CFR 231', '2020-01-01'),

  -- HAZMAT variants
  ('HAZMAT_QUALIFICATION', 'Hazmat - PIH/TIH (Poison/Toxic Inhalation)', 60,
    TRUE, TRUE, TRUE,
    '[]', '["Chlorine","Anhydrous Ammonia","Ammonia","Sulfur Dioxide"]',
    '{}',
    '49 CFR 173.31', '2020-01-01'),
  ('HAZMAT_QUALIFICATION', 'Hazmat - Flammable Liquids', 120,
    TRUE, TRUE, TRUE,
    '[]', '["Ethanol","Crude Oil","Gasoline","Methanol"]',
    '{}',
    '49 CFR 173.243', '2020-01-01'),
  ('HAZMAT_QUALIFICATION', 'Hazmat - Corrosive Liquids', 96,
    TRUE, TRUE, TRUE,
    '[]', '["Sulfuric Acid","Hydrochloric Acid","Phosphoric Acid"]',
    '{}',
    '49 CFR 173.242', '2020-01-01'),

  -- PRESSURE_TEST variants
  ('PRESSURE_TEST', 'Pressure Test - Standard Tank', 120,
    TRUE, TRUE, TRUE,
    '[]', '[]',
    '{}',
    '49 CFR 180.509(c)', '2020-01-01'),
  ('PRESSURE_TEST', 'Pressure Test - High-Pressure Service (>100 PSI)', 60,
    TRUE, TRUE, TRUE,
    '["DOT105","DOT-105","105A"]', '[]',
    '{}',
    '49 CFR 180.509(c)', '2020-01-01'),

  -- VALVE_INSPECTION variants
  ('VALVE_INSPECTION', 'Valve Inspection - Standard Relief Valve', 60,
    TRUE, TRUE, TRUE,
    '[]', '[]',
    '{}',
    '49 CFR 180.509(d); AAR CPC-1232', '2020-01-01'),
  ('VALVE_INSPECTION', 'Valve Inspection - Chlorine Service', 36,
    TRUE, TRUE, TRUE,
    '[]', '["Chlorine"]',
    '{}',
    '49 CFR 180.509(d); CGA S-1.2', '2020-01-01'),

  -- THICKNESS_TEST variants
  ('THICKNESS_TEST', 'Shell Thickness - Standard Carbon Steel', 120,
    TRUE, TRUE, TRUE,
    '[]', '[]',
    '{"material_type": "Carbon Steel"}',
    '49 CFR 180.509(e)', '2020-01-01'),
  ('THICKNESS_TEST', 'Shell Thickness - Stainless/Alloy Steel', 120,
    TRUE, TRUE, TRUE,
    '[]', '[]',
    '{"material_type": "Stainless Steel"}',
    '49 CFR 180.509(e)', '2020-01-01'),
  ('THICKNESS_TEST', 'Shell Thickness - Corrosive Commodity Service', 60,
    TRUE, TRUE, TRUE,
    '[]', '["Sulfuric Acid","Hydrochloric Acid","Hydrofluoric Acid"]',
    '{}',
    '49 CFR 180.509(e)', '2020-01-01'),

  -- EXTERIOR_VISUAL variants
  ('EXTERIOR_VISUAL', 'Exterior Visual - Annual Inspection', 12,
    TRUE, TRUE, TRUE,
    '[]', '[]',
    '{}',
    'AAR M-1002', '2020-01-01'),
  ('EXTERIOR_VISUAL', 'Exterior Visual - Hazmat Service (Semi-Annual)', 6,
    TRUE, TRUE, TRUE,
    '[]', '["Chlorine","Anhydrous Ammonia","Sulfur Dioxide"]',
    '{}',
    'AAR M-1002; 49 CFR 174.9', '2020-01-01'),

  -- LINING_INSPECTION variants
  ('LINING_INSPECTION', 'Lining Inspection - Rubber Lining', 60,
    TRUE, TRUE, TRUE,
    '[]', '[]',
    '{"lining_type": "Rubber"}',
    'AAR M-1002 App T', '2020-01-01'),
  ('LINING_INSPECTION', 'Lining Inspection - Epoxy/High-Bake', 48,
    TRUE, TRUE, TRUE,
    '[]', '[]',
    '{"lining_type_any": ["Epoxy","High Bake"]}',
    'AAR M-1002 App T', '2020-01-01'),
  ('LINING_INSPECTION', 'Lining Inspection - Glass/Plasite', 36,
    TRUE, TRUE, TRUE,
    '[]', '[]',
    '{"lining_type_any": ["Plasite","Glass"]}',
    'AAR M-1002 App T', '2020-01-01'),

  -- STUB_SILL variants
  ('STUB_SILL', 'Stub Sill - Standard Inspection', 120,
    TRUE, TRUE, TRUE,
    '[]', '[]',
    '{}',
    'AAR S-259', '2020-01-01'),
  ('STUB_SILL', 'Stub Sill - Cars >30 Years (Accelerated)', 60,
    TRUE, TRUE, TRUE,
    '[]', '[]',
    '{"car_age_over": 30}',
    'AAR S-259', '2020-01-01')
) AS rd(type_code, rule_name, interval_months,
          warning_days_90, warning_days_60, warning_days_30,
          applies_to_car_types, applies_to_commodities,
          exemption_conditions, regulatory_reference, effective_date)
ON rd.type_code = qt.code
WHERE NOT EXISTS (
  SELECT 1 FROM qualification_rules qr
  WHERE qr.qualification_type_id = qt.id AND qr.rule_name = rd.rule_name
);
