import { query, queryOne, transaction } from '../config/database';

// ============================================================================
// CCM FORM TYPES (structured form mirroring AITX template)
// ============================================================================

export interface CCMForm {
  id: string;
  lessee_code: string;
  lessee_name: string | null;
  company_name: string | null;
  form_date: string | null;
  revision_date: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  estimate_approval_contact_name: string | null;
  estimate_approval_contact_email: string | null;
  estimate_approval_contact_phone: string | null;
  dispo_contact_name: string | null;
  dispo_contact_email: string | null;
  dispo_contact_phone: string | null;
  food_grade: boolean;
  mineral_wipe: boolean;
  kosher_wash: boolean;
  kosher_wipe: boolean;
  shop_oil_material: boolean;
  oil_provider_contact: string | null;
  rinse_water_test_procedure: string | null;
  decal_requirements: string | null;
  nitrogen_applied: boolean;
  nitrogen_psi: string | null;
  outbound_dispo_contact_email: string | null;
  outbound_dispo_contact_phone: string | null;
  documentation_required_prior_to_release: string | null;
  special_fittings_vendor_requirements: string | null;
  additional_notes: string | null;
  version: number;
  is_current: boolean;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
  sealing_sections?: CCMFormSealing[];
  lining_sections?: CCMFormLining[];
  attachments?: CCMFormAttachment[];
}

