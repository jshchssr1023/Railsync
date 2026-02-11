/**
 * CCM Instructions Service
 *
 * Handles hierarchy-level CCM instructions with inheritance support.
 * CCM can be attached at 4 levels: Customer, Master Lease, Rider, Amendment
 * with cascade inheritance (child inherits parent, can override specific fields).
 */

import { pool } from '../config/database';

// ============================================================================
// Types
// ============================================================================

export type ScopeLevel = 'customer' | 'master_lease' | 'rider' | 'amendment';

export interface CCMInstructionScope {
  type: ScopeLevel;
  id: string;
}

export interface CCMInstructionFields {
  // Cleaning Requirements
  food_grade?: boolean | null;
  mineral_wipe?: boolean | null;
  kosher_wash?: boolean | null;
  kosher_wipe?: boolean | null;
  shop_oil_material?: boolean | null;
  oil_provider_contact?: string | null;
  rinse_water_test_procedure?: string | null;

  // Primary Contact
  primary_contact_name?: string | null;
  primary_contact_email?: string | null;
  primary_contact_phone?: string | null;

  // Estimate Approval Contact
  estimate_approval_contact_name?: string | null;
  estimate_approval_contact_email?: string | null;
  estimate_approval_contact_phone?: string | null;

  // Dispo Contact
  dispo_contact_name?: string | null;
  dispo_contact_email?: string | null;
  dispo_contact_phone?: string | null;

  // Outbound Dispo
  decal_requirements?: string | null;
  nitrogen_applied?: boolean | null;
  nitrogen_psi?: string | null;
  outbound_dispo_contact_email?: string | null;
  outbound_dispo_contact_phone?: string | null;
  documentation_required_prior_to_release?: string | null;

  // Special Fittings & Notes
  special_fittings_vendor_requirements?: string | null;
  additional_notes?: string | null;
}

export interface CCMInstructionSealing {
  id?: string;
  ccm_instruction_id?: string;
  commodity: string;
  gasket_sealing_material?: string | null;
  alternate_material?: string | null;
  preferred_gasket_vendor?: string | null;
  alternate_vendor?: string | null;
  vsp_ride_tight?: boolean | null;
  sealing_requirements?: string | null;
  inherit_from_parent?: boolean;
  sort_order?: number;
}

export interface CCMInstructionLining {
  id?: string;
  ccm_instruction_id?: string;
  commodity: string;
  lining_required?: boolean | null;
  lining_inspection_interval?: string | null;
  lining_type?: string | null;
  lining_plan_on_file?: boolean | null;
  lining_requirements?: string | null;
  inherit_from_parent?: boolean;
  sort_order?: number;
}

export interface CCMInstruction extends CCMInstructionFields {
  id: string;
  scope_level: ScopeLevel;
  scope_name?: string;
  customer_id?: string | null;
  master_lease_id?: string | null;
  rider_id?: string | null;
  amendment_id?: string | null;
  version: number;
  is_current: boolean;
  created_by_id?: string;
  created_at: string;
  updated_at: string;
  // Related data
  sealing_sections?: CCMInstructionSealing[];
  lining_sections?: CCMInstructionLining[];
  // View fields
  customer_name?: string;
  customer_code?: string;
  lease_code?: string;
  lease_name?: string;
  rider_code?: string;
  rider_name?: string;
  amendment_code?: string;
  amendment_summary?: string;
  sealing_count?: number;
  lining_count?: number;
}

export interface HierarchyNode {
  id: string;
  type: ScopeLevel;
  name: string;
  code?: string;
  hasCCM: boolean;
  isActive: boolean;
  children?: HierarchyNode[];
}

export interface InheritanceChainItem {
  level: ScopeLevel;
  id: string | null;
  name: string | null;
  fields_defined: string[];
}

