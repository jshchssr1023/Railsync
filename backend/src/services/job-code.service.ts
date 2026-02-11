import { query, queryOne } from '../config/database';

// Types
export interface JobCode {
  id: string;
  code: string;
  code_type: 'aar' | 'internal';
  description: string | null;
  category: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateJobCodeInput {
  code: string;
  code_type: 'aar' | 'internal';
  description?: string;
  category?: string;
}

export interface JobCodeFilters {
  code_type?: string;
  category?: string;
  search?: string;
  is_active?: boolean;
}

export async function createJobCode(input: CreateJobCodeInput): Promise<JobCode> {
  const result = await queryOne<JobCode>(
    `INSERT INTO job_codes (code, code_type, description, category)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.code, input.code_type, input.description || null, input.category || null]
  );
  return result!;
}

export async function listJobCodes(filters: JobCodeFilters = {}): Promise<JobCode[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.code_type) {
    conditions.push(`code_type = $${paramIndex++}`);
    params.push(filters.code_type);
  }

  if (filters.category) {
    conditions.push(`category = $${paramIndex++}`);
    params.push(filters.category);
  }

  if (filters.search) {
    conditions.push(`(code ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  if (filters.is_active !== undefined) {
    conditions.push(`is_active = $${paramIndex++}`);
    params.push(filters.is_active);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query<JobCode>(
    `SELECT * FROM job_codes ${whereClause} ORDER BY code ASC`,
    params
  );
  return result;
}

export async function getJobCode(id: string): Promise<JobCode | null> {
  const result = await queryOne<JobCode>(
    `SELECT * FROM job_codes WHERE id = $1`,
    [id]
  );
  return result || null;
}

export async function updateJobCode(id: string, input: Partial<CreateJobCodeInput>): Promise<JobCode | null> {
  const fields: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (input.code !== undefined) {
    fields.push(`code = $${paramIndex++}`);
    params.push(input.code);
  }

  if (input.code_type !== undefined) {
    fields.push(`code_type = $${paramIndex++}`);
    params.push(input.code_type);
  }

  if (input.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    params.push(input.description);
  }

  if (input.category !== undefined) {
    fields.push(`category = $${paramIndex++}`);
    params.push(input.category);
  }

  if (fields.length === 0) {
    return getJobCode(id);
  }

  fields.push(`updated_at = NOW()`);
  params.push(id);

  const result = await queryOne<JobCode>(
    `UPDATE job_codes SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );
  return result || null;
}
