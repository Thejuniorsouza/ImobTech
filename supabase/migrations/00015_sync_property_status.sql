-- Migration: 00015_sync_property_status
-- Keeps property.status in sync with its contract status automatically.
--
-- Rules:
--   contract inserted/updated → active    : property → rented
--   contract updated          → terminated/expired : property → vacant
--                                           (only if no other active contract exists)

CREATE OR REPLACE FUNCTION sync_property_status_from_contract()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE properties SET status = 'rented' WHERE id = NEW.property_id;

  ELSIF NEW.status IN ('terminated', 'expired') THEN
    -- Only vacate if no other active contract references this property
    IF NOT EXISTS (
      SELECT 1 FROM contracts
      WHERE property_id = NEW.property_id
        AND status = 'active'
        AND id <> NEW.id
    ) THEN
      UPDATE properties SET status = 'vacant' WHERE id = NEW.property_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Fires on INSERT (new active contract) and UPDATE (status transitions)
DROP TRIGGER IF EXISTS trg_sync_property_status ON contracts;
CREATE TRIGGER trg_sync_property_status
  AFTER INSERT OR UPDATE OF status ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION sync_property_status_from_contract();

-- Fix any existing inconsistencies
UPDATE properties p
SET status = 'rented'
WHERE EXISTS (
  SELECT 1 FROM contracts c
  WHERE c.property_id = p.id AND c.status = 'active'
)
AND p.status != 'rented';

UPDATE properties p
SET status = 'vacant'
WHERE NOT EXISTS (
  SELECT 1 FROM contracts c
  WHERE c.property_id = p.id AND c.status = 'active'
)
AND p.status = 'rented';
