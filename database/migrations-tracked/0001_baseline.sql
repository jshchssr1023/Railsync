-- Baseline migration: marks existing schema as tracked.
-- All tables from schema.sql, seed.sql, and migrations 001-028 are already applied.
-- This migration exists so node-pg-migrate has a starting point.
-- Future migrations go in this directory and are applied with: npm run migrate:up

-- Verify baseline tables exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    RAISE EXCEPTION 'Baseline check failed: users table does not exist. Run initial schema first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shopping_events') THEN
    RAISE EXCEPTION 'Baseline check failed: shopping_events table does not exist. Run all migrations first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ccm_forms') THEN
    RAISE EXCEPTION 'Baseline check failed: ccm_forms table does not exist. Run all migrations first.';
  END IF;
  RAISE NOTICE 'Baseline verification passed. All expected tables exist.';
END $$;
