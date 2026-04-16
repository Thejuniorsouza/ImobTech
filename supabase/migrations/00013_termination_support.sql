-- Migration: 00013_termination_support.sql
-- Adds support for contract termination:
--   • 'cancelled' invoice status (for future invoices voided on termination)
--   • 'fine' invoice type (multa rescisória)
--   • 'expired' contract status (natural end-of-term)

-- 1. Invoice status: add 'cancelled'
ALTER TABLE invoices
    DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices
    ADD CONSTRAINT invoices_status_check
        CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled'));

-- 2. Invoice type: add 'fine'  (drop idempotency unique to allow re-adding)
ALTER TABLE invoices
    DROP CONSTRAINT IF EXISTS uq_invoices_idempotent;
ALTER TABLE invoices
    DROP CONSTRAINT IF EXISTS invoices_invoice_type_check;
ALTER TABLE invoices
    ADD CONSTRAINT invoices_invoice_type_check
        CHECK (invoice_type IN ('rent', 'deposit', 'iptu', 'condo', 'fine', 'other'));
-- Restore idempotency constraint only for the original invoice types
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_idempotent
    ON invoices (contract_id, competencia_month, invoice_type)
    WHERE invoice_type NOT IN ('fine', 'other');

-- 3. Contract status: add 'expired'
ALTER TABLE contracts
    DROP CONSTRAINT IF EXISTS contracts_status_check;
ALTER TABLE contracts
    ADD CONSTRAINT contracts_status_check
        CHECK (status IN ('active', 'terminated', 'expired'));
