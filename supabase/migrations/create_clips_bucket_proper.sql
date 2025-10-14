-- Créer le bucket pour les clips vidéo
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clips',
  'clips',
  true, -- Public pour que les utilisateurs puissent accéder à leurs clips
  262144000, -- 250MB max par fichier
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

-- Policies pour le bucket clips
CREATE POLICY "Users can upload their own clips" ON storage.objects
  FOR INSERT 
  WITH CHECK (
    bucket_id = 'clips' 
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view all clips" ON storage.objects
  FOR SELECT 
  USING (bucket_id = 'clips');

CREATE POLICY "Users can update their own clips" ON storage.objects
  FOR UPDATE 
  USING (
    bucket_id = 'clips' 
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own clips" ON storage.objects
  FOR DELETE 
  USING (
    bucket_id = 'clips' 
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );