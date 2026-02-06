-- Migration 041: Add car_id UUID FK to Remaining Denormalized Tables
-- Adds proper car_id UUID references to tables that currently only have car_number.

-- shopping_events (has existing car_id column that is NULL - rename it first)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopping_events' AND column_name = 'car_id'
  ) THEN
    ALTER TABLE shopping_events RENAME COLUMN car_id TO car_mark_number;
  END IF;
END $$;

ALTER TABLE shopping_events ADD COLUMN IF NOT EXISTS car_id UUID REFERENCES cars(id);
UPDATE shopping_events se SET car_id = c.id
  FROM cars c WHERE se.car_number = c.car_number AND se.car_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_shopping_events_car_id ON shopping_events(car_id);

-- shopping_packets
ALTER TABLE shopping_packets ADD COLUMN IF NOT EXISTS car_id UUID REFERENCES cars(id);
UPDATE shopping_packets sp SET car_id = c.id
  FROM cars c WHERE sp.car_number = c.car_number AND sp.car_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_shopping_packets_car_id ON shopping_packets(car_id);

-- project_assignments
ALTER TABLE project_assignments ADD COLUMN IF NOT EXISTS car_id UUID REFERENCES cars(id);
UPDATE project_assignments pa SET car_id = c.id
  FROM cars c WHERE pa.car_number = c.car_number AND pa.car_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_project_assignments_car_id ON project_assignments(car_id);

-- bad_order_reports
ALTER TABLE bad_order_reports ADD COLUMN IF NOT EXISTS car_id UUID REFERENCES cars(id);
UPDATE bad_order_reports bor SET car_id = c.id
  FROM cars c WHERE bor.car_number = c.car_number AND bor.car_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_bad_order_reports_car_id ON bad_order_reports(car_id);

-- invoice_line_items
ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS car_id UUID REFERENCES cars(id);
UPDATE invoice_line_items ili SET car_id = c.id
  FROM cars c WHERE ili.car_number = c.car_number AND ili.car_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_car_id ON invoice_line_items(car_id);
