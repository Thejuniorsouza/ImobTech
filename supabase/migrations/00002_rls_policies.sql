-- ============================================================
-- Migration: 00002_rls_policies.sql
-- Purpose: Enable RLS on all tables, define access policies,
--          and create security-definer helper for tenant access.
-- ============================================================

-- ============================================================
-- Enable RLS on all public tables
-- ============================================================
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_photos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs          ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Security-definer helper: check if user is party to a contract
-- Used for tenant access to invoices, inspections, documents.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_contract_party(p_contract_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contracts
    WHERE id = p_contract_id
      AND (owner_id = auth.uid() OR tenant_id = auth.uid())
  );
$$;

-- ============================================================
-- profiles
-- ============================================================
CREATE POLICY "profiles: users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: service role can insert (via trigger)"
  ON public.profiles FOR INSERT
  WITH CHECK (true);  -- guarded by trigger + SECURITY DEFINER

-- ============================================================
-- properties
-- ============================================================
CREATE POLICY "properties: owner full access"
  ON public.properties FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- contract_templates
-- ============================================================
CREATE POLICY "templates: read system or own"
  ON public.contract_templates FOR SELECT
  USING (is_system = true OR owner_id = auth.uid());

CREATE POLICY "templates: owner can insert own"
  ON public.contract_templates FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "templates: owner can update own"
  ON public.contract_templates FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "templates: owner can delete own"
  ON public.contract_templates FOR DELETE
  USING (owner_id = auth.uid());

-- ============================================================
-- contracts
-- ============================================================
CREATE POLICY "contracts: parties can read"
  ON public.contracts FOR SELECT
  USING (owner_id = auth.uid() OR tenant_id = auth.uid());

CREATE POLICY "contracts: owner can insert"
  ON public.contracts FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "contracts: owner can update"
  ON public.contracts FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- invoices
-- ============================================================
CREATE POLICY "invoices: parties can read via contract"
  ON public.invoices FOR SELECT
  USING (public.is_contract_party(contract_id));

CREATE POLICY "invoices: owner can update status via contract"
  ON public.invoices FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts
      WHERE id = contract_id AND owner_id = auth.uid()
    )
  );

-- INSERT is handled by Edge Functions (service_role bypasses RLS)

-- ============================================================
-- invoice_adjustments
-- ============================================================
CREATE POLICY "adjustments: read via contract party"
  ON public.invoice_adjustments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id AND public.is_contract_party(i.contract_id)
    )
  );

CREATE POLICY "adjustments: owner can insert"
  ON public.invoice_adjustments FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.invoices i
      JOIN public.contracts c ON c.id = i.contract_id
      WHERE i.id = invoice_id AND c.owner_id = auth.uid()
    )
  );

-- ============================================================
-- inspections
-- ============================================================
CREATE POLICY "inspections: read via contract party"
  ON public.inspections FOR SELECT
  USING (public.is_contract_party(contract_id));

CREATE POLICY "inspections: owner can insert"
  ON public.inspections FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.contracts
      WHERE id = contract_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "inspections: owner can update"
  ON public.inspections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts
      WHERE id = contract_id AND owner_id = auth.uid()
    )
  );

-- ============================================================
-- inspection_photos
-- ============================================================
CREATE POLICY "inspection_photos: read via contract party"
  ON public.inspection_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.inspections ins
      WHERE ins.id = inspection_id AND public.is_contract_party(ins.contract_id)
    )
  );

CREATE POLICY "inspection_photos: owner can insert"
  ON public.inspection_photos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inspections ins
      JOIN public.contracts c ON c.id = ins.contract_id
      WHERE ins.id = inspection_id AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "inspection_photos: owner can delete"
  ON public.inspection_photos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.inspections ins
      JOIN public.contracts c ON c.id = ins.contract_id
      WHERE ins.id = inspection_id AND c.owner_id = auth.uid()
    )
  );

-- ============================================================
-- documents
-- ============================================================
CREATE POLICY "documents: parties can read"
  ON public.documents FOR SELECT
  USING (public.is_contract_party(contract_id));

CREATE POLICY "documents: parties can insert"
  ON public.documents FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid() AND
    public.is_contract_party(contract_id)
  );

CREATE POLICY "documents: uploader can delete own"
  ON public.documents FOR DELETE
  USING (uploaded_by = auth.uid());

-- ============================================================
-- audit_logs (append-only — no SELECT policy for regular users)
-- Service role and triggers write; no user SELECT allowed.
-- ============================================================
-- Intentionally no policies: audit_logs are internal only.
-- Access only via service_role (Edge Functions) or DB admin.
