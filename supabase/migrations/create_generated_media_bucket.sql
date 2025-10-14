-- Créer le bucket pour les médias générés
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generated-media',
  'generated-media',
  true, -- Public pour que les utilisateurs puissent accéder à leurs médias
  262144000, -- 250MB max par fichier
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Policies pour le bucket generated-media
CREATE POLICY "Users can upload their own generated media" ON storage.objects
  FOR INSERT 
  WITH CHECK (
    bucket_id = 'generated-media' 
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view all generated media" ON storage.objects
  FOR SELECT 
  USING (bucket_id = 'generated-media');

CREATE POLICY "Users can update their own generated media" ON storage.objects
  FOR UPDATE 
  USING (
    bucket_id = 'generated-media' 
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own generated media" ON storage.objects
  FOR DELETE 
  USING (
    bucket_id = 'generated-media' 
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );