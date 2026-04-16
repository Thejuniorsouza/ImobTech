-- ============================================================
-- Migration 00010: Allow updating paid_at on paid invoices
-- ============================================================
-- Previously the trigger blocked ALL updates to paid invoices.
-- Now only the paid_at column is mutable after payment, so owners
-- can correct the recorded payment date without altering the
-- financial amount, type, or billing period.
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_paid_invoice_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'paid' THEN
    -- Allow the update only when the invoice remains paid AND
    -- the only column that changed is paid_at.
    IF NEW.status           = OLD.status
       AND NEW.amount_cents    = OLD.amount_cents
       AND NEW.contract_id     = OLD.contract_id
       AND NEW.invoice_type    = OLD.invoice_type
       AND NEW.due_date        = OLD.due_date
       AND NEW.competencia_month = OLD.competencia_month
    THEN
      RETURN NEW;  -- only paid_at changed → allow
    END IF;

    RAISE EXCEPTION
      'Faturas pagas são imutáveis. Apenas a data de pagamento pode ser corrigida.';
  END IF;

  RETURN NEW;
END;
$$;
