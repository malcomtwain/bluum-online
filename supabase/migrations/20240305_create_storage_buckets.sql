-- Migration: Create Supabase Storage buckets
-- Date: 2024-03-05
-- Description: Create required storage buckets for Bluum video generator

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Allow invitation users uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow invitation users updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow invitation users deletes" ON storage.objects;

-- Create storage buckets for different content types
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('templates', 'templates', true, 10485760, ARRAY['image/*', 'video/*']),
  ('media', 'media', true, 10485760, ARRAY['image/*', 'video/*']),
  ('music', 'music', true, 10485760, ARRAY['audio/*']),
  ('generated', 'generated', true, 10485760, ARRAY['video/*']),
  ('clips', 'clips', true, 10485760, ARRAY['video/*'])
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies to allow public read access to all buckets
CREATE POLICY "bluum_public_read_access" ON storage.objects
FOR SELECT USING (bucket_id IN ('templates', 'media', 'music', 'generated', 'clips'));

-- Create RLS policies to allow authenticated users to upload files
CREATE POLICY "bluum_authenticated_uploads" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id IN ('templates', 'media', 'music', 'generated', 'clips') AND
  auth.role() = 'authenticated'
);

-- Create RLS policies to allow authenticated users to update their files
CREATE POLICY "bluum_authenticated_updates" ON storage.objects
FOR UPDATE USING (
  bucket_id IN ('templates', 'media', 'music', 'generated', 'clips') AND
  auth.role() = 'authenticated'
);

-- Create RLS policies to allow authenticated users to delete their files
CREATE POLICY "bluum_authenticated_deletes" ON storage.objects
FOR DELETE USING (
  bucket_id IN ('templates', 'media', 'music', 'generated', 'clips') AND
  auth.role() = 'authenticated'
);

-- Create RLS policies to allow invitation-based users (user_id starting with 'invitation_')
-- to upload, update, and delete files in all buckets
CREATE POLICY "bluum_invitation_users_uploads" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id IN ('templates', 'media', 'music', 'generated', 'clips') AND
  (storage.foldername(name))[1] LIKE 'invitation_%'
);

CREATE POLICY "bluum_invitation_users_updates" ON storage.objects
FOR UPDATE USING (
  bucket_id IN ('templates', 'media', 'music', 'generated', 'clips') AND
  (storage.foldername(name))[1] LIKE 'invitation_%'
);

CREATE POLICY "bluum_invitation_users_deletes" ON storage.objects
FOR DELETE USING (
  bucket_id IN ('templates', 'media', 'music', 'generated', 'clips') AND
  (storage.foldername(name))[1] LIKE 'invitation_%'
);

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
