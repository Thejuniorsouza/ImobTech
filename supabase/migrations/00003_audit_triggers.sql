-- ============================================================
-- Migration: 00003_audit_triggers.sql
-- Purpose: Append-only audit logging on critical tables.
--          Revoke destructive permissions on audit_logs table.
-- ============================================================

-- ============================================================
-- Core audit function (SECURITY DEFINER to access auth.uid())
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action     VARCHAR(20);
  v_old_values JSONB := NULL;
  v_new_values JSONB := NULL;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action     := 'CREATE';
    v_new_values := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Detect status-only changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'STATUS_CHANGE';
    ELSE
      v_action := 'UPDATE';
    END IF;
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action     := 'DELETE';
    v_old_values := to_jsonb(OLD);
  END IF;

  INSERT INTO public.audit_logs (entity_type, entity_id, action, old_values, new_values, user_id)
  VALUES (
    TG_TABLE_NAME,
    CASE
      WHEN TG_OP = 'DELETE' THEN (OLD.id)::UUID
      ELSE (NEW.id)::UUID
    END,
    v_action,
    v_old_values,
    v_new_values,
    auth.uid()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================
-- Attach audit triggers to critical tables
-- ============================================================
CREATE TRIGGER trg_audit_contracts
  AFTER INSERT OR UPDATE OR DELETE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER trg_audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER trg_audit_properties
  AFTER INSERT OR UPDATE OR DELETE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER trg_audit_invoice_adjustments
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- ============================================================
-- Revoke destructive permissions on audit_logs (Constituição §I)
-- Revoke from PUBLIC and specific roles to enforce append-only.
-- ============================================================
REVOKE DELETE ON public.audit_logs FROM PUBLIC;
REVOKE UPDATE ON public.audit_logs FROM PUBLIC;
