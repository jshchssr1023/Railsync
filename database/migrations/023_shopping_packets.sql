-- ============================================================================
-- Migration 023: Shopping Packets
-- Track packet issuance for shop work orders
-- ============================================================================

-- Shopping Packets table
CREATE TABLE IF NOT EXISTS shopping_packets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to allocation
  allocation_id UUID NOT NULL REFERENCES allocations(id) ON DELETE CASCADE,

  -- Packet info
  packet_number VARCHAR(50) NOT NULL,
  version INT NOT NULL DEFAULT 1,

  -- Status: draft, issued, reissued, superseded
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'reissued', 'superseded')),

  -- Content snapshot (denormalized for historical record)
  car_number VARCHAR(20) NOT NULL,
  shop_code VARCHAR(10) NOT NULL,
  shop_name VARCHAR(100),
  lessee_code VARCHAR(20),
  lessee_name VARCHAR(200),

  -- Work details
  shopping_types JSONB,           -- Array of selected shopping types
  shopping_reasons JSONB,         -- Array of selected reasons
  scope_of_work TEXT,             -- Generated scope description
  special_instructions TEXT,

  -- CCM reference
  ccm_document_id UUID REFERENCES ccm_documents(id),
  ccm_document_name VARCHAR(255),

  -- Billable items snapshot
  billable_items JSONB,

  -- Delivery tracking
  issued_at TIMESTAMP WITH TIME ZONE,
  issued_by UUID REFERENCES users(id),
  issued_to VARCHAR(500),         -- Email addresses
  reissued_at TIMESTAMP WITH TIME ZONE,
  reissue_reason TEXT,

  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shopping_packets_allocation ON shopping_packets(allocation_id);
CREATE INDEX IF NOT EXISTS idx_shopping_packets_car ON shopping_packets(car_number);
CREATE INDEX IF NOT EXISTS idx_shopping_packets_status ON shopping_packets(status);
CREATE INDEX IF NOT EXISTS idx_shopping_packets_issued ON shopping_packets(issued_at);

-- Unique constraint: only one active (non-superseded) packet per allocation
CREATE UNIQUE INDEX IF NOT EXISTS idx_shopping_packets_active
  ON shopping_packets(allocation_id)
  WHERE status != 'superseded';

-- View: Shopping packets with allocation info
CREATE OR REPLACE VIEW v_shopping_packets AS
SELECT
  sp.*,
  a.target_month,
  a.status AS allocation_status,
  a.work_type,
  u.email AS issued_by_email,
  uc.email AS created_by_email
FROM shopping_packets sp
JOIN allocations a ON a.id = sp.allocation_id
LEFT JOIN users u ON u.id = sp.issued_by
LEFT JOIN users uc ON uc.id = sp.created_by
ORDER BY sp.created_at DESC;

-- Function to generate packet number
CREATE OR REPLACE FUNCTION generate_packet_number() RETURNS VARCHAR(50) AS $$
BEGIN
  RETURN 'PKT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to create shopping packet for an allocation
CREATE OR REPLACE FUNCTION create_shopping_packet(
  p_allocation_id UUID,
  p_user_id UUID
) RETURNS UUID AS $$
DECLARE
  v_allocation RECORD;
  v_car RECORD;
  v_ccm RECORD;
  v_packet_id UUID;
  v_billable_items JSONB;
