-- Migration 035: Fix generate_project_number substring offset
-- Previously used hardcoded FROM 8, which broke for 3-char prefixes (e.g. QUL-2602-0001)
-- Now uses dynamic offset: LENGTH(prefix) + 7 to correctly extract the sequence number

CREATE OR REPLACE FUNCTION generate_project_number(p_type VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  prefix VARCHAR(3);
  yymm VARCHAR(4);
  seq INT;
BEGIN
  prefix := CASE p_type
    WHEN 'assignment' THEN 'ASN'
    WHEN 'release' THEN 'REL'
    WHEN 'qualification' THEN 'QUL'
    WHEN 'lining' THEN 'LIN'
    WHEN 'inspection' THEN 'INS'
    ELSE 'PRJ'
  END;

  yymm := TO_CHAR(NOW(), 'YYMM');

  SELECT COALESCE(MAX(CAST(SUBSTRING(project_number FROM LENGTH(prefix) + 7) AS INT)), 0) + 1
  INTO seq
  FROM projects
  WHERE project_number LIKE prefix || '-' || yymm || '-%';

  RETURN prefix || '-' || yymm || '-' || LPAD(seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;
