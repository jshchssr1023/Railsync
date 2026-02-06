'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

// ============================================================================
// Field Definitions — categorized for rendering
// ============================================================================

interface FieldDef {
  key: string;
  label: string;
  format?: 'text' | 'number' | 'date' | 'integer';
}

interface SectionDef {
  id: string;
  title: string;
  fields: FieldDef[];
}

const UMLER_SECTIONS: SectionDef[] = [
  {
    id: 'identity',
    title: 'Identity & Commercial',
    fields: [
      { key: 'umler_car_id', label: 'UMLER Car ID' },
      { key: 'lessee_code', label: 'Lessee Code' },
      { key: 'trimmed_lessee_code', label: 'Trimmed Lessee Code' },
      { key: 'lessee_invoice_code', label: 'Lessee Invoice Code' },
      { key: 'type_code', label: 'Type Code' },
      { key: 'class_code', label: 'Class Code' },
      { key: 'aar_type_code', label: 'AAR Type Code' },
      { key: 'commodity', label: 'Commodity' },
      { key: 'company_code', label: 'Company Code' },
      { key: 'contract_no', label: 'Contract No' },
      { key: 'rider_code', label: 'Rider Code' },
      { key: 'orig_car_id', label: 'Original Car ID' },
      { key: 'lot_number', label: 'Lot Number' },
      { key: 'stock_lot_number', label: 'Stock Lot Number' },
      { key: 'lettering_special_code', label: 'Lettering Special Code' },
      { key: 'mileage_rate', label: 'Mileage Rate', format: 'number' },
      { key: 'product_line', label: 'Product Line' },
      { key: 'car_type_desc', label: 'Car Type Description' },
    ],
  },
  {
    id: 'builder',
    title: 'Builder & Certification',
    fields: [
      { key: 'builder_code', label: 'Builder Code' },
      { key: 'built_date', label: 'Built Date', format: 'date' },
      { key: 'cert_orig_no', label: 'Cert Original No' },
      { key: 'cert_latest_no', label: 'Cert Latest No' },
      { key: 'eff_date', label: 'Effective Date', format: 'date' },
      { key: 'exp_date', label: 'Expiration Date', format: 'date' },
    ],
  },
  {
    id: 'physical',
    title: 'Physical & Weight',
    fields: [
      { key: 'aar_tot_wgt_rail_lbs_qty', label: 'AAR Total Weight (lbs)', format: 'number' },
      { key: 'lt_wgt_lb_qty', label: 'Light Weight (lbs)', format: 'number' },
      { key: 'capacity', label: 'Capacity', format: 'number' },
      { key: 'load_limit_capy_lb_qty', label: 'Load Limit (lbs)', format: 'number' },
      { key: 'load_limit_capy_kg_qty', label: 'Load Limit (kg)', format: 'number' },
      { key: 'truck_capy_ton_qty', label: 'Truck Capacity (tons)', format: 'number' },
      { key: 'truck_capacity', label: 'Truck Capacity', format: 'number' },
      { key: 'cpt_qty', label: 'Compartment Qty', format: 'integer' },
      { key: 'underframe_type_code', label: 'Underframe Type' },
      { key: 'head_shield', label: 'Head Shield' },
      { key: 'len_over_strikers', label: 'Length Over Strikers', format: 'number' },
    ],
  },
  {
    id: 'dimensions',
    title: 'Dimensions',
    fields: [
      { key: 'extreme_height', label: 'Extreme Height', format: 'number' },
      { key: 'extreme_width', label: 'Extreme Width', format: 'number' },
      { key: 'height_at_extreme_width', label: 'Height at Extreme Width', format: 'number' },
      { key: 'upper_eaves_height', label: 'Upper Eaves Height', format: 'number' },
      { key: 'upper_eaves_width', label: 'Upper Eaves Width', format: 'number' },
      { key: 'lower_eaves_height', label: 'Lower Eaves Height', format: 'number' },
      { key: 'inside_length', label: 'Inside Length', format: 'number' },
      { key: 'inside_width', label: 'Inside Width', format: 'number' },
      { key: 'len_over_pulling_face_of_couplers', label: 'Length Over Pulling Face', format: 'number' },
      { key: 'len_center_to_center_of_trucks', label: 'Center-to-Center of Trucks', format: 'number' },
      { key: 'plate_clearance', label: 'Plate Clearance', format: 'number' },
      { key: 'tank_length', label: 'Tank Length', format: 'number' },
      { key: 'tank_diameter_end', label: 'Tank Diameter (End)', format: 'number' },
      { key: 'tank_diameter_center', label: 'Tank Diameter (Center)', format: 'number' },
      { key: 'dome_or_nozzle_diameter', label: 'Dome/Nozzle Diameter', format: 'number' },
    ],
  },
  {
    id: 'tank_hopper',
    title: 'Tank & Hopper Capacity',
    fields: [
      { key: 'gal_tank_cpt_actual_qty_a', label: 'Tank Capacity A (gal)', format: 'number' },
      { key: 'gal_tank_cpt_actual_qty_b', label: 'Tank Capacity B (gal)', format: 'number' },
      { key: 'gal_tank_cpt_actual_qty_c', label: 'Tank Capacity C (gal)', format: 'number' },
      { key: 'cu_ft_hopper_cpt_qty_a', label: 'Hopper Capacity A (cu ft)', format: 'number' },
      { key: 'cu_ft_hopper_cpt_qty_ac', label: 'Hopper Capacity A+C (cu ft)', format: 'number' },
      { key: 'cu_ft_hopper_cpt_qty_b', label: 'Hopper Capacity B (cu ft)', format: 'number' },
      { key: 'cu_ft_hopper_cpt_qty_bc', label: 'Hopper Capacity B+C (cu ft)', format: 'number' },
      { key: 'cu_ft_hopper_cpt_qty_c', label: 'Hopper Capacity C (cu ft)', format: 'number' },
      { key: 'gage_table_no', label: 'Gage Table No' },
      { key: 'gage_table_no_b', label: 'Gage Table No B' },
      { key: 'gage_table_no_c', label: 'Gage Table No C' },
      { key: 'gaging_device_code', label: 'Gaging Device Code' },
    ],
  },
  {
    id: 'brakes',
    title: 'Brakes & Air',
    fields: [
      { key: 'aar_brake_type_code', label: 'AAR Brake Type' },
      { key: 'air_brake_rptg_cd', label: 'Air Brake Reporting Code' },
      { key: 'air_inlet_code', label: 'Air Inlet Code' },
    ],
  },
  {
    id: 'bottom_outlet',
    title: 'Bottom Outlet & Valves',
    fields: [
      { key: 'bot_fit_conf_code', label: 'Bottom Fitting Config' },
      { key: 'bot_outlt_prot_lev_cd', label: 'Bottom Outlet Protection Level' },
      { key: 'bov_code', label: 'BOV Code' },
      { key: 'bov_matl_code', label: 'BOV Material' },
      { key: 'bov_size', label: 'BOV Size', format: 'number' },
      { key: 'bov_type_code', label: 'BOV Type' },
      { key: 'liquid_vlv_code', label: 'Liquid Valve Code' },
      { key: 'liquid_vlv_qty', label: 'Liquid Valve Qty', format: 'integer' },
      { key: 'liquid_vlv_size', label: 'Liquid Valve Size', format: 'number' },
      { key: 'liquid_level_gage', label: 'Liquid Level Gage' },
    ],
  },
  {
    id: 'outlets',
    title: 'Outlets',
    fields: [
      { key: 'outlet_qty', label: 'Total Outlet Qty', format: 'integer' },
      { key: 'outlet_code_a_c', label: 'Outlet A Center' },
      { key: 'outlet_code_a_l', label: 'Outlet A Left' },
      { key: 'outlet_code_a_r', label: 'Outlet A Right' },
      { key: 'outlet_code_ac_c', label: 'Outlet A+C Center' },
      { key: 'outlet_code_ac_l', label: 'Outlet A+C Left' },
      { key: 'outlet_code_ac_r', label: 'Outlet A+C Right' },
      { key: 'outlet_code_b_c', label: 'Outlet B Center' },
      { key: 'outlet_code_b_l', label: 'Outlet B Left' },
      { key: 'outlet_code_b_r', label: 'Outlet B Right' },
      { key: 'outlet_code_bc_c', label: 'Outlet B+C Center' },
      { key: 'outlet_code_bc_l', label: 'Outlet B+C Left' },
      { key: 'outlet_code_bc_r', label: 'Outlet B+C Right' },
      { key: 'outlet_code_c_c', label: 'Outlet C Center' },
      { key: 'outlet_code_c_l', label: 'Outlet C Left' },
      { key: 'outlet_code_c_r', label: 'Outlet C Right' },
    ],
  },
  {
    id: 'hatches',
    title: 'Hatches',
    fields: [
      { key: 'hatch_qty', label: 'Hatch Qty', format: 'integer' },
      { key: 'hatch_dia_size', label: 'Hatch Diameter', format: 'number' },
      { key: 'hatch_matl_code', label: 'Hatch Material' },
      { key: 'hatch_type_code', label: 'Hatch Type' },
    ],
  },
  {
    id: 'vapor',
    title: 'Vapor & Vacuum',
    fields: [
      { key: 'vapor_vlv_code', label: 'Vapor Valve Code' },
      { key: 'vapor_vlv_qty', label: 'Vapor Valve Qty', format: 'integer' },
      { key: 'vapor_vlv_size', label: 'Vapor Valve Size', format: 'number' },
      { key: 'vacuum_relief_vlv_code', label: 'Vacuum Relief Valve' },
    ],
  },
  {
    id: 'siphon',
    title: 'Siphon & Thermometer',
    fields: [
      { key: 'siphon_code', label: 'Siphon Code' },
      { key: 'siphon_pipe_size', label: 'Siphon Pipe Size', format: 'number' },
      { key: 'thermometer_well_code', label: 'Thermometer Well' },
    ],
  },
  {
    id: 'insulation',
    title: 'Insulation & Heat',
    fields: [
      { key: 'insul_type_code', label: 'Insulation Type' },
      { key: 'insul_thick_size', label: 'Insulation Thickness', format: 'number' },
      { key: 'heat_coil_matl_code', label: 'Heat Coil Material' },
    ],
  },
  {
    id: 'lining',
    title: 'Lining',
    fields: [
      { key: 'lining_type_code', label: 'Lining Type' },
      { key: 'lining_applied_date', label: 'Lining Applied', format: 'date' },
      { key: 'lining_applicator_code', label: 'Lining Applicator' },
      { key: 'lining_owner_code', label: 'Lining Owner' },
      { key: 'int_lining_insp_date', label: 'Interior Lining Inspected', format: 'date' },
      { key: 'int_lining_due_date', label: 'Interior Lining Due', format: 'date' },
      { key: 'int_lining_perf_by_cd', label: 'Interior Lining Performed By' },
      { key: 'int_lining_test_cycle', label: 'Interior Lining Test Cycle', format: 'integer' },
    ],
  },
  {
    id: 'paint',
    title: 'Paint',
    fields: [
      { key: 'paint_applied_date', label: 'Paint Applied', format: 'date' },
      { key: 'paint_applicator_code', label: 'Paint Applicator' },
      { key: 'paint_special_code', label: 'Paint Special Code' },
    ],
  },
  {
    id: 'safety',
    title: 'Safety Relief Devices',
    fields: [
      { key: 'safety_rel_dev_type_code', label: 'Device Type' },
      { key: 'safety_rel_dev_1_code', label: 'Device 1 Code' },
      { key: 'safety_rel_dev_2_code', label: 'Device 2 Code' },
      { key: 'safety_rel_dev_qty', label: 'Device Qty', format: 'integer' },
      { key: 'safety_vlv_test_date', label: 'Safety Valve Test Date', format: 'date' },
      { key: 'safety_vlv_test_due_date', label: 'Safety Valve Test Due', format: 'date' },
      { key: 'safety_vlv_test_cert_no', label: 'Safety Valve Test Cert' },
      { key: 'safety_vlv_test_facil_code', label: 'Safety Valve Test Facility' },
      { key: 'safety_vlv_test_interv_qty', label: 'Test Interval (years)', format: 'integer' },
    ],
  },
  {
    id: 'tank_test',
    title: 'Tank Testing',
    fields: [
      { key: 'tank_test_date', label: 'Tank Test Date', format: 'date' },
      { key: 'tank_test_due_date', label: 'Tank Test Due', format: 'date' },
      { key: 'tank_test_cert_no', label: 'Tank Test Cert' },
      { key: 'tank_test_facil_code', label: 'Tank Test Facility' },
      { key: 'tank_test_interv_years_qty', label: 'Test Interval (years)', format: 'integer' },
      { key: 'tank_test_press_psi_qty', label: 'Test Pressure (PSI)', format: 'number' },
      { key: 'tank_qualif_date', label: 'Tank Qualification Date', format: 'date' },
      { key: 'tank_qualif_due_date', label: 'Tank Qualification Due', format: 'date' },
      { key: 'tank_qualif_perf_by_cd', label: 'Tank Qual Performed By' },
      { key: 'tank_qualif_test_cycle', label: 'Tank Qual Test Cycle', format: 'integer' },
      { key: 'tank_qual_insp_mile_qty', label: 'Tank Qual Inspect Miles', format: 'integer' },
    ],
  },
  {
    id: 'rule88b',
    title: 'Rule 88B',
    fields: [
      { key: 'rule88b_inspect_date', label: 'Inspect Date', format: 'date' },
      { key: 'rule88b_due_date', label: 'Due Date', format: 'date' },
      { key: 'rule88b_interv_yrs_qty', label: 'Interval (years)', format: 'integer' },
    ],
  },
  {
    id: 'serv_equip',
    title: 'Service Equipment',
    fields: [
      { key: 'serv_equip_qual_date', label: 'Qualification Date', format: 'date' },
      { key: 'serv_equip_qual_due_date', label: 'Qualification Due', format: 'date' },
      { key: 'serv_equip_qual_prf_by_cd', label: 'Performed By' },
    ],
  },
  {
    id: 'stub_sill',
    title: 'Stub Sill',
    fields: [
      { key: 'stub_sill_inspect_date', label: 'Inspect Date', format: 'date' },
      { key: 'stub_sill_inspect_due_date', label: 'Inspect Due', format: 'date' },
      { key: 'stub_sill_insp_perf_by_cd', label: 'Performed By' },
      { key: 'stub_sill_insp_mile_qty', label: 'Inspect Miles', format: 'integer' },
      { key: 'stub_sill_test_cycle', label: 'Test Cycle', format: 'integer' },
    ],
  },
];

