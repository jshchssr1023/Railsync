-- Migration 025: Invoice Seed Data
-- Sample invoices for testing and demo

-- First, ensure we have some allocations with BRC data to match against
-- Update a few existing allocations with actual costs (using subquery for LIMIT)
UPDATE allocations
SET actual_cost = estimated_cost * (0.95 + random() * 0.1),
    brc_number = 'BRC-' || LPAD(FLOOR(random() * 100000)::TEXT, 6, '0'),
    actual_cost_breakdown = jsonb_build_object(
        'job_codes', jsonb_build_array(
            jsonb_build_object('code', 'TQT', 'amount', estimated_cost * 0.4),
            jsonb_build_object('code', 'VLV', 'amount', estimated_cost * 0.3),
            jsonb_build_object('code', 'PRV', 'amount', estimated_cost * 0.3)
        ),
        'why_made_code', 'QT'
    ),
    status = 'completed'
WHERE id IN (
    SELECT id FROM allocations
    WHERE status IN ('in_shop', 'confirmed', 'planned')
      AND actual_cost IS NULL
    LIMIT 20
);

-- Get existing shop codes for seed data
DO $$
DECLARE
    shop1 TEXT;
    shop2 TEXT;
    shop3 TEXT;
BEGIN
    -- Get actual shop codes from the database
    SELECT shop_code INTO shop1 FROM shops WHERE is_active = TRUE LIMIT 1 OFFSET 0;
    SELECT shop_code INTO shop2 FROM shops WHERE is_active = TRUE LIMIT 1 OFFSET 1;
    SELECT shop_code INTO shop3 FROM shops WHERE is_active = TRUE LIMIT 1 OFFSET 2;

    -- Use defaults if shops don't exist
    shop1 := COALESCE(shop1, 'AITX-HOU');
    shop2 := COALESCE(shop2, 'AITX-HOU');
    shop3 := COALESCE(shop3, 'AITX-HOU');

    -- Create sample invoices with various statuses
    INSERT INTO invoices (
        invoice_number, vendor_code, shop_code, invoice_date, received_date,
        invoice_total, status, original_filename, file_format
    ) VALUES
    -- Auto-approved invoices (within 3% tolerance)
    ('INV-2026-001', 'VENDOR-A', shop1, '2026-01-15', '2026-01-18', 15250.00, 'auto_approved', 'invoice_001.pdf', 'pdf'),
    ('INV-2026-002', 'VENDOR-B', shop2, '2026-01-16', '2026-01-19', 22340.50, 'auto_approved', 'invoice_002.pdf', 'pdf'),
    ('INV-2026-003', 'VENDOR-A', shop3, '2026-01-17', '2026-01-20', 18500.00, 'sent_to_sap', 'invoice_003.edi', 'edi500'),

    -- Manual review required (outside tolerance or unmatched lines)
    ('INV-2026-004', 'VENDOR-C', shop1, '2026-01-20', '2026-01-22', 45600.00, 'manual_review', 'invoice_004.pdf', 'pdf'),
    ('INV-2026-005', 'VENDOR-B', shop2, '2026-01-21', '2026-01-24', 12750.00, 'manual_review', 'invoice_005.pdf', 'pdf'),

    -- Pending invoices
    ('INV-2026-006', 'VENDOR-A', shop3, '2026-01-25', '2026-01-27', 33200.00, 'pending', 'invoice_006.pdf', 'pdf'),
    ('INV-2026-007', 'VENDOR-D', shop1, '2026-01-26', '2026-01-28', 28450.75, 'pending', 'invoice_007.edi', 'edi500'),
    ('INV-2026-008', 'VENDOR-C', shop2, '2026-01-28', '2026-01-30', 19800.00, 'pending', 'invoice_008.pdf', 'pdf'),

    -- Approved (ready for SAP)
    ('INV-2026-009', 'VENDOR-B', shop1, '2026-01-29', '2026-01-31', 41200.00, 'approved', 'invoice_009.pdf', 'pdf'),

    -- Rejected
    ('INV-2026-010', 'VENDOR-A', shop3, '2026-01-30', '2026-02-01', 55000.00, 'rejected', 'invoice_010.pdf', 'pdf')
    ON CONFLICT DO NOTHING;
END $$;

-- Add line items to the invoices
DO $$
DECLARE
    inv RECORD;
    line_num INTEGER;
    car_rec RECORD;
    alloc_rec RECORD;