export interface EffectiveCCM {
  effective: CCMInstructionFields;
  field_sources: Record<string, ScopeLevel | null>;
  inheritance_chain: InheritanceChainItem[];
  sealing_by_commodity: Record<string, { data: CCMInstructionSealing; source: ScopeLevel }>;
  lining_by_commodity: Record<string, { data: CCMInstructionLining; source: ScopeLevel }>;
  hierarchy: {
    customer_id: string | null;
    customer_name: string | null;
    master_lease_id: string | null;
    lease_name: string | null;
    rider_id: string | null;
    rider_name: string | null;
    amendment_id: string | null;
    amendment_name: string | null;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function getScopeColumn(scopeType: ScopeLevel): string {
  switch (scopeType) {
    case 'customer': return 'customer_id';
    case 'master_lease': return 'master_lease_id';
    case 'rider': return 'rider_id';
    case 'amendment': return 'amendment_id';
  }
}

// Fields list for building queries
const CCM_FIELDS = [
  'food_grade', 'mineral_wipe', 'kosher_wash', 'kosher_wipe', 'shop_oil_material',
  'oil_provider_contact', 'rinse_water_test_procedure',
  'primary_contact_name', 'primary_contact_email', 'primary_contact_phone',
  'estimate_approval_contact_name', 'estimate_approval_contact_email', 'estimate_approval_contact_phone',
  'dispo_contact_name', 'dispo_contact_email', 'dispo_contact_phone',
  'decal_requirements', 'nitrogen_applied', 'nitrogen_psi',
  'outbound_dispo_contact_email', 'outbound_dispo_contact_phone',
  'documentation_required_prior_to_release',
  'special_fittings_vendor_requirements', 'additional_notes'
];

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get CCM instruction by ID
 */
export async function getCCMInstructionById(id: string): Promise<CCMInstruction | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM v_ccm_instructions WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;

    const instruction = result.rows[0] as CCMInstruction;

    // Fetch sealing sections
    const sealingResult = await client.query(
      `SELECT * FROM ccm_instruction_sealing WHERE ccm_instruction_id = $1 ORDER BY sort_order, created_at`,
      [id]
    );
    instruction.sealing_sections = sealingResult.rows;

    // Fetch lining sections
    const liningResult = await client.query(
      `SELECT * FROM ccm_instruction_lining WHERE ccm_instruction_id = $1 ORDER BY sort_order, created_at`,
      [id]
    );
    instruction.lining_sections = liningResult.rows;

    return instruction;
  } finally {
    client.release();
  }
}

/**
 * Get CCM instruction by scope (customer, lease, rider, or amendment)
 */
