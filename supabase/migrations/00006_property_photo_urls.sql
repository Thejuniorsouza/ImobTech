-- Migration: Add photo_urls column to properties table
-- ============================================================
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS photo_urls TEXT[] NOT NULL DEFAULT '{}';
