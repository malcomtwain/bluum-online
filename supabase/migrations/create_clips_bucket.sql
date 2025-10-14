-- Create the clips bucket for video storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('clips', 'clips', true, 104857600, ARRAY['video/*', 'image/*'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY['video/*', 'image/*'];

-- Create a policy to allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload their own clips" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'clips' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Create a policy to allow users to view their own clips
CREATE POLICY "Users can view their own clips" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'clips' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Create a policy to allow users to delete their own clips
CREATE POLICY "Users can delete their own clips" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'clips' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public access to clips (since bucket is public)
CREATE POLICY "Public can view clips" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'clips');