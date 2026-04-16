-- Migration: Allow contract owners to insert invoices directly
-- Previously only Edge Functions (service_role) could insert.
-- ============================================================
CREATE POLICY "invoices: owner can insert via contract"
  ON public.invoices FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contracts
      WHERE id = contract_id AND owner_id = auth.uid()
    )
  );