BEGIN
    FOR inv IN SELECT id, invoice_number, shop_code, invoice_total FROM invoices WHERE match_count = 0 LOOP
        line_num := 1;

        -- Get some cars that have allocations at this shop
        FOR car_rec IN
            SELECT DISTINCT c.car_number, c.car_mark
            FROM cars c
            JOIN allocations a ON c.car_number = a.car_number
            WHERE a.shop_code = inv.shop_code
            LIMIT 5
        LOOP
            -- Get allocation for this car
            SELECT id, actual_cost, brc_number INTO alloc_rec
            FROM allocations
            WHERE car_number = car_rec.car_number
              AND shop_code = inv.shop_code
              AND actual_cost IS NOT NULL
            LIMIT 1;

            IF alloc_rec.id IS NOT NULL THEN
                -- Create line item
                INSERT INTO invoice_line_items (
                    invoice_id, line_number, car_number, brc_number,
                    job_code, why_made_code,
                    labor_amount, material_amount, total_amount,
                    match_status, matched_allocation_id, match_confidence
                ) VALUES (
                    inv.id,
                    line_num,
                    car_rec.car_number,
                    alloc_rec.brc_number,
                    CASE WHEN random() > 0.3 THEN 'TQT' ELSE 'VLV' END,
                    CASE WHEN random() > 0.5 THEN 'QT' ELSE 'BO' END,
                    COALESCE(alloc_rec.actual_cost, 1000) * 0.4,
                    COALESCE(alloc_rec.actual_cost, 1000) * 0.6,
                    COALESCE(alloc_rec.actual_cost, 1000) * (0.97 + random() * 0.06),
                    CASE
                        WHEN random() > 0.7 THEN 'exact_match'
                        WHEN random() > 0.4 THEN 'close_match'
                        ELSE 'no_match'
                    END,
                    alloc_rec.id,
                    CASE
                        WHEN random() > 0.7 THEN 95
                        WHEN random() > 0.4 THEN 80
                        ELSE 45
                    END
                );

                -- Create BRC match record
                INSERT INTO invoice_brc_matches (
                    invoice_id, allocation_id, brc_number, brc_total, invoice_amount, match_type
                ) VALUES (
                    inv.id,
                    alloc_rec.id,
                    alloc_rec.brc_number,
                    alloc_rec.actual_cost,
                    COALESCE(alloc_rec.actual_cost, 1000) * (0.97 + random() * 0.06),
                    CASE WHEN random() > 0.5 THEN 'exact' ELSE 'close' END
                );

                line_num := line_num + 1;
            END IF;
        END LOOP;

        -- Update invoice with calculated totals
        UPDATE invoices i SET
            brc_total = (SELECT COALESCE(SUM(brc_total), 0) FROM invoice_brc_matches WHERE invoice_id = i.id),
            match_count = (SELECT COUNT(*) FROM invoice_line_items WHERE invoice_id = i.id AND match_status != 'no_match'),
            exact_match_count = (SELECT COUNT(*) FROM invoice_line_items WHERE invoice_id = i.id AND match_status = 'exact_match'),
            close_match_count = (SELECT COUNT(*) FROM invoice_line_items WHERE invoice_id = i.id AND match_status = 'close_match'),
            unmatched_count = (SELECT COUNT(*) FROM invoice_line_items WHERE invoice_id = i.id AND match_status IN ('no_match', 'pending'))
        WHERE i.id = inv.id;

        -- Calculate variance
        UPDATE invoices SET
            variance_amount = invoice_total - COALESCE(brc_total, 0),
            variance_pct = CASE
                WHEN brc_total > 0 THEN ((invoice_total - brc_total) / brc_total) * 100
                ELSE 0
            END
        WHERE id = inv.id;

    END LOOP;
END $$;

-- Add approval notes to rejected invoice
UPDATE invoices
SET approval_notes = 'BRC total significantly different from invoice. Line items do not match expected work scope. Returning to vendor for clarification.',
    reviewed_at = NOW() - INTERVAL '1 day'
WHERE invoice_number = 'INV-2026-010';

-- Add SAP document ID to sent invoice
UPDATE invoices
SET sap_document_id = 'SAP1706500000123',
    sent_to_sap_at = NOW() - INTERVAL '3 days',
    sap_response = '{"status": "CREATED", "message": "Document posted successfully"}'::jsonb
WHERE invoice_number = 'INV-2026-003';

-- Create index for search performance
CREATE INDEX IF NOT EXISTS idx_invoices_search ON invoices USING gin (
    to_tsvector('english', invoice_number || ' ' || COALESCE(vendor_code, '') || ' ' || COALESCE(shop_code, ''))
);