export async function getCCMInstructionByScope(scope: CCMInstructionScope): Promise<CCMInstruction | null> {
  const column = getScopeColumn(scope.type);
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM v_ccm_instructions WHERE ${column} = $1 AND is_current = TRUE`,
      [scope.id]
    );

    if (result.rows.length === 0) return null;

    const instruction = result.rows[0] as CCMInstruction;

    // Fetch sealing sections
    const sealingResult = await client.query(
      `SELECT * FROM ccm_instruction_sealing WHERE ccm_instruction_id = $1 ORDER BY sort_order, created_at`,
      [instruction.id]
    );
    instruction.sealing_sections = sealingResult.rows;

    // Fetch lining sections
    const liningResult = await client.query(
      `SELECT * FROM ccm_instruction_lining WHERE ccm_instruction_id = $1 ORDER BY sort_order, created_at`,
      [instruction.id]
    );
    instruction.lining_sections = liningResult.rows;

    return instruction;
  } finally {
    client.release();
  }
}

/**
 * List CCM instructions with optional filters
 */
export async function listCCMInstructions(filters?: {
  scope_type?: ScopeLevel;
  scope_id?: string;
  customer_id?: string;
}): Promise<CCMInstruction[]> {
  const client = await pool.connect();
  try {
    let query = `SELECT * FROM v_ccm_instructions WHERE is_current = TRUE`;
    const params: (string | undefined)[] = [];
    let paramIdx = 1;

    if (filters?.scope_type && filters?.scope_id) {
      const column = getScopeColumn(filters.scope_type);
      query += ` AND ${column} = $${paramIdx}`;
      params.push(filters.scope_id);
      paramIdx++;
    }

    if (filters?.customer_id) {
      // Filter by customer across all scope levels
      query += ` AND (customer_id = $${paramIdx} OR master_lease_id IN (
        SELECT id FROM master_leases WHERE customer_id = $${paramIdx}
      ) OR rider_id IN (
        SELECT lr.id FROM lease_riders lr
        JOIN master_leases ml ON lr.master_lease_id = ml.id
        WHERE ml.customer_id = $${paramIdx}
      ))`;
      params.push(filters.customer_id);
      paramIdx++;
    }

    query += ` ORDER BY scope_level, scope_name`;

    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Create a new CCM instruction at a specific scope
 */
export async function createCCMInstruction(
  scope: CCMInstructionScope,
  data: Partial<CCMInstructionFields>,
  userId?: string
): Promise<CCMInstruction> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const column = getScopeColumn(scope.type);

    // Get scope name for display
    let scopeName: string | null = null;
    switch (scope.type) {
      case 'customer': {
        const custResult = await client.query('SELECT customer_name FROM customers WHERE id = $1', [scope.id]);
        scopeName = custResult.rows[0]?.customer_name;
        break;
      }
      case 'master_lease': {
        const leaseResult = await client.query('SELECT COALESCE(lease_name, lease_id) as name FROM master_leases WHERE id = $1', [scope.id]);
        scopeName = leaseResult.rows[0]?.name;
        break;
      }
      case 'rider': {
        const riderResult = await client.query('SELECT COALESCE(rider_name, rider_id) as name FROM lease_riders WHERE id = $1', [scope.id]);
        scopeName = riderResult.rows[0]?.name;
        break;
      }
      case 'amendment': {
        const amendResult = await client.query('SELECT COALESCE(change_summary, amendment_id) as name FROM lease_amendments WHERE id = $1', [scope.id]);
        scopeName = amendResult.rows[0]?.name;
        break;
      }
    }

    // Build insert query
    const fields = ['scope_level', 'scope_name', column];
    const values: (string | boolean | null | undefined)[] = [scope.type, scopeName, scope.id];

    for (const field of CCM_FIELDS) {
      if (field in data) {
        fields.push(field);
        values.push((data as Record<string, string | boolean | null | undefined>)[field]);
      }
    }

    if (userId) {
      fields.push('created_by_id');
      values.push(userId);
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const insertQuery = `
      INSERT INTO ccm_instructions (${fields.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await client.query(insertQuery, values);
    const instruction = result.rows[0];

    await client.query('COMMIT');

    return getCCMInstructionById(instruction.id) as Promise<CCMInstruction>;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update an existing CCM instruction
 */
export async function updateCCMInstruction(
  id: string,
  data: Partial<CCMInstructionFields>
): Promise<CCMInstruction | null> {
  const client = await pool.connect();
  try {
    // Build update query
    const updates: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let paramIdx = 1;

    for (const field of CCM_FIELDS) {
      if (field in data) {
        updates.push(`${field} = $${paramIdx}`);
        values.push((data as Record<string, unknown>)[field]);
        paramIdx++;
      }
    }

    if (updates.length === 1) {
      // No fields to update
      return getCCMInstructionById(id);
    }

    values.push(id);
    const updateQuery = `
      UPDATE ccm_instructions
      SET ${updates.join(', ')}
      WHERE id = $${paramIdx}
      RETURNING *
    `;

    const result = await client.query(updateQuery, values);
    if (result.rows.length === 0) return null;

    return getCCMInstructionById(id);
  } finally {
    client.release();
  }
}

/**
 * Delete a CCM instruction (marks as not current)
 */
export async function deleteCCMInstruction(id: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE ccm_instructions SET is_current = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id`,
    [id]
  );
  return result.rows.length > 0;
}

// ============================================================================
// Sealing Section Operations
// ============================================================================

export async function addSealingSection(
  instructionId: string,
  data: CCMInstructionSealing
): Promise<CCMInstructionSealing> {
  const result = await pool.query(
    `INSERT INTO ccm_instruction_sealing (
      ccm_instruction_id, commodity, gasket_sealing_material, alternate_material,
      preferred_gasket_vendor, alternate_vendor, vsp_ride_tight, sealing_requirements,
      inherit_from_parent, sort_order
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      instructionId, data.commodity, data.gasket_sealing_material, data.alternate_material,
      data.preferred_gasket_vendor, data.alternate_vendor, data.vsp_ride_tight ?? false,
      data.sealing_requirements, data.inherit_from_parent ?? false, data.sort_order ?? 0
    ]
  );
  return result.rows[0];
}

export async function updateSealingSection(
  sealingId: string,
  data: Partial<CCMInstructionSealing>
): Promise<CCMInstructionSealing | null> {
  const updates: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let paramIdx = 1;

  const fields = [
    'commodity', 'gasket_sealing_material', 'alternate_material',
    'preferred_gasket_vendor', 'alternate_vendor', 'vsp_ride_tight',
    'sealing_requirements', 'inherit_from_parent', 'sort_order'
  ];

  for (const field of fields) {
    if (field in data) {
      updates.push(`${field} = $${paramIdx}`);
      values.push((data as Record<string, unknown>)[field]);
      paramIdx++;
    }
  }

  values.push(sealingId);
  const result = await pool.query(
    `UPDATE ccm_instruction_sealing SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function removeSealingSection(sealingId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM ccm_instruction_sealing WHERE id = $1 RETURNING id`,
    [sealingId]
  );
  return result.rows.length > 0;
}

// ============================================================================
// Lining Section Operations
// ============================================================================

export async function addLiningSection(
  instructionId: string,
  data: CCMInstructionLining
): Promise<CCMInstructionLining> {
  const result = await pool.query(
    `INSERT INTO ccm_instruction_lining (
      ccm_instruction_id, commodity, lining_required, lining_inspection_interval,
      lining_type, lining_plan_on_file, lining_requirements, inherit_from_parent, sort_order
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      instructionId, data.commodity, data.lining_required ?? false,
      data.lining_inspection_interval, data.lining_type, data.lining_plan_on_file ?? false,
      data.lining_requirements, data.inherit_from_parent ?? false, data.sort_order ?? 0
    ]
  );
  return result.rows[0];
}

export async function updateLiningSection(
  liningId: string,
  data: Partial<CCMInstructionLining>
): Promise<CCMInstructionLining | null> {
  const updates: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let paramIdx = 1;

  const fields = [
    'commodity', 'lining_required', 'lining_inspection_interval',
    'lining_type', 'lining_plan_on_file', 'lining_requirements',
    'inherit_from_parent', 'sort_order'
  ];

  for (const field of fields) {
    if (field in data) {
      updates.push(`${field} = $${paramIdx}`);
      values.push((data as Record<string, unknown>)[field]);
      paramIdx++;
    }
  }

  values.push(liningId);
  const result = await pool.query(
    `UPDATE ccm_instruction_lining SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function removeLiningSection(liningId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM ccm_instruction_lining WHERE id = $1 RETURNING id`,
    [liningId]
  );
  return result.rows.length > 0;
}

// ============================================================================
// Hierarchy Tree
// ============================================================================

/**
 * Get the hierarchy tree for CCM scope selection
 */
export async function getHierarchyTree(customerId?: string): Promise<HierarchyNode[]> {
  const client = await pool.connect();
  try {
    // Build customers query
    let customerQuery = `
      SELECT node_type, id, name, code, has_ccm, is_active, NULL::UUID as parent_id
      FROM v_ccm_hierarchy_tree
      WHERE node_type = 'customer'
    `;
    const params: string[] = [];

    if (customerId) {
      customerQuery += ` AND id = $1`;
      params.push(customerId);
    }

    customerQuery += ` ORDER BY name`;

    const customersResult = await client.query(customerQuery, params);
    const customers = customersResult.rows;

    // For each customer, get their children
    const tree: HierarchyNode[] = [];

    for (const customer of customers) {
      const customerNode: HierarchyNode = {
        id: customer.id,
        type: 'customer',
        name: customer.name,
        code: customer.code,
        hasCCM: customer.has_ccm,
        isActive: customer.is_active,
        children: []
      };

      // Get master leases for this customer
      const leasesResult = await client.query(
        `SELECT node_type, id, name, code, has_ccm, is_active, parent_id
         FROM v_ccm_hierarchy_tree
         WHERE node_type = 'master_lease' AND parent_id = $1
         ORDER BY name`,
        [customer.id]
      );

      for (const lease of leasesResult.rows) {
        const leaseNode: HierarchyNode = {
          id: lease.id,
          type: 'master_lease',
          name: lease.name,
          code: lease.code,
          hasCCM: lease.has_ccm,
          isActive: lease.is_active,
          children: []
        };

        // Get riders for this lease
        const ridersResult = await client.query(
          `SELECT node_type, id, name, code, has_ccm, is_active, parent_id
           FROM v_ccm_hierarchy_tree
           WHERE node_type = 'rider' AND parent_id = $1
           ORDER BY name`,
          [lease.id]
        );

        for (const rider of ridersResult.rows) {
          const riderNode: HierarchyNode = {
            id: rider.id,
            type: 'rider',
            name: rider.name,
            code: rider.code,
            hasCCM: rider.has_ccm,
            isActive: rider.is_active,
            children: []
          };

          // Get amendments for this rider
          const amendmentsResult = await client.query(
            `SELECT node_type, id, name, code, has_ccm, is_active, parent_id
             FROM v_ccm_hierarchy_tree
             WHERE node_type = 'amendment' AND parent_id = $1
             ORDER BY name`,
            [rider.id]
          );

          riderNode.children = amendmentsResult.rows.map((a: { id: string; name: string; code: string; has_ccm: boolean; is_active: boolean }) => ({
            id: a.id,
            type: 'amendment' as ScopeLevel,
            name: a.name,
            code: a.code,
            hasCCM: a.has_ccm,
            isActive: a.is_active
          }));

          leaseNode.children!.push(riderNode);
        }

        customerNode.children!.push(leaseNode);
      }

      tree.push(customerNode);
    }

    return tree;
  } finally {
    client.release();
  }
}

// ============================================================================
// Inheritance Resolution
// ============================================================================

/**
 * Get the effective CCM for a car with full inheritance chain
 */
export async function resolveEffectiveCCM(carNumber: string): Promise<EffectiveCCM | null> {
  const client = await pool.connect();
  try {
    // Get the car's hierarchy path
    const pathResult = await client.query(
      `SELECT
        ml.customer_id, c.customer_name,
        lr.master_lease_id, COALESCE(ml.lease_name, ml.lease_id) as lease_name,
        rc.rider_id, COALESCE(lr.rider_name, lr.rider_id) as rider_name,
        la.id as amendment_id, COALESCE(la.change_summary, la.amendment_id) as amendment_name
      FROM rider_cars rc
      JOIN lease_riders lr ON rc.rider_id = lr.id
      JOIN master_leases ml ON lr.master_lease_id = ml.id
      JOIN customers c ON ml.customer_id = c.id
      LEFT JOIN lease_amendments la ON la.rider_id = lr.id AND la.effective_date <= CURRENT_DATE
      WHERE rc.car_number = $1 AND rc.is_active = TRUE
      ORDER BY la.effective_date DESC NULLS LAST
      LIMIT 1`,
      [carNumber]
    );

    if (pathResult.rows.length === 0) {
      return null;
    }

    const path = pathResult.rows[0];

    // Get CCM at each level
    const levels: { level: ScopeLevel; id: string | null }[] = [
      { level: 'customer', id: path.customer_id },
      { level: 'master_lease', id: path.master_lease_id },
      { level: 'rider', id: path.rider_id },
      { level: 'amendment', id: path.amendment_id }
    ];

    const ccmByLevel: Record<ScopeLevel, CCMInstruction | null> = {
      customer: null,
      master_lease: null,
      rider: null,
      amendment: null
    };

    for (const { level, id } of levels) {
      if (id) {
        ccmByLevel[level] = await getCCMInstructionByScope({ type: level, id });
      }
    }

    // Merge fields with inheritance (most specific wins)
    const effective: CCMInstructionFields = {};
    const fieldSources: Record<string, ScopeLevel | null> = {};
    const inheritanceChain: InheritanceChainItem[] = [];

    // Process from most general (customer) to most specific (amendment)
    const levelOrder: ScopeLevel[] = ['customer', 'master_lease', 'rider', 'amendment'];
    const levelNames: Record<ScopeLevel, string | null> = {
      customer: path.customer_name,
      master_lease: path.lease_name,
      rider: path.rider_name,
      amendment: path.amendment_name
    };
    const levelIds: Record<ScopeLevel, string | null> = {
      customer: path.customer_id,
      master_lease: path.master_lease_id,
      rider: path.rider_id,
      amendment: path.amendment_id
    };

    for (const level of levelOrder) {
      const ccm = ccmByLevel[level];
      const fieldsDefined: string[] = [];

      if (ccm) {
        for (const field of CCM_FIELDS) {
          const value = (ccm as unknown as Record<string, unknown>)[field];
          if (value !== null && value !== undefined) {
            (effective as unknown as Record<string, unknown>)[field] = value;
            fieldSources[field] = level;
            fieldsDefined.push(field);
          }
        }
      }

      inheritanceChain.push({
        level,
        id: levelIds[level],
        name: levelNames[level],
        fields_defined: fieldsDefined
      });
    }

    // Merge commodity sections (sealing)
    const sealingByCommodity: Record<string, { data: CCMInstructionSealing; source: ScopeLevel }> = {};
    for (const level of levelOrder) {
      const ccm = ccmByLevel[level];
      if (ccm?.sealing_sections) {
        for (const sealing of ccm.sealing_sections) {
          if (!sealing.inherit_from_parent) {
            sealingByCommodity[sealing.commodity] = { data: sealing, source: level };
          }
        }
      }
    }

    // Merge commodity sections (lining)
    const liningByCommodity: Record<string, { data: CCMInstructionLining; source: ScopeLevel }> = {};
    for (const level of levelOrder) {
      const ccm = ccmByLevel[level];
      if (ccm?.lining_sections) {
        for (const lining of ccm.lining_sections) {
          if (!lining.inherit_from_parent) {
            liningByCommodity[lining.commodity] = { data: lining, source: level };
          }
        }
      }
    }

    return {
      effective,
      field_sources: fieldSources,
      inheritance_chain: inheritanceChain,
      sealing_by_commodity: sealingByCommodity,
      lining_by_commodity: liningByCommodity,
      hierarchy: {
        customer_id: path.customer_id,
        customer_name: path.customer_name,
        master_lease_id: path.master_lease_id,
        lease_name: path.lease_name,
        rider_id: path.rider_id,
        rider_name: path.rider_name,
        amendment_id: path.amendment_id,
        amendment_name: path.amendment_name
      }
    };
  } finally {
    client.release();
  }
}

/**
 * Get parent CCM for inheritance preview (what values would be inherited)
 */
export async function getParentCCM(scope: CCMInstructionScope): Promise<CCMInstructionFields | null> {
  const client = await pool.connect();
  try {
    let parentScope: CCMInstructionScope | null = null;

    switch (scope.type) {
      case 'master_lease': {
        const result = await client.query(
          'SELECT customer_id FROM master_leases WHERE id = $1',
          [scope.id]
        );
        if (result.rows[0]) {
          parentScope = { type: 'customer', id: result.rows[0].customer_id };
        }
        break;
      }
      case 'rider': {
        const result = await client.query(
          'SELECT master_lease_id FROM lease_riders WHERE id = $1',
          [scope.id]
        );
        if (result.rows[0]) {
          // Get lease's parent CCM first, then lease CCM
          const leaseId = result.rows[0].master_lease_id;
          const leaseCCM = await getCCMInstructionByScope({ type: 'master_lease', id: leaseId });
          if (leaseCCM) {
            return leaseCCM;
          }
          // If no lease CCM, get customer CCM
          const leaseResult = await client.query(
            'SELECT customer_id FROM master_leases WHERE id = $1',
            [leaseId]
          );
          if (leaseResult.rows[0]) {
            parentScope = { type: 'customer', id: leaseResult.rows[0].customer_id };
          }
        }
        break;
      }
      case 'amendment': {
        const result = await client.query(
          'SELECT rider_id, master_lease_id FROM lease_amendments WHERE id = $1',
          [scope.id]
        );
        if (result.rows[0]?.rider_id) {
          parentScope = { type: 'rider', id: result.rows[0].rider_id };
        } else if (result.rows[0]?.master_lease_id) {
          parentScope = { type: 'master_lease', id: result.rows[0].master_lease_id };
        }
        break;
      }
    }

    if (parentScope) {
      const parentCCM = await getCCMInstructionByScope(parentScope);
      return parentCCM || null;
    }

    return null;
  } finally {
    client.release();
  }
}
