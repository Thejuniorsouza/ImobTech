-- ============================================================
-- Migration 00011: Relax paid-invoice immutability trigger
-- ============================================================
-- Rules:
--   1. paid → paid  : only paid_at may change (correct date)
--   2. paid → other : always allowed (manual reversion)
--   3. other → any  : always allowed
-- Financial fields (amount_cents, invoice_type, competencia_month,
-- due_date) remain immutable while status stays paid.
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_paid_invoice_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only restrict when the invoice WAS paid
  IF OLD.status = 'paid' THEN

    -- Allow reverting to any other status (manual correction)
    IF NEW.status <> 'paid' THEN
      RETURN NEW;
    END IF;

    -- Status stays paid → only paid_at may change
    IF NEW.amount_cents      = OLD.amount_cents
       AND NEW.contract_id      = OLD.contract_id
       AND NEW.invoice_type     = OLD.invoice_type
       AND NEW.due_date         = OLD.due_date
       AND NEW.competencia_month = OLD.competencia_month
    THEN
      RETURN NEW;  -- only paid_at changed → allow
    END IF;

    RAISE EXCEPTION
      'Faturas pagas são imutáveis. Para corrigir, reverta o status primeiro.';
  END IF;

  RETURN NEW;
END;
$$;
