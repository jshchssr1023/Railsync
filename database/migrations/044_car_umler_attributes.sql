-- Migration 044: UMLER Car Attributes
-- Adds a 1:1 detail table for engineering/specification data reported to UMLER.
-- Accessed as a "deeper layer" from the car detail UI; not loaded in list/planning queries.

BEGIN;

CREATE TABLE IF NOT EXISTS car_umler_attributes (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id    UUID NOT NULL UNIQUE REFERENCES cars(id) ON DELETE CASCADE,

  -- ═══════════════════════════════════════════════════════════════════
  -- IDENTITY / COMMERCIAL
  -- ═══════════════════════════════════════════════════════════════════
  umler_car_id            VARCHAR(20),       -- CAR_ID (UMLER-reported)
  lessee_code             VARCHAR(20),       -- LESSEE_CODE
  type_code               VARCHAR(20),       -- TYPE_CODE
  class_code              VARCHAR(20),       -- CLASS_CODE
  commodity               VARCHAR(100),      -- COMMODITY
  company_code            VARCHAR(20),       -- COMPANY_CODE
  contract_no             VARCHAR(30),       -- CONTRACT_NO
  orig_car_id             VARCHAR(20),       -- ORIG_CAR_ID
  rider_code              VARCHAR(20),       -- RIDER_CODE
  lessee_invoice_code     VARCHAR(20),       -- LESSEE_INVOICE_CODE
  lettering_special_code  VARCHAR(20),       -- LETTERING_SPECIAL_CODE
  lot_number              VARCHAR(30),       -- LOT_NUMBER
  stock_lot_number        VARCHAR(30),       -- STOCK_LOT_NUMBER
  mileage_rate            NUMERIC(10,4),     -- MILAGE_RATE
  product_line            VARCHAR(50),       -- Product_Line
  car_type_desc           VARCHAR(100),      -- CarTypeDesc
  trimmed_lessee_code     VARCHAR(20),       -- TrimmedLesseeCode
  len_over_strikers       NUMERIC(10,2),     -- Len_Over_Strikers

  -- ═══════════════════════════════════════════════════════════════════
  -- PHYSICAL / WEIGHT
  -- ═══════════════════════════════════════════════════════════════════
  aar_tot_wgt_rail_lbs_qty  NUMERIC(12,2),   -- AAR_TOT_WGT_RAIL_LBS_QTY
  capacity                  NUMERIC(12,2),   -- CAPACITY
  lt_wgt_lb_qty             NUMERIC(12,2),   -- LT_WGT_LB_QTY
  load_limit_capy_kg_qty    NUMERIC(12,2),   -- LOAD_LIMIT_CAPY_KG_QTY
  load_limit_capy_lb_qty    NUMERIC(12,2),   -- LOAD_LIMIT_CAPY_LB_QTY
  truck_capy_ton_qty        NUMERIC(10,2),   -- TRUCK_CAPY_TON_QTY
  cpt_qty                   INTEGER,         -- CPT_QTY
  underframe_type_code      VARCHAR(20),     -- UNDERFRAME_TYPE_CODE
  aar_type_code             VARCHAR(20),     -- AAR_TYPE_CODE
  head_shield               VARCHAR(20),     -- Head_Shield
  truck_capacity            NUMERIC(10,2),   -- Truck_Capacity

  -- ═══════════════════════════════════════════════════════════════════
  -- DIMENSIONS
  -- ═══════════════════════════════════════════════════════════════════
  extreme_height                      NUMERIC(10,4),  -- Extreme_Height
  extreme_width                       NUMERIC(10,4),  -- Extreme_Width
  height_at_extreme_width             NUMERIC(10,4),  -- Height_At_Extreme_Width
  upper_eaves_height                  NUMERIC(10,4),  -- Upper_Eaves_Height
  upper_eaves_width                   NUMERIC(10,4),  -- Upper_Eaves_Width
  lower_eaves_height                  NUMERIC(10,4),  -- Lower_Eaves_Height
  inside_length                       NUMERIC(10,4),  -- Inside_Length
  inside_width                        NUMERIC(10,4),  -- Inside_Width
  len_over_pulling_face_of_couplers   NUMERIC(10,4),  -- Len_Over_Pulling_Face_of_Couplers
  len_center_to_center_of_trucks      NUMERIC(10,4),  -- Len_Center_to_Center_of_Trucks
  plate_clearance                     NUMERIC(10,4),  -- Plate_Clearance
  tank_length                         NUMERIC(10,4),  -- Tank_Length
  tank_diameter_end                   NUMERIC(10,4),  -- Tank_Diameter_End
  tank_diameter_center                NUMERIC(10,4),  -- Tank_Diameter_Center
  dome_or_nozzle_diameter             NUMERIC(10,4),  -- Dome_or_Nozzle_Diameter

  -- ═══════════════════════════════════════════════════════════════════
  -- TANK / HOPPER CAPACITY
  -- ═══════════════════════════════════════════════════════════════════
  gal_tank_cpt_actual_qty_a   NUMERIC(12,2),   -- GAL_TANK_CPT_ACTUAL_QTY_A
  gal_tank_cpt_actual_qty_b   NUMERIC(12,2),   -- GAL_TANK_CPT_ACTUAL_QTY_B
  gal_tank_cpt_actual_qty_c   NUMERIC(12,2),   -- GAL_TANK_CPT_ACTUAL_QTY_C
  cu_ft_hopper_cpt_qty_a      NUMERIC(12,2),   -- CU_FT_HOPPER_CPT_QTY_A
  cu_ft_hopper_cpt_qty_ac     NUMERIC(12,2),   -- CU_FT_HOPPER_CPT_QTY_AC
  cu_ft_hopper_cpt_qty_b      NUMERIC(12,2),   -- CU_FT_HOPPER_CPT_QTY_B
  cu_ft_hopper_cpt_qty_bc     NUMERIC(12,2),   -- CU_FT_HOPPER_CPT_QTY_BC
  cu_ft_hopper_cpt_qty_c      NUMERIC(12,2),   -- CU_FT_HOPPER_CPT_QTY_C
  gage_table_no               VARCHAR(20),     -- GAGE_TABLE_NO
  gage_table_no_b             VARCHAR(20),     -- GAGE_TABLE_NO_B
  gage_table_no_c             VARCHAR(20),     -- GAGE_TABLE_NO_C
  gaging_device_code          VARCHAR(20),     -- GAGING_DEVICE_CODE

  -- ═══════════════════════════════════════════════════════════════════
  -- BRAKES / AIR
  -- ═══════════════════════════════════════════════════════════════════
  aar_brake_type_code   VARCHAR(20),   -- AAR_BRAKE_TYPE_CODE
  air_brake_rptg_cd     VARCHAR(20),   -- AIR_BRAKE_RPTG_CD
  air_inlet_code        VARCHAR(20),   -- AIR_INLET_CODE

  -- ═══════════════════════════════════════════════════════════════════
  -- BOTTOM OUTLET / VALVES
  -- ═══════════════════════════════════════════════════════════════════
  bot_fit_conf_code       VARCHAR(20),     -- BOT_FIT_CONF_CODE
  bot_outlt_prot_lev_cd   VARCHAR(20),     -- BOT_OUTLT_PROT_LEV_CD
  bov_code                VARCHAR(20),     -- BOV_CODE
  bov_matl_code           VARCHAR(20),     -- BOV_MATL_CODE
  bov_size                NUMERIC(10,4),   -- BOV_SIZE
  bov_type_code           VARCHAR(20),     -- BOV_TYPE_CODE
  liquid_vlv_code         VARCHAR(20),     -- LIQUID_VLV_CODE
  liquid_vlv_qty          INTEGER,         -- LIQUID_VLV_QTY
  liquid_vlv_size         NUMERIC(10,4),   -- LIQUID_VLV_SIZE
  liquid_level_gage       VARCHAR(20),     -- LIQUID_LEVEL_GAGE

  -- ═══════════════════════════════════════════════════════════════════
  -- OUTLETS
  -- ═══════════════════════════════════════════════════════════════════
  outlet_code_a_c     VARCHAR(20),   -- OUTLET_CODE_A_C
  outlet_code_a_l     VARCHAR(20),   -- OUTLET_CODE_A_L
  outlet_code_a_r     VARCHAR(20),   -- OUTLET_CODE_A_R
  outlet_code_ac_c    VARCHAR(20),   -- OUTLET_CODE_AC_C
  outlet_code_ac_l    VARCHAR(20),   -- OUTLET_CODE_AC_L
  outlet_code_ac_r    VARCHAR(20),   -- OUTLET_CODE_AC_R
  outlet_code_b_c     VARCHAR(20),   -- OUTLET_CODE_B_C
  outlet_code_b_l     VARCHAR(20),   -- OUTLET_CODE_B_L
  outlet_code_b_r     VARCHAR(20),   -- OUTLET_CODE_B_R
  outlet_code_bc_c    VARCHAR(20),   -- OUTLET_CODE_BC_C
  outlet_code_bc_l    VARCHAR(20),   -- OUTLET_CODE_BC_L
  outlet_code_bc_r    VARCHAR(20),   -- OUTLET_CODE_BC_R
  outlet_code_c_c     VARCHAR(20),   -- OUTLET_CODE_C_C
  outlet_code_c_l     VARCHAR(20),   -- OUTLET_CODE_C_L
  outlet_code_c_r     VARCHAR(20),   -- OUTLET_CODE_C_R
  outlet_qty          INTEGER,       -- OUTLET_QTY

  -- ═══════════════════════════════════════════════════════════════════
  -- HATCHES
  -- ═══════════════════════════════════════════════════════════════════
  hatch_dia_size    NUMERIC(10,4),   -- HATCH_DIA_SIZE
  hatch_matl_code   VARCHAR(20),     -- HATCH_MATL_CODE
  hatch_qty         INTEGER,         -- HATCH_QTY
  hatch_type_code   VARCHAR(20),     -- HATCH_TYPE_CODE

  -- ═══════════════════════════════════════════════════════════════════
  -- VAPOR / VACUUM
  -- ═══════════════════════════════════════════════════════════════════
  vapor_vlv_code          VARCHAR(20),     -- VAPOR_VLV_CODE
  vapor_vlv_qty           INTEGER,         -- VAPOR_VLV_QTY
  vapor_vlv_size          NUMERIC(10,4),   -- VAPOR_VLV_SIZE
  vacuum_relief_vlv_code  VARCHAR(20),     -- VACUUM_RELIEF_VLV_CODE

  -- ═══════════════════════════════════════════════════════════════════
  -- SIPHON / THERMOMETER
  -- ═══════════════════════════════════════════════════════════════════
  siphon_code           VARCHAR(20),     -- SIPHON_CODE
  siphon_pipe_size      NUMERIC(10,4),   -- SIPHON_PIPE_SIZE
  thermometer_well_code VARCHAR(20),     -- THERMOMETER_WELL_CODE

  -- ═══════════════════════════════════════════════════════════════════
  -- INSULATION / HEAT
  -- ═══════════════════════════════════════════════════════════════════
  insul_thick_size    NUMERIC(10,4),   -- INSUL_THICK_SIZE
  insul_type_code     VARCHAR(20),     -- INSUL_TYPE_CODE
  heat_coil_matl_code VARCHAR(20),     -- HEAT_COIL_MATL_CODE

  -- ═══════════════════════════════════════════════════════════════════
  -- LINING
  -- ═══════════════════════════════════════════════════════════════════
  lining_applicator_code  VARCHAR(20),   -- LINING_APPLICATOR_CODE
  lining_applied_date     DATE,          -- LINING_APPLIED_DATE
  lining_owner_code       VARCHAR(20),   -- LINING_OWNER_CODE
  lining_type_code        VARCHAR(20),   -- LINING_TYPE_CODE
  int_lining_due_date     DATE,          -- INT_LINING_DUE_DATE
  int_lining_insp_date    DATE,          -- INT_LINING_INSP_DATE
  int_lining_perf_by_cd   VARCHAR(20),   -- INT_LINING_PERF_BY_CD
  int_lining_test_cycle   INTEGER,       -- INT_LINING_TEST_CYCLE

  -- ═══════════════════════════════════════════════════════════════════
  -- PAINT
  -- ═══════════════════════════════════════════════════════════════════
  paint_applied_date    DATE,          -- PAINT_APPLIED_DATE
  paint_applicator_code VARCHAR(20),   -- PAINT_APPLICATOR_CODE
  paint_special_code    VARCHAR(20),   -- PAINT_SPECIAL_CODE

  -- ═══════════════════════════════════════════════════════════════════
  -- SAFETY RELIEF
  -- ═══════════════════════════════════════════════════════════════════
  safety_rel_dev_1_code       VARCHAR(20),   -- SAFETY_REL_DEV_1_CODE
  safety_rel_dev_2_code       VARCHAR(20),   -- SAFETY_REL_DEV_2_CODE
  safety_rel_dev_qty          INTEGER,       -- SAFETY_REL_DEV_QTY
  safety_rel_dev_type_code    VARCHAR(20),   -- SAFETY_REL_DEV_TYPE_CODE
  safety_vlv_test_cert_no     VARCHAR(30),   -- SAFETY_VLV_TEST_CERT_NO
  safety_vlv_test_date        DATE,          -- SAFETY_VLV_TEST_DATE
  safety_vlv_test_due_date    DATE,          -- SAFETY_VLV_TEST_DUE_DATE
  safety_vlv_test_facil_code  VARCHAR(20),   -- SAFETY_VLV_TEST_FACIL_CODE
  safety_vlv_test_interv_qty  INTEGER,       -- SAFETY_VLV_TEST_INTERV_QTY

  -- ═══════════════════════════════════════════════════════════════════
  -- TANK TESTING
  -- ═══════════════════════════════════════════════════════════════════
  tank_test_cert_no           VARCHAR(30),     -- TANK_TEST_CERT_NO
  tank_test_date              DATE,            -- TANK_TEST_DATE
  tank_test_due_date          DATE,            -- TANK_TEST_DUE_DATE
  tank_test_facil_code        VARCHAR(20),     -- TANK_TEST_FACIL_CODE
  tank_test_interv_years_qty  INTEGER,         -- TANK_TEST_INTERV_YEARS_QTY
  tank_test_press_psi_qty     NUMERIC(10,2),   -- TANK_TEST_PRESS_PSI_QTY
  tank_qualif_date            DATE,            -- TANK_QUALIF_DATE
  tank_qualif_due_date        DATE,            -- TANK_QUALIF_DUE_DATE
  tank_qualif_perf_by_cd      VARCHAR(20),     -- TANK_QUALIF_PERF_BY_CD
  tank_qualif_test_cycle      INTEGER,         -- TANK_QUALIF_TEST_CYCLE
  tank_qual_insp_mile_qty     INTEGER,         -- TANK_QUAL_INSP_MILE_QTY

  -- ═══════════════════════════════════════════════════════════════════
  -- RULE 88B
  -- ═══════════════════════════════════════════════════════════════════
  rule88b_due_date        DATE,      -- RULE88B_DUE_DATE
  rule88b_inspect_date    DATE,      -- RULE88B_INSPECT_DATE
  rule88b_interv_yrs_qty  INTEGER,   -- RULE88B_INTERV_YRS_QTY

  -- ═══════════════════════════════════════════════════════════════════
  -- SERVICE EQUIPMENT
  -- ═══════════════════════════════════════════════════════════════════
  serv_equip_qual_date      DATE,          -- SERV_EQUIP_QUAL_DATE
  serv_equip_qual_due_date  DATE,          -- SERV_EQUIP_QUAL_DUE_DATE
  serv_equip_qual_prf_by_cd VARCHAR(20),   -- SERV_EQUIP_QUAL_PRF_BY_CD

  -- ═══════════════════════════════════════════════════════════════════
  -- STUB SILL
  -- ═══════════════════════════════════════════════════════════════════
  stub_sill_insp_mile_qty     INTEGER,       -- STUB_SILL_INSP_MILE_QTY
  stub_sill_insp_perf_by_cd   VARCHAR(20),   -- STUB_SILL_INSP_PERF_BY_CD
  stub_sill_inspect_date      DATE,          -- STUB_SILL_INSPECT_DATE
  stub_sill_inspect_due_date  DATE,          -- STUB_SILL_INSPECT_DUE_DATE
  stub_sill_test_cycle        INTEGER,       -- STUB_SILL_TEST_CYCLE

  -- ═══════════════════════════════════════════════════════════════════
  -- BUILDER / CERT
  -- ═══════════════════════════════════════════════════════════════════
  builder_code    VARCHAR(20),   -- BUILDER_CODE
  built_date      DATE,          -- BUILT_DATE
  cert_latest_no  VARCHAR(30),   -- CERT_LATEST_NO
  cert_orig_no    VARCHAR(30),   -- CERT_ORIG_NO

  -- ═══════════════════════════════════════════════════════════════════
  -- EFFECTIVE DATES
  -- ═══════════════════════════════════════════════════════════════════
  eff_date   DATE,   -- EFF_DATE
  exp_date   DATE,   -- EXP_DATE

  -- ═══════════════════════════════════════════════════════════════════
  -- METADATA
  -- ═══════════════════════════════════════════════════════════════════
  source_file   VARCHAR(255),
  imported_at   TIMESTAMPTZ DEFAULT NOW(),
  imported_by   UUID REFERENCES users(id),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_by    UUID REFERENCES users(id),
  version       INTEGER NOT NULL DEFAULT 1
);

-- Indexes for common lookups and compliance queries
CREATE INDEX IF NOT EXISTS idx_umler_car_id ON car_umler_attributes(car_id);
CREATE INDEX IF NOT EXISTS idx_umler_type_code ON car_umler_attributes(type_code);
CREATE INDEX IF NOT EXISTS idx_umler_lessee_code ON car_umler_attributes(lessee_code);
CREATE INDEX IF NOT EXISTS idx_umler_tank_test_due ON car_umler_attributes(tank_test_due_date);
CREATE INDEX IF NOT EXISTS idx_umler_safety_vlv_due ON car_umler_attributes(safety_vlv_test_due_date);
CREATE INDEX IF NOT EXISTS idx_umler_rule88b_due ON car_umler_attributes(rule88b_due_date);

-- Auto-increment version and update timestamp on every UPDATE
CREATE OR REPLACE FUNCTION bump_umler_version() RETURNS TRIGGER AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_umler_version_bump
  BEFORE UPDATE ON car_umler_attributes
  FOR EACH ROW EXECUTE FUNCTION bump_umler_version();

COMMIT;
