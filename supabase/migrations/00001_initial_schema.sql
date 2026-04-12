-- ============================================================
-- Migration: 00001_initial_schema.sql
-- Purpose: Create all domain tables, triggers for immutability,
--          auto-profile creation, and property deletion guard.
-- Convention: All monetary values stored as BIGINT (centavos).
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Table: profiles
-- ============================================================
CREATE TABLE public.profiles (
  id          UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT         NOT NULL CHECK (role IN ('owner', 'tenant')),
  full_name   TEXT         NOT NULL,
  cpf         VARCHAR(11)  NOT NULL UNIQUE,
  email       TEXT         NOT NULL,
  phone       VARCHAR(15),
  rg          VARCHAR(20),
  address     TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Table: properties
-- ============================================================
CREATE TABLE public.properties (
  id                   UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             UUID           NOT NULL REFERENCES public.profiles(id),
  address_street       TEXT           NOT NULL,
  address_number       TEXT           NOT NULL,
  address_complement   TEXT,
  address_neighborhood TEXT           NOT NULL,
  address_city         TEXT           NOT NULL,
  address_state        VARCHAR(2)     NOT NULL,
  address_zip          VARCHAR(8)     NOT NULL,
  property_type        TEXT           NOT NULL CHECK (property_type IN ('house', 'apartment', 'commercial')),
  area_sqm             NUMERIC(10,2),
  bedrooms             SMALLINT       DEFAULT 0,
  bathrooms            SMALLINT       DEFAULT 0,
  parking_spaces       SMALLINT       DEFAULT 0,
  iptu_monthly_cents   BIGINT         DEFAULT 0,
  condo_monthly_cents  BIGINT         DEFAULT 0,
  status               TEXT           NOT NULL DEFAULT 'vacant' CHECK (status IN ('vacant', 'rented')),
  description          TEXT,
  created_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_properties_owner_id ON public.properties (owner_id);
CREATE INDEX idx_properties_status   ON public.properties (owner_id, status);

-- ============================================================
-- Table: contract_templates
-- ============================================================
CREATE TABLE public.contract_templates (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID         REFERENCES public.profiles(id),
  name       TEXT         NOT NULL,
  body       TEXT         NOT NULL,
  is_system  BOOLEAN      NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Table: contracts
-- ============================================================
CREATE TABLE public.contracts (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id          UUID         NOT NULL REFERENCES public.properties(id),
  owner_id             UUID         NOT NULL REFERENCES public.profiles(id),
  tenant_id            UUID         NOT NULL REFERENCES public.profiles(id),
  template_id          UUID         REFERENCES public.contract_templates(id),
  rent_amount_cents    BIGINT       NOT NULL,
  deposit_amount_cents BIGINT       NOT NULL DEFAULT 0,
  due_day              SMALLINT     NOT NULL CHECK (due_day BETWEEN 1 AND 28),
  start_date           DATE         NOT NULL,
  end_date             DATE         NOT NULL,
  status               TEXT         NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'terminated')),
  pdf_storage_path     TEXT,
  -- Snapshot fields preserved at contract creation time
  tenant_name          TEXT         NOT NULL,
  tenant_cpf           VARCHAR(11)  NOT NULL,
  tenant_rg            VARCHAR(20),
  tenant_address       TEXT,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_contracts_date_range CHECK (end_date > start_date)
);

CREATE INDEX idx_contracts_owner_id    ON public.contracts (owner_id);
CREATE INDEX idx_contracts_tenant_id   ON public.contracts (tenant_id);
CREATE INDEX idx_contracts_property_id ON public.contracts (property_id);
CREATE INDEX idx_contracts_status      ON public.contracts (owner_id, status);

-- ============================================================
-- Table: invoices
-- ============================================================
CREATE TABLE public.invoices (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id        UUID         NOT NULL REFERENCES public.contracts(id),
  competencia_month  DATE         NOT NULL,
  invoice_type       TEXT         NOT NULL CHECK (invoice_type IN ('rent', 'deposit', 'iptu', 'condo')),
  amount_cents       BIGINT       NOT NULL,
  due_date           DATE         NOT NULL,
  status             TEXT         NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  paid_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- Idempotency constraint (Constituição §II)
  CONSTRAINT uq_invoices_idempotent UNIQUE (contract_id, competencia_month, invoice_type)
);

CREATE INDEX idx_invoices_contract_id ON public.invoices (contract_id);
CREATE INDEX idx_invoices_due_date    ON public.invoices (due_date);
CREATE INDEX idx_invoices_status      ON public.invoices (contract_id, status);

-- ============================================================
-- Table: invoice_adjustments
-- ============================================================
CREATE TABLE public.invoice_adjustments (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       UUID         NOT NULL REFERENCES public.invoices(id),
  adjustment_type  TEXT         NOT NULL CHECK (adjustment_type IN ('refund', 'correction')),
  amount_cents     BIGINT       NOT NULL,
  reason           TEXT         NOT NULL,
  created_by       UUID         NOT NULL REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Table: inspections
-- ============================================================
CREATE TABLE public.inspections (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id      UUID         NOT NULL REFERENCES public.contracts(id),
  property_id      UUID         NOT NULL REFERENCES public.properties(id),
  inspection_type  TEXT         NOT NULL CHECK (inspection_type IN ('entry', 'exit')),
  notes            TEXT,
  created_by       UUID         NOT NULL REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- At most one entry and one exit inspection per contract
  CONSTRAINT uq_inspection_type UNIQUE (contract_id, inspection_type)
);

-- ============================================================
-- Table: inspection_photos
-- ============================================================
CREATE TABLE public.inspection_photos (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id  UUID         NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  room_name      TEXT         NOT NULL,
  storage_path   TEXT         NOT NULL,
  description    TEXT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Table: documents
-- ============================================================
CREATE TABLE public.documents (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id    UUID         NOT NULL REFERENCES public.contracts(id),
  uploaded_by    UUID         NOT NULL REFERENCES public.profiles(id),
  document_type  TEXT         CHECK (document_type IN ('comprovante', 'ordem_servico', 'comunicado', 'laudo', 'outro')),
  description    TEXT,
  file_name      TEXT         NOT NULL,
  storage_path   TEXT         NOT NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Table: audit_logs (append-only, Constituição §I)
-- ============================================================
CREATE TABLE public.audit_logs (
  id           BIGSERIAL    PRIMARY KEY,
  entity_type  VARCHAR(50)  NOT NULL,
  entity_id    UUID         NOT NULL,
  action       VARCHAR(20)  NOT NULL,
  old_values   JSONB,
  new_values   JSONB,
  user_id      UUID,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  metadata     JSONB
);

-- ============================================================
-- Trigger: auto-create profile on auth.users insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, cpf, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'owner'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'cpf', ''),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Trigger: immutability — paid invoices cannot be updated
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_paid_invoice_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'paid' THEN
    RAISE EXCEPTION 'Faturas pagas são imutáveis. Use invoice_adjustments para correções.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invoices_immutability
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_paid_invoice_update();

-- ============================================================
-- Trigger: guard — cannot delete property with active contract
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_property_delete_with_active_contract()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.contracts
    WHERE property_id = OLD.id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Não é possível excluir um imóvel com contrato ativo.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_properties_delete_guard
  BEFORE DELETE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_property_delete_with_active_contract();

-- ============================================================
-- Trigger: updated_at auto-refresh for all mutable tables
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at    BEFORE UPDATE ON public.profiles    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_properties_updated_at  BEFORE UPDATE ON public.properties  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_contracts_updated_at   BEFORE UPDATE ON public.contracts   FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_invoices_updated_at    BEFORE UPDATE ON public.invoices    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
