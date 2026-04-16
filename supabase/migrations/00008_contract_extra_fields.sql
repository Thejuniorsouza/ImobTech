-- Migration: Add extra fields for complete physical contract generation
-- ============================================================

-- contracts: additional tenant snapshot fields
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS tenant_email       TEXT,
  ADD COLUMN IF NOT EXISTS tenant_phone       VARCHAR(15),
  ADD COLUMN IF NOT EXISTS tenant_nationality TEXT,
  ADD COLUMN IF NOT EXISTS tenant_marital_status TEXT,
  ADD COLUMN IF NOT EXISTS tenant_profession  TEXT;

-- properties: registration number (número de matrícula do imóvel)
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS registration_number TEXT;

-- profiles: personal data used for owner info in contracts
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nationality    TEXT,
  ADD COLUMN IF NOT EXISTS marital_status TEXT,
  ADD COLUMN IF NOT EXISTS profession     TEXT;
