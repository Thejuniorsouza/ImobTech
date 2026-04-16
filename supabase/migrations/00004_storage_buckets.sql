-- ============================================================
-- Migration: 00004_storage_buckets.sql
-- Purpose: Create Supabase Storage buckets with RLS policies.
--          All buckets are private (public=false).
-- ============================================================

-- ============================================================
-- Create buckets
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('property-photos',    'property-photos',    true,  10485760, ARRAY['image/jpeg','image/png','image/webp']),
  ('inspection-photos',  'inspection-photos',  false, 10485760, ARRAY['image/jpeg','image/png','image/webp']),
  ('shared-documents',   'shared-documents',   false, 52428800, NULL),
  ('contract-pdfs',      'contract-pdfs',      false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- property-photos RLS
-- Path format: {owner_id}/{property_id}/{filename}
-- Only the property owner can manage their photos.
-- ============================================================
CREATE POLICY "property-photos: owner can upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'property-photos' AND
    (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "property-photos: owner can read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'property-photos' AND
    (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "property-photos: owner can delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'property-photos' AND
    (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- ============================================================
-- inspection-photos RLS
-- Path format: {owner_id}/{contract_id}/{inspection_id}/{filename}
-- Owner can manage; tenant can read via contract.
-- ============================================================
CREATE POLICY "inspection-photos: owner can upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'inspection-photos' AND
    (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "inspection-photos: parties can read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'inspection-photos' AND
    EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id::TEXT = (storage.foldername(name))[2]
        AND (c.owner_id = auth.uid() OR c.tenant_id = auth.uid())
    )
  );

CREATE POLICY "inspection-photos: owner can delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'inspection-photos' AND
    (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- ============================================================
-- shared-documents RLS
-- Path format: {contract_id}/{uploader_id}/{filename}
-- Both parties can upload and read; only uploader can delete.
-- ============================================================
CREATE POLICY "shared-documents: parties can upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'shared-documents' AND
    public.is_contract_party((storage.foldername(name))[1]::UUID)
  );

CREATE POLICY "shared-documents: parties can read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'shared-documents' AND
    public.is_contract_party((storage.foldername(name))[1]::UUID)
  );

CREATE POLICY "shared-documents: uploader can delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'shared-documents' AND
    (storage.foldername(name))[2] = auth.uid()::TEXT
  );

-- ============================================================
-- contract-pdfs RLS
-- Path format: {owner_id}/{contract_id}/contract.pdf
-- Parties can read; only service_role writes (Edge Function).
-- ============================================================
CREATE POLICY "contract-pdfs: parties can read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'contract-pdfs' AND
    EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id::TEXT = (storage.foldername(name))[2]
        AND (c.owner_id = auth.uid() OR c.tenant_id = auth.uid())
    )
  );
-- INSERT/DELETE handled by service_role in Edge Functions only.
