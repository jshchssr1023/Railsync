import { query, queryOne } from '../config/database';

// ============================================================================
// TYPES
// ============================================================================

export interface CarUmlerAttributes {
  id: string;
  car_id: string;
  // Identity / Commercial
  umler_car_id?: string;
  lessee_code?: string;
  type_code?: string;
  class_code?: string;
  commodity?: string;
  company_code?: string;
  contract_no?: string;
  orig_car_id?: string;
  rider_code?: string;
  lessee_invoice_code?: string;
  lettering_special_code?: string;
  lot_number?: string;
  stock_lot_number?: string;
  mileage_rate?: number;
  product_line?: string;
  car_type_desc?: string;
  trimmed_lessee_code?: string;
  len_over_strikers?: number;
  // Physical / Weight
  aar_tot_wgt_rail_lbs_qty?: number;
  capacity?: number;
  lt_wgt_lb_qty?: number;
  load_limit_capy_kg_qty?: number;
  load_limit_capy_lb_qty?: number;
  truck_capy_ton_qty?: number;
  cpt_qty?: number;
  underframe_type_code?: string;
  aar_type_code?: string;
  head_shield?: string;
  truck_capacity?: number;
  // Dimensions
  extreme_height?: number;
  extreme_width?: number;
  height_at_extreme_width?: number;
  upper_eaves_height?: number;
  upper_eaves_width?: number;
  lower_eaves_height?: number;
  inside_length?: number;
  inside_width?: number;
  len_over_pulling_face_of_couplers?: number;
  len_center_to_center_of_trucks?: number;
  plate_clearance?: number;
  tank_length?: number;
  tank_diameter_end?: number;
  tank_diameter_center?: number;
  dome_or_nozzle_diameter?: number;
  // Tank / Hopper Capacity
  gal_tank_cpt_actual_qty_a?: number;
  gal_tank_cpt_actual_qty_b?: number;
  gal_tank_cpt_actual_qty_c?: number;
  cu_ft_hopper_cpt_qty_a?: number;
  cu_ft_hopper_cpt_qty_ac?: number;
  cu_ft_hopper_cpt_qty_b?: number;
  cu_ft_hopper_cpt_qty_bc?: number;
  cu_ft_hopper_cpt_qty_c?: number;
  gage_table_no?: string;
  gage_table_no_b?: string;
  gage_table_no_c?: string;
  gaging_device_code?: string;
  // Brakes / Air
  aar_brake_type_code?: string;
  air_brake_rptg_cd?: string;
  air_inlet_code?: string;
  // Bottom Outlet / Valves
  bot_fit_conf_code?: string;
  bot_outlt_prot_lev_cd?: string;
  bov_code?: string;
  bov_matl_code?: string;
  bov_size?: number;
  bov_type_code?: string;
  liquid_vlv_code?: string;
  liquid_vlv_qty?: number;
  liquid_vlv_size?: number;
  liquid_level_gage?: string;
  // Outlets
  outlet_code_a_c?: string;
  outlet_code_a_l?: string;
  outlet_code_a_r?: string;
  outlet_code_ac_c?: string;
  outlet_code_ac_l?: string;
  outlet_code_ac_r?: string;
  outlet_code_b_c?: string;
  outlet_code_b_l?: string;
  outlet_code_b_r?: string;
  outlet_code_bc_c?: string;
  outlet_code_bc_l?: string;
  outlet_code_bc_r?: string;
  outlet_code_c_c?: string;
  outlet_code_c_l?: string;
  outlet_code_c_r?: string;
  outlet_qty?: number;
  // Hatches
  hatch_dia_size?: number;
  hatch_matl_code?: string;
  hatch_qty?: number;
  hatch_type_code?: string;
  // Vapor / Vacuum
  vapor_vlv_code?: string;
  vapor_vlv_qty?: number;
  vapor_vlv_size?: number;
  vacuum_relief_vlv_code?: string;
  // Siphon / Thermometer
  siphon_code?: string;
  siphon_pipe_size?: number;
  thermometer_well_code?: string;
  // Insulation / Heat
  insul_thick_size?: number;
  insul_type_code?: string;
  heat_coil_matl_code?: string;
  // Lining
  lining_applicator_code?: string;
  lining_applied_date?: string;
  lining_owner_code?: string;
  lining_type_code?: string;
  int_lining_due_date?: string;
  int_lining_insp_date?: string;
  int_lining_perf_by_cd?: string;
  int_lining_test_cycle?: number;
  // Paint
  paint_applied_date?: string;
  paint_applicator_code?: string;
  paint_special_code?: string;
  // Safety Relief
  safety_rel_dev_1_code?: string;
  safety_rel_dev_2_code?: string;
  safety_rel_dev_qty?: number;
  safety_rel_dev_type_code?: string;
  safety_vlv_test_cert_no?: string;
  safety_vlv_test_date?: string;
  safety_vlv_test_due_date?: string;
  safety_vlv_test_facil_code?: string;
  safety_vlv_test_interv_qty?: number;
  // Tank Testing
  tank_test_cert_no?: string;
  tank_test_date?: string;
  tank_test_due_date?: string;
  tank_test_facil_code?: string;
  tank_test_interv_years_qty?: number;
  tank_test_press_psi_qty?: number;
  tank_qualif_date?: string;
  tank_qualif_due_date?: string;
  tank_qualif_perf_by_cd?: string;
  tank_qualif_test_cycle?: number;
  tank_qual_insp_mile_qty?: number;
  // Rule 88B
  rule88b_due_date?: string;
  rule88b_inspect_date?: string;
  rule88b_interv_yrs_qty?: number;
  // Service Equipment
  serv_equip_qual_date?: string;
  serv_equip_qual_due_date?: string;
  serv_equip_qual_prf_by_cd?: string;
  // Stub Sill
  stub_sill_insp_mile_qty?: number;
  stub_sill_insp_perf_by_cd?: string;
  stub_sill_inspect_date?: string;
  stub_sill_inspect_due_date?: string;
  stub_sill_test_cycle?: number;
  // Builder / Cert
  builder_code?: string;
  built_date?: string;
  cert_latest_no?: string;
  cert_orig_no?: string;
  // Effective Dates
  eff_date?: string;
  exp_date?: string;
  // Metadata
  source_file?: string;
  imported_at?: string;
  imported_by?: string;
  updated_at?: string;
  updated_by?: string;
  version?: number;
}

// All data columns (excludes id, car_id, and metadata)
const DATA_COLUMNS = [
  'umler_car_id', 'lessee_code', 'type_code', 'class_code', 'commodity', 'company_code',
  'contract_no', 'orig_car_id', 'rider_code', 'lessee_invoice_code', 'lettering_special_code',
  'lot_number', 'stock_lot_number', 'mileage_rate', 'product_line', 'car_type_desc',
  'trimmed_lessee_code', 'len_over_strikers',
  'aar_tot_wgt_rail_lbs_qty', 'capacity', 'lt_wgt_lb_qty', 'load_limit_capy_kg_qty',
  'load_limit_capy_lb_qty', 'truck_capy_ton_qty', 'cpt_qty', 'underframe_type_code',
  'aar_type_code', 'head_shield', 'truck_capacity',
  'extreme_height', 'extreme_width', 'height_at_extreme_width', 'upper_eaves_height',
  'upper_eaves_width', 'lower_eaves_height', 'inside_length', 'inside_width',
  'len_over_pulling_face_of_couplers', 'len_center_to_center_of_trucks', 'plate_clearance',
  'tank_length', 'tank_diameter_end', 'tank_diameter_center', 'dome_or_nozzle_diameter',
  'gal_tank_cpt_actual_qty_a', 'gal_tank_cpt_actual_qty_b', 'gal_tank_cpt_actual_qty_c',
  'cu_ft_hopper_cpt_qty_a', 'cu_ft_hopper_cpt_qty_ac', 'cu_ft_hopper_cpt_qty_b',
  'cu_ft_hopper_cpt_qty_bc', 'cu_ft_hopper_cpt_qty_c', 'gage_table_no', 'gage_table_no_b',
  'gage_table_no_c', 'gaging_device_code',
  'aar_brake_type_code', 'air_brake_rptg_cd', 'air_inlet_code',
  'bot_fit_conf_code', 'bot_outlt_prot_lev_cd', 'bov_code', 'bov_matl_code', 'bov_size',
  'bov_type_code', 'liquid_vlv_code', 'liquid_vlv_qty', 'liquid_vlv_size', 'liquid_level_gage',
  'outlet_code_a_c', 'outlet_code_a_l', 'outlet_code_a_r', 'outlet_code_ac_c', 'outlet_code_ac_l',
  'outlet_code_ac_r', 'outlet_code_b_c', 'outlet_code_b_l', 'outlet_code_b_r', 'outlet_code_bc_c',
  'outlet_code_bc_l', 'outlet_code_bc_r', 'outlet_code_c_c', 'outlet_code_c_l', 'outlet_code_c_r',
  'outlet_qty',
  'hatch_dia_size', 'hatch_matl_code', 'hatch_qty', 'hatch_type_code',
  'vapor_vlv_code', 'vapor_vlv_qty', 'vapor_vlv_size', 'vacuum_relief_vlv_code',
  'siphon_code', 'siphon_pipe_size', 'thermometer_well_code',
  'insul_thick_size', 'insul_type_code', 'heat_coil_matl_code',
  'lining_applicator_code', 'lining_applied_date', 'lining_owner_code', 'lining_type_code',
  'int_lining_due_date', 'int_lining_insp_date', 'int_lining_perf_by_cd', 'int_lining_test_cycle',
  'paint_applied_date', 'paint_applicator_code', 'paint_special_code',
  'safety_rel_dev_1_code', 'safety_rel_dev_2_code', 'safety_rel_dev_qty',
  'safety_rel_dev_type_code', 'safety_vlv_test_cert_no', 'safety_vlv_test_date',
  'safety_vlv_test_due_date', 'safety_vlv_test_facil_code', 'safety_vlv_test_interv_qty',
  'tank_test_cert_no', 'tank_test_date', 'tank_test_due_date', 'tank_test_facil_code',
  'tank_test_interv_years_qty', 'tank_test_press_psi_qty', 'tank_qualif_date',
  'tank_qualif_due_date', 'tank_qualif_perf_by_cd', 'tank_qualif_test_cycle',
  'tank_qual_insp_mile_qty',
  'rule88b_due_date', 'rule88b_inspect_date', 'rule88b_interv_yrs_qty',
  'serv_equip_qual_date', 'serv_equip_qual_due_date', 'serv_equip_qual_prf_by_cd',
  'stub_sill_insp_mile_qty', 'stub_sill_insp_perf_by_cd', 'stub_sill_inspect_date',
  'stub_sill_inspect_due_date', 'stub_sill_test_cycle',
  'builder_code', 'built_date', 'cert_latest_no', 'cert_orig_no',
  'eff_date', 'exp_date',
] as const;

// CSV header → DB column mapping
const CSV_TO_DB: Record<string, string> = {
  'CAR_ID': 'umler_car_id',
  'LESSEE_CODE': 'lessee_code',
  'TYPE_CODE': 'type_code',
  'CLASS_CODE': 'class_code',
  'COMMODITY': 'commodity',
  'COMPANY_CODE': 'company_code',
  'CONTRACT_NO': 'contract_no',
  'ORIG_CAR_ID': 'orig_car_id',
  'RIDER_CODE': 'rider_code',
  'LESSEE_INVOICE_CODE': 'lessee_invoice_code',
  'LETTERING_SPECIAL_CODE': 'lettering_special_code',
  'LOT_NUMBER': 'lot_number',
  'STOCK_LOT_NUMBER': 'stock_lot_number',
  'MILAGE_RATE': 'mileage_rate',
  'Product_Line': 'product_line',
  'CarTypeDesc': 'car_type_desc',
  'TrimmedLesseeCode': 'trimmed_lessee_code',
  'Len_Over_Strikers': 'len_over_strikers',
  'AAR_TOT_WGT_RAIL_LBS_QTY': 'aar_tot_wgt_rail_lbs_qty',
  'CAPACITY': 'capacity',
  'LT_WGT_LB_QTY': 'lt_wgt_lb_qty',
  'LOAD_LIMIT_CAPY_KG_QTY': 'load_limit_capy_kg_qty',
  'LOAD_LIMIT_CAPY_LB_QTY': 'load_limit_capy_lb_qty',
  'TRUCK_CAPY_TON_QTY': 'truck_capy_ton_qty',
  'CPT_QTY': 'cpt_qty',
  'UNDERFRAME_TYPE_CODE': 'underframe_type_code',
  'AAR_TYPE_CODE': 'aar_type_code',
  'Head_Shield': 'head_shield',
  'Truck_Capacity': 'truck_capacity',
  'Extreme_Height': 'extreme_height',
  'Extreme_Width': 'extreme_width',
  'Height_At_Extreme_Width': 'height_at_extreme_width',
  'Upper_Eaves_Height': 'upper_eaves_height',
  'Upper_Eaves_Width': 'upper_eaves_width',
  'Lower_Eaves_Height': 'lower_eaves_height',
  'Inside_Length': 'inside_length',
  'Inside_Width': 'inside_width',
  'Len_Over_Pulling_Face_of_Couplers': 'len_over_pulling_face_of_couplers',
  'Len_Center_to_Center_of_Trucks': 'len_center_to_center_of_trucks',
  'Plate_Clearance': 'plate_clearance',
  'Tank_Length': 'tank_length',
  'Tank_Diameter_End': 'tank_diameter_end',
  'Tank_Diameter_Center': 'tank_diameter_center',
  'Dome_or_Nozzle_Diameter': 'dome_or_nozzle_diameter',
  'GAL_TANK_CPT_ACTUAL_QTY_A': 'gal_tank_cpt_actual_qty_a',
  'GAL_TANK_CPT_ACTUAL_QTY_B': 'gal_tank_cpt_actual_qty_b',
  'GAL_TANK_CPT_ACTUAL_QTY_C': 'gal_tank_cpt_actual_qty_c',
  'CU_FT_HOPPER_CPT_QTY_A': 'cu_ft_hopper_cpt_qty_a',
  'CU_FT_HOPPER_CPT_QTY_AC': 'cu_ft_hopper_cpt_qty_ac',
  'CU_FT_HOPPER_CPT_QTY_B': 'cu_ft_hopper_cpt_qty_b',
  'CU_FT_HOPPER_CPT_QTY_BC': 'cu_ft_hopper_cpt_qty_bc',
  'CU_FT_HOPPER_CPT_QTY_C': 'cu_ft_hopper_cpt_qty_c',
  'GAGE_TABLE_NO': 'gage_table_no',
  'GAGE_TABLE_NO_B': 'gage_table_no_b',
  'GAGE_TABLE_NO_C': 'gage_table_no_c',
  'GAGING_DEVICE_CODE': 'gaging_device_code',
  'AAR_BRAKE_TYPE_CODE': 'aar_brake_type_code',
  'AIR_BRAKE_RPTG_CD': 'air_brake_rptg_cd',
  'AIR_INLET_CODE': 'air_inlet_code',
  'BOT_FIT_CONF_CODE': 'bot_fit_conf_code',
  'BOT_OUTLT_PROT_LEV_CD': 'bot_outlt_prot_lev_cd',
  'BOV_CODE': 'bov_code',
  'BOV_MATL_CODE': 'bov_matl_code',
  'BOV_SIZE': 'bov_size',
  'BOV_TYPE_CODE': 'bov_type_code',
  'LIQUID_VLV_CODE': 'liquid_vlv_code',
  'LIQUID_VLV_QTY': 'liquid_vlv_qty',
  'LIQUID_VLV_SIZE': 'liquid_vlv_size',
  'LIQUID_LEVEL_GAGE': 'liquid_level_gage',
  'OUTLET_CODE_A_C': 'outlet_code_a_c',
  'OUTLET_CODE_A_L': 'outlet_code_a_l',
  'OUTLET_CODE_A_R': 'outlet_code_a_r',
  'OUTLET_CODE_AC_C': 'outlet_code_ac_c',
  'OUTLET_CODE_AC_L': 'outlet_code_ac_l',
  'OUTLET_CODE_AC_R': 'outlet_code_ac_r',
  'OUTLET_CODE_B_C': 'outlet_code_b_c',
  'OUTLET_CODE_B_L': 'outlet_code_b_l',
  'OUTLET_CODE_B_R': 'outlet_code_b_r',
  'OUTLET_CODE_BC_C': 'outlet_code_bc_c',
  'OUTLET_CODE_BC_L': 'outlet_code_bc_l',
  'OUTLET_CODE_BC_R': 'outlet_code_bc_r',
  'OUTLET_CODE_C_C': 'outlet_code_c_c',
  'OUTLET_CODE_C_L': 'outlet_code_c_l',
  'OUTLET_CODE_C_R': 'outlet_code_c_r',
  'OUTLET_QTY': 'outlet_qty',
  'HATCH_DIA_SIZE': 'hatch_dia_size',
  'HATCH_MATL_CODE': 'hatch_matl_code',
  'HATCH_QTY': 'hatch_qty',
  'HATCH_TYPE_CODE': 'hatch_type_code',
  'VAPOR_VLV_CODE': 'vapor_vlv_code',
  'VAPOR_VLV_QTY': 'vapor_vlv_qty',
  'VAPOR_VLV_SIZE': 'vapor_vlv_size',
  'VACUUM_RELIEF_VLV_CODE': 'vacuum_relief_vlv_code',
  'SIPHON_CODE': 'siphon_code',
  'SIPHON_PIPE_SIZE': 'siphon_pipe_size',
  'THERMOMETER_WELL_CODE': 'thermometer_well_code',
  'INSUL_THICK_SIZE': 'insul_thick_size',
  'INSUL_TYPE_CODE': 'insul_type_code',
  'HEAT_COIL_MATL_CODE': 'heat_coil_matl_code',
  'LINING_APPLICATOR_CODE': 'lining_applicator_code',
  'LINING_APPLIED_DATE': 'lining_applied_date',
  'LINING_OWNER_CODE': 'lining_owner_code',
  'LINING_TYPE_CODE': 'lining_type_code',
  'INT_LINING_DUE_DATE': 'int_lining_due_date',
  'INT_LINING_INSP_DATE': 'int_lining_insp_date',
  'INT_LINING_PERF_BY_CD': 'int_lining_perf_by_cd',
  'INT_LINING_TEST_CYCLE': 'int_lining_test_cycle',
  'PAINT_APPLIED_DATE': 'paint_applied_date',
  'PAINT_APPLICATOR_CODE': 'paint_applicator_code',
  'PAINT_SPECIAL_CODE': 'paint_special_code',
  'SAFETY_REL_DEV_1_CODE': 'safety_rel_dev_1_code',
  'SAFETY_REL_DEV_2_CODE': 'safety_rel_dev_2_code',
  'SAFETY_REL_DEV_QTY': 'safety_rel_dev_qty',
  'SAFETY_REL_DEV_TYPE_CODE': 'safety_rel_dev_type_code',
  'SAFETY_VLV_TEST_CERT_NO': 'safety_vlv_test_cert_no',
  'SAFETY_VLV_TEST_DATE': 'safety_vlv_test_date',
  'SAFETY_VLV_TEST_DUE_DATE': 'safety_vlv_test_due_date',
  'SAFETY_VLV_TEST_FACIL_CODE': 'safety_vlv_test_facil_code',
  'SAFETY_VLV_TEST_INTERV_QTY': 'safety_vlv_test_interv_qty',
  'TANK_TEST_CERT_NO': 'tank_test_cert_no',
  'TANK_TEST_DATE': 'tank_test_date',
  'TANK_TEST_DUE_DATE': 'tank_test_due_date',
  'TANK_TEST_FACIL_CODE': 'tank_test_facil_code',
  'TANK_TEST_INTERV_YEARS_QTY': 'tank_test_interv_years_qty',
  'TANK_TEST_PRESS_PSI_QTY': 'tank_test_press_psi_qty',
  'TANK_QUALIF_DATE': 'tank_qualif_date',
  'TANK_QUALIF_DUE_DATE': 'tank_qualif_due_date',
  'TANK_QUALIF_PERF_BY_CD': 'tank_qualif_perf_by_cd',
  'TANK_QUALIF_TEST_CYCLE': 'tank_qualif_test_cycle',
  'TANK_QUAL_INSP_MILE_QTY': 'tank_qual_insp_mile_qty',
  'RULE88B_DUE_DATE': 'rule88b_due_date',
  'RULE88B_INSPECT_DATE': 'rule88b_inspect_date',
  'RULE88B_INTERV_YRS_QTY': 'rule88b_interv_yrs_qty',
  'SERV_EQUIP_QUAL_DATE': 'serv_equip_qual_date',
  'SERV_EQUIP_QUAL_DUE_DATE': 'serv_equip_qual_due_date',
  'SERV_EQUIP_QUAL_PRF_BY_CD': 'serv_equip_qual_prf_by_cd',
  'STUB_SILL_INSP_MILE_QTY': 'stub_sill_insp_mile_qty',
  'STUB_SILL_INSP_PERF_BY_CD': 'stub_sill_insp_perf_by_cd',
  'STUB_SILL_INSPECT_DATE': 'stub_sill_inspect_date',
  'STUB_SILL_INSPECT_DUE_DATE': 'stub_sill_inspect_due_date',
  'STUB_SILL_TEST_CYCLE': 'stub_sill_test_cycle',
  'BUILDER_CODE': 'builder_code',
  'BUILT_DATE': 'built_date',
  'CERT_LATEST_NO': 'cert_latest_no',
  'CERT_ORIG_NO': 'cert_orig_no',
  'EFF_DATE': 'eff_date',
  'EXP_DATE': 'exp_date',
};

