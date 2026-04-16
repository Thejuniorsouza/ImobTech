-- Add optional description field to invoices
-- Used to store proration notes (e.g. "proporcional: 18 de 30 dias")
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS description TEXT;
