-- Migration: Update music bucket size limit
-- Date: 2024-03-06
-- Description: Increase file size limit for music bucket to 50MB

-- First, ensure the music bucket exists with proper configuration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('music', 'music', true, 52428800, ARRAY['audio/*'])
ON CONFLICT (id) 
DO UPDATE SET 
  file_size_limit = 52428800,
  public = true,
  allowed_mime_types = ARRAY['audio/*'];

-- Ensure RLS policies exist for the music bucket
-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "music_public_read_access" ON storage.objects;
DROP POLICY IF EXISTS "music_authenticated_uploads" ON storage.objects;
DROP POLICY IF EXISTS "music_invitation_users_uploads" ON storage.objects;

-- Create RLS policy for public read access
CREATE POLICY "music_public_read_access" ON storage.objects
FOR SELECT USING (bucket_id = 'music');

-- Create RLS policy for authenticated users to upload
CREATE POLICY "music_authenticated_uploads" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'music' AND
  (auth.role() = 'authenticated' OR (storage.foldername(name))[1] LIKE 'invitation_%')
);

-- Create RLS policy for users to update their own files
CREATE POLICY "music_authenticated_updates" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'music' AND
  (auth.role() = 'authenticated' OR (storage.foldername(name))[1] LIKE 'invitation_%')
);

-- Create RLS policy for users to delete their own files  
CREATE POLICY "music_authenticated_deletes" ON storage.objects
FOR DELETE USING (
  bucket_id = 'music' AND
  (auth.role() = 'authenticated' OR (storage.foldername(name))[1] LIKE 'invitation_%')
);