export interface CCMFormSealing {
  id: string;
  ccm_form_id: string;
  commodity: string;
  gasket_sealing_material: string | null;
  alternate_material: string | null;
  preferred_gasket_vendor: string | null;
  alternate_vendor: string | null;
  vsp_ride_tight: boolean;
  sealing_requirements: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CCMFormLining {
  id: string;
  ccm_form_id: string;
  commodity: string;
  lining_required: boolean;
  lining_inspection_interval: string | null;
  lining_type: string | null;
  lining_plan_on_file: boolean;
  lining_requirements: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CCMFormAttachment {
  id: string;
  ccm_form_id: string;
  file_name: string;
  file_path: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  mfiles_id: string | null;
  mfiles_url: string | null;
  uploaded_by_id: string | null;
  created_at: string;
}

export interface CreateCCMFormInput {
  lessee_code: string;
  lessee_name?: string;
  company_name?: string;
  form_date?: string;
  revision_date?: string;
  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
  estimate_approval_contact_name?: string;
  estimate_approval_contact_email?: string;
  estimate_approval_contact_phone?: string;
  dispo_contact_name?: string;
  dispo_contact_email?: string;
  dispo_contact_phone?: string;
  food_grade?: boolean;
  mineral_wipe?: boolean;
  kosher_wash?: boolean;
  kosher_wipe?: boolean;
  shop_oil_material?: boolean;
  oil_provider_contact?: string;
  rinse_water_test_procedure?: string;
  decal_requirements?: string;
  nitrogen_applied?: boolean;
  nitrogen_psi?: string;
  outbound_dispo_contact_email?: string;
  outbound_dispo_contact_phone?: string;
  documentation_required_prior_to_release?: string;
  special_fittings_vendor_requirements?: string;
  additional_notes?: string;
}

export interface CreateSealingInput {
  commodity: string;
  gasket_sealing_material?: string;
  alternate_material?: string;
  preferred_gasket_vendor?: string;
  alternate_vendor?: string;
  vsp_ride_tight?: boolean;
  sealing_requirements?: string;
  sort_order?: number;
}

export interface CreateLiningInput {
  commodity: string;
  lining_required?: boolean;
  lining_inspection_interval?: string;
  lining_type?: string;
  lining_plan_on_file?: boolean;
  lining_requirements?: string;
  sort_order?: number;
}

// ============================================================================
// CCM SECTION TYPES (generic sections for SOW integration)
// ============================================================================

// Types
export interface CCMSection {
  id: string;
  ccm_document_id: string;
  section_number: string;
  section_name: string;
  content: string | null;
  section_type: string | null;
  can_include_in_sow: boolean;
  is_lessee_matrix_placeholder: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CCMDocument {
  id: string;
  lessee_code: string;
  version: number;
  is_current: boolean;
  created_at: Date;
  updated_at: Date;
  sections?: CCMSection[];
}

export interface CreateCCMSectionInput {
  ccm_document_id: string;
  section_number: string;
  section_name: string;
  content?: string;
  section_type?: string;
  can_include_in_sow?: boolean;
}

export async function getCCMWithSections(ccmDocumentId: string): Promise<CCMDocument | null> {
  const document = await queryOne<CCMDocument>(
    `SELECT * FROM ccm_documents WHERE id = $1`,
    [ccmDocumentId]
  );

  if (!document) {
    return null;
  }

  const sections = await query<CCMSection>(
    `SELECT * FROM ccm_sections WHERE ccm_document_id = $1 ORDER BY section_number ASC`,
    [ccmDocumentId]
  );

  return { ...document, sections };
}

export async function listCCMsByLessee(lesseeCode: string): Promise<CCMDocument[]> {
  const result = await query<CCMDocument>(
    `SELECT * FROM ccm_documents WHERE lessee_code = $1 AND is_current = TRUE`,
    [lesseeCode]
  );
  return result;
}

export async function addSection(input: CreateCCMSectionInput): Promise<CCMSection> {
  const result = await queryOne<CCMSection>(
    `INSERT INTO ccm_sections (ccm_document_id, section_number, section_name, content, section_type, can_include_in_sow)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.ccm_document_id,
      input.section_number,
      input.section_name,
      input.content || null,
      input.section_type || null,
      input.can_include_in_sow !== undefined ? input.can_include_in_sow : false,
    ]
  );
  return result!;
}

export async function updateSection(sectionId: string, input: Partial<CreateCCMSectionInput>): Promise<CCMSection | null> {
  const fields: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (input.section_number !== undefined) {
    fields.push(`section_number = $${paramIndex++}`);
    params.push(input.section_number);
  }

  if (input.section_name !== undefined) {
    fields.push(`section_name = $${paramIndex++}`);
    params.push(input.section_name);
  }

  if (input.content !== undefined) {
    fields.push(`content = $${paramIndex++}`);
    params.push(input.content);
  }

  if (input.section_type !== undefined) {
    fields.push(`section_type = $${paramIndex++}`);
    params.push(input.section_type);
  }

  if (input.can_include_in_sow !== undefined) {
    fields.push(`can_include_in_sow = $${paramIndex++}`);
    params.push(input.can_include_in_sow);
  }

  if (fields.length === 0) {
    return queryOne<CCMSection>(`SELECT * FROM ccm_sections WHERE id = $1`, [sectionId]);
  }

  fields.push(`updated_at = NOW()`);
  params.push(sectionId);

  const result = await queryOne<CCMSection>(
    `UPDATE ccm_sections SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );
  return result || null;
}

export async function deleteSection(sectionId: string): Promise<boolean> {
  const result = await queryOne<{ id: string }>(
    `DELETE FROM ccm_sections WHERE id = $1 RETURNING id`,
    [sectionId]
  );
  return !!result;
}

export async function getSectionsForSOW(ccmDocumentId: string): Promise<CCMSection[]> {
  const result = await query<CCMSection>(
    `SELECT * FROM ccm_sections WHERE ccm_document_id = $1 AND can_include_in_sow = TRUE ORDER BY section_number ASC`,
    [ccmDocumentId]
  );
  return result;
}

// ============================================================================
// CCM FORM OPERATIONS (structured form matching AITX template)
// ============================================================================

export async function createCCMForm(input: CreateCCMFormInput, userId?: string): Promise<CCMForm> {
  const result = await queryOne<CCMForm>(
    `INSERT INTO ccm_forms (
      lessee_code, lessee_name, company_name, form_date, revision_date,
      primary_contact_name, primary_contact_email, primary_contact_phone,
      estimate_approval_contact_name, estimate_approval_contact_email, estimate_approval_contact_phone,
      dispo_contact_name, dispo_contact_email, dispo_contact_phone,
      food_grade, mineral_wipe, kosher_wash, kosher_wipe, shop_oil_material,
      oil_provider_contact, rinse_water_test_procedure,
      decal_requirements, nitrogen_applied, nitrogen_psi,
      outbound_dispo_contact_email, outbound_dispo_contact_phone,
      documentation_required_prior_to_release,
      special_fittings_vendor_requirements, additional_notes,
      created_by_id
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8,
      $9, $10, $11,
      $12, $13, $14,
      $15, $16, $17, $18, $19,
      $20, $21,
      $22, $23, $24,
      $25, $26,
      $27,
      $28, $29,
      $30
    ) RETURNING *`,
    [
      input.lessee_code,
      input.lessee_name || null,
      input.company_name || null,
      input.form_date || null,
      input.revision_date || null,
      input.primary_contact_name || null,
      input.primary_contact_email || null,
      input.primary_contact_phone || null,
      input.estimate_approval_contact_name || null,
      input.estimate_approval_contact_email || null,
      input.estimate_approval_contact_phone || null,
      input.dispo_contact_name || null,
      input.dispo_contact_email || null,
      input.dispo_contact_phone || null,
      input.food_grade || false,
      input.mineral_wipe || false,
      input.kosher_wash || false,
      input.kosher_wipe || false,
      input.shop_oil_material || false,
      input.oil_provider_contact || null,
      input.rinse_water_test_procedure || null,
      input.decal_requirements || null,
      input.nitrogen_applied || false,
      input.nitrogen_psi || null,
      input.outbound_dispo_contact_email || null,
      input.outbound_dispo_contact_phone || null,
      input.documentation_required_prior_to_release || null,
      input.special_fittings_vendor_requirements || null,
      input.additional_notes || null,
      userId || null,
    ]
  );
  return result!;
}

export async function getCCMForm(id: string): Promise<CCMForm | null> {
  const form = await queryOne<CCMForm>(
    `SELECT * FROM ccm_forms WHERE id = $1`,
    [id]
  );
  if (!form) return null;

  const sealing = await query<CCMFormSealing>(
    `SELECT * FROM ccm_form_sealing WHERE ccm_form_id = $1 ORDER BY sort_order, created_at`,
    [id]
  );
  const lining = await query<CCMFormLining>(
    `SELECT * FROM ccm_form_lining WHERE ccm_form_id = $1 ORDER BY sort_order, created_at`,
    [id]
  );
  const attachments = await query<CCMFormAttachment>(
    `SELECT * FROM ccm_form_attachments WHERE ccm_form_id = $1 ORDER BY created_at`,
    [id]
  );

  return { ...form, sealing_sections: sealing, lining_sections: lining, attachments };
}

export async function listCCMForms(filters: {
  lessee_code?: string;
  is_current?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ forms: CCMForm[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (filters.lessee_code) {
    conditions.push(`lessee_code = $${paramIdx++}`);
    params.push(filters.lessee_code);
  }
  if (filters.is_current !== undefined) {
    conditions.push(`is_current = $${paramIdx++}`);
    params.push(filters.is_current);
  } else {
    conditions.push(`is_current = TRUE`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) FROM ccm_forms ${whereClause}`, params
  );

  const forms = await query<CCMForm>(
    `SELECT * FROM ccm_forms ${whereClause}
     ORDER BY lessee_name, company_name
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset]
  );

  return { forms, total: parseInt(countResult?.count || '0', 10) };
}

export async function updateCCMForm(id: string, input: Partial<CreateCCMFormInput>): Promise<CCMForm | null> {
  const fields: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  const stringFields: (keyof CreateCCMFormInput)[] = [
    'lessee_code', 'lessee_name', 'company_name', 'form_date', 'revision_date',
    'primary_contact_name', 'primary_contact_email', 'primary_contact_phone',
    'estimate_approval_contact_name', 'estimate_approval_contact_email', 'estimate_approval_contact_phone',
    'dispo_contact_name', 'dispo_contact_email', 'dispo_contact_phone',
    'oil_provider_contact', 'rinse_water_test_procedure',
    'decal_requirements', 'nitrogen_psi',
    'outbound_dispo_contact_email', 'outbound_dispo_contact_phone',
    'documentation_required_prior_to_release',
    'special_fittings_vendor_requirements', 'additional_notes',
  ];

  const booleanFields: (keyof CreateCCMFormInput)[] = [
    'food_grade', 'mineral_wipe', 'kosher_wash', 'kosher_wipe', 'shop_oil_material',
    'nitrogen_applied',
  ];

  for (const field of stringFields) {
    if (input[field] !== undefined) {
      fields.push(`${field} = $${paramIdx++}`);
      params.push(input[field]);
    }
  }

  for (const field of booleanFields) {
    if (input[field] !== undefined) {
      fields.push(`${field} = $${paramIdx++}`);
      params.push(input[field]);
    }
  }

  if (fields.length === 0) {
    return getCCMForm(id);
  }

  fields.push(`updated_at = NOW()`);
  params.push(id);

  const result = await queryOne<CCMForm>(
    `UPDATE ccm_forms SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    params
  );
  return result || null;
}

// -- Sealing Sections --

export async function addSealingSection(ccmFormId: string, input: CreateSealingInput): Promise<CCMFormSealing> {
  const result = await queryOne<CCMFormSealing>(
    `INSERT INTO ccm_form_sealing (
      ccm_form_id, commodity, gasket_sealing_material, alternate_material,
      preferred_gasket_vendor, alternate_vendor, vsp_ride_tight,
      sealing_requirements, sort_order
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      ccmFormId,
      input.commodity,
      input.gasket_sealing_material || null,
      input.alternate_material || null,
      input.preferred_gasket_vendor || null,
      input.alternate_vendor || null,
      input.vsp_ride_tight || false,
      input.sealing_requirements || null,
      input.sort_order || 0,
    ]
  );
  return result!;
}

export async function updateSealingSection(sealingId: string, input: Partial<CreateSealingInput>): Promise<CCMFormSealing | null> {
  const fields: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  const keys: (keyof CreateSealingInput)[] = [
    'commodity', 'gasket_sealing_material', 'alternate_material',
    'preferred_gasket_vendor', 'alternate_vendor', 'sealing_requirements',
  ];

  for (const key of keys) {
    if (input[key] !== undefined) {
      fields.push(`${key} = $${paramIdx++}`);
      params.push(input[key]);
    }
  }
  if (input.vsp_ride_tight !== undefined) {
    fields.push(`vsp_ride_tight = $${paramIdx++}`);
    params.push(input.vsp_ride_tight);
  }
  if (input.sort_order !== undefined) {
    fields.push(`sort_order = $${paramIdx++}`);
    params.push(input.sort_order);
  }

  if (fields.length === 0) {
    return queryOne<CCMFormSealing>(`SELECT * FROM ccm_form_sealing WHERE id = $1`, [sealingId]);
  }

  fields.push(`updated_at = NOW()`);
  params.push(sealingId);

  return queryOne<CCMFormSealing>(
    `UPDATE ccm_form_sealing SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    params
  );
}

export async function removeSealingSection(sealingId: string): Promise<boolean> {
  const result = await queryOne<{ id: string }>(
    `DELETE FROM ccm_form_sealing WHERE id = $1 RETURNING id`,
    [sealingId]
  );
  return !!result;
}

// -- Lining Sections --

export async function addLiningSection(ccmFormId: string, input: CreateLiningInput): Promise<CCMFormLining> {
  const result = await queryOne<CCMFormLining>(
    `INSERT INTO ccm_form_lining (
      ccm_form_id, commodity, lining_required, lining_inspection_interval,
      lining_type, lining_plan_on_file, lining_requirements, sort_order
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      ccmFormId,
      input.commodity,
      input.lining_required || false,
      input.lining_inspection_interval || null,
      input.lining_type || null,
      input.lining_plan_on_file || false,
      input.lining_requirements || null,
      input.sort_order || 0,
    ]
  );
  return result!;
}

export async function updateLiningSection(liningId: string, input: Partial<CreateLiningInput>): Promise<CCMFormLining | null> {
  const fields: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  const keys: (keyof CreateLiningInput)[] = [
    'commodity', 'lining_inspection_interval', 'lining_type', 'lining_requirements',
  ];

  for (const key of keys) {
    if (input[key] !== undefined) {
      fields.push(`${key} = $${paramIdx++}`);
      params.push(input[key]);
    }
  }
  if (input.lining_required !== undefined) {
    fields.push(`lining_required = $${paramIdx++}`);
    params.push(input.lining_required);
  }
  if (input.lining_plan_on_file !== undefined) {
    fields.push(`lining_plan_on_file = $${paramIdx++}`);
    params.push(input.lining_plan_on_file);
  }
  if (input.sort_order !== undefined) {
    fields.push(`sort_order = $${paramIdx++}`);
    params.push(input.sort_order);
  }

  if (fields.length === 0) {
    return queryOne<CCMFormLining>(`SELECT * FROM ccm_form_lining WHERE id = $1`, [liningId]);
  }

  fields.push(`updated_at = NOW()`);
  params.push(liningId);

  return queryOne<CCMFormLining>(
    `UPDATE ccm_form_lining SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    params
  );
}

export async function removeLiningSection(liningId: string): Promise<boolean> {
  const result = await queryOne<{ id: string }>(
    `DELETE FROM ccm_form_lining WHERE id = $1 RETURNING id`,
    [liningId]
  );
  return !!result;
}

// -- Attachments --

export async function addCCMFormAttachment(ccmFormId: string, input: {
  file_name: string;
  file_path?: string;
  file_size_bytes?: number;
  mime_type?: string;
  mfiles_id?: string;
  mfiles_url?: string;
}, userId?: string): Promise<CCMFormAttachment> {
  const result = await queryOne<CCMFormAttachment>(
    `INSERT INTO ccm_form_attachments (
      ccm_form_id, file_name, file_path, file_size_bytes, mime_type,
      mfiles_id, mfiles_url, uploaded_by_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      ccmFormId,
      input.file_name,
      input.file_path || null,
      input.file_size_bytes || null,
      input.mime_type || null,
      input.mfiles_id || null,
      input.mfiles_url || null,
      userId || null,
    ]
  );
  return result!;
}

export async function removeCCMFormAttachment(attachmentId: string): Promise<boolean> {
  const result = await queryOne<{ id: string }>(
    `DELETE FROM ccm_form_attachments WHERE id = $1 RETURNING id`,
    [attachmentId]
  );
  return !!result;
}

// -- SOW Integration --

export async function getCCMFormSOWSections(ccmFormId: string): Promise<any[]> {
  return query(
    `SELECT * FROM v_ccm_form_sow_sections WHERE ccm_form_id = $1`,
    [ccmFormId]
  );
}
