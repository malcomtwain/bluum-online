-- EXÉCUTEZ CE FICHIER DANS LE SQL EDITOR DE SUPABASE
-- Allez dans votre dashboard Supabase > SQL Editor > New Query
-- Copiez-collez tout ce contenu et cliquez sur "Run"

-- ============================================
-- 1. CRÉER TOUS LES BUCKETS DE STOCKAGE
-- ============================================

-- Bucket generated-media pour les vidéos et slideshows générés
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

-- Bucket clips pour les vidéos uploadées par les utilisateurs  
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

-- Bucket media pour les images
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

-- Bucket music pour les fichiers audio
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

-- Bucket templates pour les templates
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

-- ============================================
-- 2. CRÉER DES POLICIES PERMISSIVES 
-- ============================================

-- Supprimer les policies existantes
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow all operations on generated-media" ON storage.objects;
  DROP POLICY IF EXISTS "Allow all operations on clips" ON storage.objects;
  DROP POLICY IF EXISTS "Allow all operations on media" ON storage.objects;
  DROP POLICY IF EXISTS "Allow all operations on music" ON storage.objects;
  DROP POLICY IF EXISTS "Allow all operations on templates" ON storage.objects;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Créer des policies très permissives (à sécuriser plus tard)
CREATE POLICY "Allow all operations on generated-media" ON storage.objects
  FOR ALL 
  USING (bucket_id = 'generated-media')
  WITH CHECK (bucket_id = 'generated-media');

CREATE POLICY "Allow all operations on clips" ON storage.objects
  FOR ALL
  USING (bucket_id = 'clips')
  WITH CHECK (bucket_id = 'clips');

CREATE POLICY "Allow all operations on media" ON storage.objects
  FOR ALL
  USING (bucket_id = 'media')
  WITH CHECK (bucket_id = 'media');

CREATE POLICY "Allow all operations on music" ON storage.objects
  FOR ALL
  USING (bucket_id = 'music')
  WITH CHECK (bucket_id = 'music');

CREATE POLICY "Allow all operations on templates" ON storage.objects
  FOR ALL
  USING (bucket_id = 'templates')
  WITH CHECK (bucket_id = 'templates');

-- ============================================
-- 3. CRÉER LES TABLES POUR LES MÉDIAS GÉNÉRÉS
-- ============================================

-- Table pour les vidéos générées
CREATE TABLE IF NOT EXISTS generated_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  duration FLOAT,
  model_type TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour les slideshows générés
CREATE TABLE IF NOT EXISTS generated_slideshows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  duration FLOAT,
  image_count INTEGER,
  style_type INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Créer les index
CREATE INDEX IF NOT EXISTS idx_generated_videos_user_id ON generated_videos (user_id);
CREATE INDEX IF NOT EXISTS idx_generated_videos_created_at ON generated_videos (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_slideshows_user_id ON generated_slideshows (user_id);
CREATE INDEX IF NOT EXISTS idx_generated_slideshows_created_at ON generated_slideshows (created_at DESC);

-- Activer RLS mais avec des policies très permissives
ALTER TABLE generated_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_slideshows ENABLE ROW LEVEL SECURITY;

-- Supprimer les policies existantes
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own generated videos" ON generated_videos;
  DROP POLICY IF EXISTS "Users can create own generated videos" ON generated_videos;
  DROP POLICY IF EXISTS "Users can update own generated videos" ON generated_videos;
  DROP POLICY IF EXISTS "Users can delete own generated videos" ON generated_videos;
  DROP POLICY IF EXISTS "Users can view own generated slideshows" ON generated_slideshows;
  DROP POLICY IF EXISTS "Users can create own generated slideshows" ON generated_slideshows;
  DROP POLICY IF EXISTS "Users can update own generated slideshows" ON generated_slideshows;
  DROP POLICY IF EXISTS "Users can delete own generated slideshows" ON generated_slideshows;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Créer des policies très permissives
CREATE POLICY "Allow all operations on generated_videos" ON generated_videos
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on generated_slideshows" ON generated_slideshows
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- FIN - Votre configuration est prête !
-- ============================================