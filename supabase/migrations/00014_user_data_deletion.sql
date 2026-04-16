-- ============================================================
-- Migration: 00006_user_data_deletion.sql
-- Purpose: LGPD FR-018 — support for cascade user data deletion.
-- Approach: Hard-delete via service_role edge function, with
--            audit_log anonymization to preserve audit trail integrity.
-- ============================================================

-- Allow audit_logs.user_id to be NULL so records can be anonymized
-- (LGPD right to erasure while preserving audit trail for legal purposes)
ALTER TABLE public.audit_logs
  ALTER COLUMN user_id DROP NOT NULL;

-- ============================================================
-- Function: anonymize_user_audit_logs
-- Called during data deletion to nullify PII in audit_logs instead
-- of hard-deleting, preserving the audit trail for legal compliance.
-- Must be run with service_role (SECURITY DEFINER).
-- ============================================================
CREATE OR REPLACE FUNCTION public.anonymize_user_audit_logs(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE public.audit_logs
  SET user_id = NULL,
      metadata = metadata || '{"anonymized": true}'::jsonb
  WHERE user_id = p_user_id;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- Only service_role can call this function
REVOKE EXECUTE ON FUNCTION public.anonymize_user_audit_logs(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.anonymize_user_audit_logs(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.anonymize_user_audit_logs(UUID) FROM anon;

-- ============================================================
-- Function: hard_delete_user_data
-- Cascades deletion of all user records in dependency order.
-- Anonymizes audit_logs (LGPD-compliant) rather than deleting.
-- Must be invoked by service_role only.
-- ============================================================
CREATE OR REPLACE FUNCTION public.hard_delete_user_data(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_property_ids    UUID[];
  v_contract_ids    UUID[];
  v_inspection_ids  UUID[];
  v_invoice_ids     UUID[];
  v_summary         JSONB := '{}'::jsonb;
BEGIN
  -- Collect IDs
  SELECT ARRAY_AGG(id) INTO v_property_ids
  FROM public.properties WHERE owner_id = p_user_id;

  SELECT ARRAY_AGG(id) INTO v_contract_ids
  FROM public.contracts
  WHERE owner_id = p_user_id OR tenant_id = p_user_id;

  IF v_contract_ids IS NOT NULL THEN
    SELECT ARRAY_AGG(id) INTO v_inspection_ids
    FROM public.inspections WHERE contract_id = ANY(v_contract_ids);

    SELECT ARRAY_AGG(id) INTO v_invoice_ids
    FROM public.invoices WHERE contract_id = ANY(v_contract_ids);
  END IF;

  -- Delete in dependency order

  -- Inspection photos (FK → inspections ON DELETE CASCADE handles this,
  -- but explicit delete for clarity)
  IF v_inspection_ids IS NOT NULL THEN
    DELETE FROM public.inspection_photos WHERE inspection_id = ANY(v_inspection_ids);
    v_summary := v_summary || jsonb_build_object('inspection_photos', (SELECT COUNT(*) FROM public.inspection_photos WHERE FALSE));
  END IF;

  IF v_contract_ids IS NOT NULL THEN
    DELETE FROM public.inspections WHERE contract_id = ANY(v_contract_ids);
    DELETE FROM public.invoice_adjustments
      WHERE invoice_id = ANY(
        SELECT id FROM public.invoices WHERE contract_id = ANY(v_contract_ids)
      );
    DELETE FROM public.invoices WHERE contract_id = ANY(v_contract_ids);
    DELETE FROM public.documents WHERE contract_id = ANY(v_contract_ids);
    DELETE FROM public.contracts WHERE id = ANY(v_contract_ids);
  END IF;

  IF v_property_ids IS NOT NULL THEN
    DELETE FROM public.properties WHERE id = ANY(v_property_ids);
  END IF;

  DELETE FROM public.contract_templates WHERE owner_id = p_user_id;

  -- Anonymize audit_logs (preserve audit trail, remove PII)
  PERFORM public.anonymize_user_audit_logs(p_user_id);

  DELETE FROM public.profiles WHERE id = p_user_id;

  v_summary := jsonb_build_object(
    'user_id', p_user_id,
    'deleted', true,
    'audit_logs_anonymized', true
  );

  RETURN v_summary;
END;
$$;

-- Only service_role can call this function
REVOKE EXECUTE ON FUNCTION public.hard_delete_user_data(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.hard_delete_user_data(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.hard_delete_user_data(UUID) FROM anon;
