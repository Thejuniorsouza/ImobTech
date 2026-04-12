-- Migration: 00005_updated_at_triggers.sql
-- Ensures all tables with updated_at column auto-update the timestamp on row changes.

-- Re-usable trigger function (idempotent — already created in 00001, kept here for clarity)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers for tables that have updated_at but may be missing them
-- (using CREATE OR REPLACE equivalence via DROP + CREATE pattern for idempotency)

DO $$
DECLARE
  _tables TEXT[] := ARRAY[
    'profiles',
    'properties',
    'contracts',
    'invoices',
    'contract_templates'
  ];
  _t TEXT;
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    -- Drop existing trigger if any (idempotent)
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON %I',
      _t
    );
    -- Create trigger
    EXECUTE format(
      'CREATE TRIGGER set_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW
       EXECUTE FUNCTION update_updated_at_column()',
      _t
    );
  END LOOP;
END;
$$;
