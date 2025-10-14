-- Migration simple: Create Supabase Storage buckets only
-- Date: 2024-03-05
-- Description: Create required storage buckets for Bluum video generator
-- This version only creates buckets without modifying existing RLS policies

-- Create storage buckets for different content types
-- The ON CONFLICT DO NOTHING ensures no errors if buckets already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('templates', 'templates', true, 10485760, ARRAY['image/*', 'video/*']),
  ('media', 'media', true, 10485760, ARRAY['image/*', 'video/*']),
  ('music', 'music', true, 10485760, ARRAY['audio/*']),
  ('generated', 'generated', true, 10485760, ARRAY['video/*']),
  ('clips', 'clips', true, 10485760, ARRAY['video/*'])
ON CONFLICT (id) DO NOTHING;

-- Note: If you still get RLS errors after creating buckets,
-- you may need to manually configure RLS policies in the Supabase dashboard
-- or run the full migration with policy management