BEGIN
  -- Get allocation details
  SELECT * INTO v_allocation FROM allocations WHERE id = p_allocation_id;
  IF v_allocation IS NULL THEN
    RAISE EXCEPTION 'Allocation not found';
  END IF;

  -- Get car details
  SELECT * INTO v_car FROM cars WHERE car_number = v_allocation.car_number;

  -- Get current CCM document for lessee
  SELECT * INTO v_ccm
  FROM ccm_documents
  WHERE lessee_code = v_car.lessee_code AND is_current = TRUE
  LIMIT 1;

  -- Get applicable billable items
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'item_code', item_code,
    'item_description', item_description,
    'is_customer_responsible', is_customer_responsible
  )), '[]'::jsonb) INTO v_billable_items
  FROM billable_items
  WHERE lessee_code = v_car.lessee_code
    AND (rider_id IS NULL OR rider_id = v_car.rider_id)
    AND (commodity IS NULL OR commodity = v_car.commodity)
    AND (car_type IS NULL OR car_type = v_car.car_type);

  -- Create the packet
  INSERT INTO shopping_packets (
    allocation_id,
    packet_number,
    car_number,
    shop_code,
    shop_name,
    lessee_code,
    lessee_name,
    ccm_document_id,
    ccm_document_name,
    billable_items,
    created_by
  ) VALUES (
    p_allocation_id,
    generate_packet_number(),
    v_allocation.car_number,
    v_allocation.shop_code,
    (SELECT shop_name FROM shops WHERE shop_code = v_allocation.shop_code),
    v_car.lessee_code,
    v_car.lessee_name,
    v_ccm.id,
    v_ccm.document_name,
    v_billable_items,
    p_user_id
  ) RETURNING id INTO v_packet_id;

  RETURN v_packet_id;
END;
$$ LANGUAGE plpgsql;

-- Function to reissue a packet (creates new version, marks old as superseded)
CREATE OR REPLACE FUNCTION reissue_shopping_packet(
  p_packet_id UUID,
  p_user_id UUID,
  p_reason TEXT
) RETURNS UUID AS $$
DECLARE
  v_old_packet RECORD;
  v_new_packet_id UUID;
BEGIN
  -- Get old packet
  SELECT * INTO v_old_packet FROM shopping_packets WHERE id = p_packet_id;
  IF v_old_packet IS NULL THEN
    RAISE EXCEPTION 'Packet not found';
  END IF;

  -- Mark old packet as superseded
  UPDATE shopping_packets
  SET status = 'superseded', updated_at = NOW()
  WHERE id = p_packet_id;

  -- Create new packet version
  INSERT INTO shopping_packets (
    allocation_id,
    packet_number,
    version,
    status,
    car_number,
    shop_code,
    shop_name,
    lessee_code,
    lessee_name,
    shopping_types,
    shopping_reasons,
    scope_of_work,
    special_instructions,
    ccm_document_id,
    ccm_document_name,
    billable_items,
    reissue_reason,
    created_by
  ) VALUES (
    v_old_packet.allocation_id,
    v_old_packet.packet_number,
    v_old_packet.version + 1,
    'reissued',
    v_old_packet.car_number,
    v_old_packet.shop_code,
    v_old_packet.shop_name,
    v_old_packet.lessee_code,
    v_old_packet.lessee_name,
    v_old_packet.shopping_types,
    v_old_packet.shopping_reasons,
    v_old_packet.scope_of_work,
    v_old_packet.special_instructions,
    v_old_packet.ccm_document_id,
    v_old_packet.ccm_document_name,
    v_old_packet.billable_items,
    p_reason,
    p_user_id
  ) RETURNING id INTO v_new_packet_id;

  RETURN v_new_packet_id;
END;
$$ LANGUAGE plpgsql;

-- View: Packet history by allocation
CREATE OR REPLACE VIEW v_packet_history AS
SELECT
  sp.allocation_id,
  sp.packet_number,
  sp.version,
  sp.status,
  sp.issued_at,
  sp.reissued_at,
  sp.reissue_reason,
  sp.created_at,
  u.email AS created_by_email
FROM shopping_packets sp
LEFT JOIN users u ON u.id = sp.created_by
ORDER BY sp.allocation_id, sp.version DESC;

-- View: Packets pending issue
CREATE OR REPLACE VIEW v_packets_pending AS
SELECT * FROM v_shopping_packets
WHERE status = 'draft'
ORDER BY created_at;

-- View: Recently issued packets
CREATE OR REPLACE VIEW v_packets_recent AS
SELECT * FROM v_shopping_packets
WHERE status IN ('issued', 'reissued')
  AND issued_at >= NOW() - INTERVAL '7 days'
ORDER BY issued_at DESC;
