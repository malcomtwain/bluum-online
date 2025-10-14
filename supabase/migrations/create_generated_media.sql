-- Tables pour stocker les médias générés par utilisateur

-- Table pour les vidéos générées
CREATE TABLE IF NOT EXISTS generated_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Chemin relatif dans le storage
  file_url TEXT NOT NULL, -- URL publique pour accéder au fichier
  file_size BIGINT,
  duration FLOAT, -- Durée en secondes pour les vidéos
  model_type TEXT, -- Type de modèle utilisé (fein-clipper, versus, etc.)
  metadata JSONB DEFAULT '{}', -- Métadonnées additionnelles
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour les slideshows générés
CREATE TABLE IF NOT EXISTS generated_slideshows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Chemin relatif dans le storage
  file_url TEXT NOT NULL, -- URL publique pour accéder au fichier
  file_size BIGINT,
  duration FLOAT, -- Durée en secondes
  image_count INTEGER, -- Nombre d'images dans le slideshow
  style_type INTEGER, -- Type de style utilisé (1, 2, 3, etc.)
  metadata JSONB DEFAULT '{}', -- Métadonnées additionnelles (hooks, positions, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Créer les index pour les performances
CREATE INDEX IF NOT EXISTS idx_generated_videos_user_id ON generated_videos (user_id);
CREATE INDEX IF NOT EXISTS idx_generated_videos_created_at ON generated_videos (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_slideshows_user_id ON generated_slideshows (user_id);
CREATE INDEX IF NOT EXISTS idx_generated_slideshows_created_at ON generated_slideshows (created_at DESC);

-- Activer RLS (Row Level Security)
ALTER TABLE generated_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_slideshows ENABLE ROW LEVEL SECURITY;

-- Policies pour generated_videos
CREATE POLICY "Users can view own generated videos" ON generated_videos
  FOR SELECT USING (true);

CREATE POLICY "Users can create own generated videos" ON generated_videos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own generated videos" ON generated_videos
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete own generated videos" ON generated_videos
  FOR DELETE USING (true);

-- Policies pour generated_slideshows  
CREATE POLICY "Users can view own generated slideshows" ON generated_slideshows
  FOR SELECT USING (true);

CREATE POLICY "Users can create own generated slideshows" ON generated_slideshows
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own generated slideshows" ON generated_slideshows
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete own generated slideshows" ON generated_slideshows
  FOR DELETE USING (true);

-- Fonction pour nettoyer les vieux médias (optionnel - garde 30 jours)
CREATE OR REPLACE FUNCTION cleanup_old_generated_media()
RETURNS void AS $$
BEGIN
  -- Supprimer les vidéos de plus de 30 jours
  DELETE FROM generated_videos 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Supprimer les slideshows de plus de 30 jours
  DELETE FROM generated_slideshows 
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;