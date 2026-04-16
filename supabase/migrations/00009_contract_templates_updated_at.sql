-- Migration: Add updated_at to contract_templates
-- The set_updated_at trigger (from 00005) already targets this table,
-- but the column was missing, causing "record new has no field updated_at".

ALTER TABLE public.contract_templates
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
