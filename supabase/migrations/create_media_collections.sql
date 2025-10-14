-- Table pour les collections d'images
CREATE TABLE IF NOT EXISTS image_collections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  thumbnail TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Index pour les performances
  UNIQUE(user_id, id)
);

-- Table pour les images dans les collections
CREATE TABLE IF NOT EXISTS image_collection_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES image_collections(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  url TEXT NOT NULL,
  size BIGINT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour les collections de vidéos
CREATE TABLE IF NOT EXISTS video_collections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  thumbnail TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Index pour les performances
  UNIQUE(user_id, id)
);

-- Table pour les vidéos dans les collections
CREATE TABLE IF NOT EXISTS video_collection_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES video_collections(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  url TEXT NOT NULL,
  size BIGINT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activer RLS
ALTER TABLE image_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_collection_items ENABLE ROW LEVEL SECURITY;

-- Policies pour les collections d'images
CREATE POLICY "Users can view own image collections" ON image_collections
  FOR SELECT USING (true);

CREATE POLICY "Users can create own image collections" ON image_collections
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own image collections" ON image_collections
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete own image collections" ON image_collections
  FOR DELETE USING (true);

-- Policies pour les items d'images
CREATE POLICY "Users can view image items" ON image_collection_items
  FOR SELECT USING (true);

CREATE POLICY "Users can create image items" ON image_collection_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update image items" ON image_collection_items
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete image items" ON image_collection_items
  FOR DELETE USING (true);

-- Policies pour les collections de vidéos
CREATE POLICY "Users can view own video collections" ON video_collections
  FOR SELECT USING (true);

CREATE POLICY "Users can create own video collections" ON video_collections
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own video collections" ON video_collections
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete own video collections" ON video_collections
  FOR DELETE USING (true);

-- Policies pour les items de vidéos
CREATE POLICY "Users can view video items" ON video_collection_items
  FOR SELECT USING (true);

CREATE POLICY "Users can create video items" ON video_collection_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update video items" ON video_collection_items
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete video items" ON video_collection_items
  FOR DELETE USING (true);

-- Créer les index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_image_collections_user_id ON image_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_video_collections_user_id ON video_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_image_collection_items_collection_id ON image_collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_video_collection_items_collection_id ON video_collection_items(collection_id);

-- Fonction pour créer automatiquement la collection par défaut
CREATE OR REPLACE FUNCTION ensure_default_collections(p_user_id TEXT)
RETURNS void AS $$
BEGIN
  -- Créer la collection "All Images" si elle n'existe pas
  INSERT INTO image_collections (id, user_id, name)
  VALUES ('00000000-0000-0000-0000-000000000001', p_user_id, 'All Images')
  ON CONFLICT (user_id, id) DO NOTHING;
  
  -- Créer la collection "All Videos" si elle n'existe pas
  INSERT INTO video_collections (id, user_id, name)
  VALUES ('00000000-0000-0000-0000-000000000001', p_user_id, 'All Videos')
  ON CONFLICT (user_id, id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;