// Numeric columns (for parsing)
const NUMERIC_COLUMNS = new Set([
  'mileage_rate', 'len_over_strikers',
  'aar_tot_wgt_rail_lbs_qty', 'capacity', 'lt_wgt_lb_qty', 'load_limit_capy_kg_qty',
  'load_limit_capy_lb_qty', 'truck_capy_ton_qty', 'truck_capacity',
  'extreme_height', 'extreme_width', 'height_at_extreme_width', 'upper_eaves_height',
  'upper_eaves_width', 'lower_eaves_height', 'inside_length', 'inside_width',
  'len_over_pulling_face_of_couplers', 'len_center_to_center_of_trucks', 'plate_clearance',
  'tank_length', 'tank_diameter_end', 'tank_diameter_center', 'dome_or_nozzle_diameter',
  'gal_tank_cpt_actual_qty_a', 'gal_tank_cpt_actual_qty_b', 'gal_tank_cpt_actual_qty_c',
  'cu_ft_hopper_cpt_qty_a', 'cu_ft_hopper_cpt_qty_ac', 'cu_ft_hopper_cpt_qty_b',
  'cu_ft_hopper_cpt_qty_bc', 'cu_ft_hopper_cpt_qty_c',
  'bov_size', 'liquid_vlv_size', 'vapor_vlv_size', 'siphon_pipe_size',
  'hatch_dia_size', 'insul_thick_size', 'tank_test_press_psi_qty',
]);

const INTEGER_COLUMNS = new Set([
  'cpt_qty', 'liquid_vlv_qty', 'outlet_qty', 'hatch_qty', 'vapor_vlv_qty',
  'safety_rel_dev_qty', 'safety_vlv_test_interv_qty', 'int_lining_test_cycle',
  'tank_test_interv_years_qty', 'tank_qualif_test_cycle', 'tank_qual_insp_mile_qty',
  'rule88b_interv_yrs_qty', 'stub_sill_insp_mile_qty', 'stub_sill_test_cycle',
]);

const DATE_COLUMNS = new Set([
  'lining_applied_date', 'int_lining_due_date', 'int_lining_insp_date',
  'paint_applied_date', 'safety_vlv_test_date', 'safety_vlv_test_due_date',
  'tank_test_date', 'tank_test_due_date', 'tank_qualif_date', 'tank_qualif_due_date',
  'rule88b_due_date', 'rule88b_inspect_date',
  'serv_equip_qual_date', 'serv_equip_qual_due_date',
  'stub_sill_inspect_date', 'stub_sill_inspect_due_date',
  'built_date', 'eff_date', 'exp_date',
]);

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get UMLER attributes by car number
 */
export async function findByCarNumber(carNumber: string): Promise<CarUmlerAttributes | null> {
  return queryOne<CarUmlerAttributes>(
    `SELECT u.* FROM car_umler_attributes u
     JOIN cars c ON c.id = u.car_id
     WHERE c.car_number = $1`,
    [carNumber]
  );
}

/**
 * Create or update UMLER attributes for a car (idempotent upsert)
 */
export async function upsert(
  carNumber: string,
  data: Partial<CarUmlerAttributes>,
  userId?: string
): Promise<CarUmlerAttributes | null> {
  // Resolve car_number → cars.id
  const car = await queryOne<{ id: string }>('SELECT id FROM cars WHERE car_number = $1', [carNumber]);
  if (!car) return null;

  // Build column/value arrays from provided data, only for known data columns
  const cols: string[] = [];
  const vals: any[] = [];
  let idx = 2; // $1 = car_id

  for (const col of DATA_COLUMNS) {
    if (col in data && data[col as keyof CarUmlerAttributes] !== undefined) {
      cols.push(col);
      vals.push(data[col as keyof CarUmlerAttributes]);
      idx++;
    }
  }

  if (cols.length === 0) return findByCarNumber(carNumber);

  // Add metadata
  if (userId) {
    cols.push('imported_by');
    vals.push(userId);
    idx++;
  }

  const colList = ['car_id', ...cols].join(', ');
  const valPlaceholders = ['$1', ...cols.map((_, i) => `$${i + 2}`)].join(', ');
  const updateSet = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');

  const sql = `
    INSERT INTO car_umler_attributes (${colList})
    VALUES (${valPlaceholders})
    ON CONFLICT (car_id) DO UPDATE SET ${updateSet}
    RETURNING *
  `;

  return queryOne<CarUmlerAttributes>(sql, [car.id, ...vals]);
}

