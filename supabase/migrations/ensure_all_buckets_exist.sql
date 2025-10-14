-- S'assurer que tous les buckets nécessaires existent

-- 1. Bucket generated-media pour les vidéos et slideshows générés
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generated-media',
  'generated-media',
  true,
  262144000, -- 250MB
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Bucket clips pour les vidéos uploadées par les utilisateurs  
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clips',
  'clips',
  true,
  262144000, -- 250MB
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Bucket media pour les images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 4. Bucket music pour les fichiers audio
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'music',
  'music',
  true,
  52428800, -- 50MB
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 5. Bucket templates pour les templates
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'templates',
  'templates',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'video/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Supprimer toutes les policies existantes pour éviter les conflits
DO $$
BEGIN
  -- Supprimer les policies existantes pour generated-media
  DROP POLICY IF EXISTS "Users can upload their own generated media" ON storage.objects;
  DROP POLICY IF EXISTS "Users can view all generated media" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update their own generated media" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own generated media" ON storage.objects;
  
  -- Supprimer les policies existantes pour clips
  DROP POLICY IF EXISTS "Users can upload their own clips" ON storage.objects;
  DROP POLICY IF EXISTS "Users can view all clips" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update their own clips" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own clips" ON storage.objects;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignorer les erreurs si les policies n'existent pas
    NULL;
END $$;

-- Créer des policies plus permissives pour le développement
-- Note: À sécuriser davantage en production

-- Policies pour generated-media
CREATE POLICY "Allow all operations on generated-media" ON storage.objects
  FOR ALL 
  USING (bucket_id = 'generated-media')
  WITH CHECK (bucket_id = 'generated-media');

-- Policies pour clips  
CREATE POLICY "Allow all operations on clips" ON storage.objects
  FOR ALL
  USING (bucket_id = 'clips')
  WITH CHECK (bucket_id = 'clips');

-- Policies pour media
CREATE POLICY "Allow all operations on media" ON storage.objects
  FOR ALL
  USING (bucket_id = 'media')
  WITH CHECK (bucket_id = 'media');

-- Policies pour music
CREATE POLICY "Allow all operations on music" ON storage.objects
  FOR ALL
  USING (bucket_id = 'music')
  WITH CHECK (bucket_id = 'music');

-- Policies pour templates
CREATE POLICY "Allow all operations on templates" ON storage.objects
  FOR ALL
  USING (bucket_id = 'templates')
  WITH CHECK (bucket_id = 'templates');