// ============================================================================
// Formatters
// ============================================================================

function formatValue(value: any, format?: string): string {
  if (value === null || value === undefined || value === '') return '';

  switch (format) {
    case 'date': {
      const s = String(value);
      if (s.length >= 10) return s.slice(0, 10);
      return s;
    }
    case 'number': {
      const n = Number(value);
      if (isNaN(n)) return String(value);
      return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
    }
    case 'integer': {
      const n = Number(value);
      if (isNaN(n)) return String(value);
      return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
    default:
      return String(value);
  }
}

// ============================================================================
// Component
// ============================================================================

interface UmlerSpecSectionProps {
  data: Record<string, any> | null;
  loading: boolean;
}

export default function UmlerSpecSection({ data, loading }: UmlerSpecSectionProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (id: string) =>
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-xs text-gray-500 text-center py-3">
        No UMLER data available for this car.
      </div>
    );
  }

  // Filter sections to only those with at least one value
  const populatedSections = UMLER_SECTIONS.map(section => ({
    ...section,
    fields: section.fields.filter(f => {
      const v = data[f.key];
      return v !== null && v !== undefined && v !== '';
    }),
  })).filter(section => section.fields.length > 0);

  if (populatedSections.length === 0) {
    return (
      <div className="text-xs text-gray-500 text-center py-3">
        No UMLER data available for this car.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {data.version && (
        <div className="text-[10px] text-gray-400 mb-2">
          Version {data.version}
          {data.updated_at && <> &middot; Updated {String(data.updated_at).slice(0, 10)}</>}
        </div>
      )}

      {populatedSections.map(section => (
        <div key={section.id}>
          <button
            onClick={() => toggleGroup(section.id)}
            className="w-full flex items-center justify-between py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <span>{section.title}</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-400">{section.fields.length}</span>
              {expandedGroups.has(section.id) ? (
                <ChevronDown className="w-3 h-3 text-gray-400" />
              ) : (
                <ChevronRight className="w-3 h-3 text-gray-400" />
              )}
            </div>
          </button>

          {expandedGroups.has(section.id) && (
            <div className="ml-1 mb-2 border-l-2 border-gray-100 dark:border-gray-700 pl-2">
              {section.fields.map(field => (
                <div key={field.key} className="flex justify-between py-0.5">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate mr-2">
                    {field.label}
                  </span>
                  <span className="text-[11px] font-medium text-gray-900 dark:text-gray-100 text-right whitespace-nowrap">
                    {formatValue(data[field.key], field.format)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