// ============================================================================
// CSV IMPORT
// ============================================================================

interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: string[];
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseDate(value: string): string | null {
  if (!value || value.trim() === '') return null;
  // MM/DD/YYYY
  const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

function parseNumeric(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const n = parseFloat(value.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function parseInt2(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const n = parseInt(value, 10);
  return isNaN(n) ? null : n;
}

function mapCSVRow(row: Record<string, string>): Partial<CarUmlerAttributes> {
  const result: Record<string, any> = {};
  for (const [csvHeader, dbCol] of Object.entries(CSV_TO_DB)) {
    const raw = row[csvHeader];
    if (raw === undefined || raw === '') continue;

    if (DATE_COLUMNS.has(dbCol)) {
      const d = parseDate(raw);
      if (d) result[dbCol] = d;
    } else if (INTEGER_COLUMNS.has(dbCol)) {
      const n = parseInt2(raw);
      if (n !== null) result[dbCol] = n;
    } else if (NUMERIC_COLUMNS.has(dbCol)) {
      const n = parseNumeric(raw);
      if (n !== null) result[dbCol] = n;
    } else {
      result[dbCol] = raw;
    }
  }
  return result as Partial<CarUmlerAttributes>;
}

/**
 * Import UMLER attributes from CSV content.
 * Resolves cars by CAR_ID (UMLER identifier) falling back to car_number.
 */
export async function importCSV(content: string, userId?: string): Promise<ImportResult> {
  const lines = content.split('\n');
  if (lines.length < 2) return { total: 0, imported: 0, skipped: 0, errors: [] };

  const headers = parseCSVLine(lines[0]);
  const result: ImportResult = { total: 0, imported: 0, skipped: 0, errors: [] };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    result.total++;

    try {
      const values = parseCSVLine(line);
      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length && j < values.length; j++) {
        row[headers[j].trim()] = values[j];
      }

      const carId = row['CAR_ID'] || '';
      if (!carId) {
        result.errors.push(`Row ${i + 1}: Missing CAR_ID`);
        result.skipped++;
        continue;
      }

      // Resolve to car_number — try car_id column first, then car_number
      const car = await queryOne<{ car_number: string }>(
        `SELECT car_number FROM cars WHERE car_id = $1 OR car_number = $1`,
        [carId]
      );

      if (!car) {
        result.skipped++;
        continue;
      }

      const data = mapCSVRow(row);
      data.source_file = 'csv_import';

      await upsert(car.car_number, data, userId);
      result.imported++;
    } catch (err: any) {
      result.errors.push(`Row ${i + 1}: ${err.message}`);
    }
  }

  return result;
}
