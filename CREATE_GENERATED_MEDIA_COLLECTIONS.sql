-- Système de collections pour les vidéos et slideshows générés

-- 1. Créer la table pour les collections de médias générés
CREATE TABLE IF NOT EXISTS public.generated_media_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.generated_media_collections(id) ON DELETE CASCADE,
  collection_type TEXT DEFAULT 'mixed' CHECK (collection_type IN ('videos', 'slideshows', 'mixed')),
  color TEXT DEFAULT '#3B82F6',
  icon TEXT DEFAULT 'folder',
  sort_order INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name, parent_id)
);

-- 2. Ajouter la colonne collection_id aux tables existantes
ALTER TABLE public.generated_videos 
ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES public.generated_media_collections(id) ON DELETE SET NULL;

ALTER TABLE public.generated_slideshows
ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES public.generated_media_collections(id) ON DELETE SET NULL;

-- 3. Index pour les performances
CREATE INDEX IF NOT EXISTS idx_gen_media_collections_user ON public.generated_media_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_gen_media_collections_parent ON public.generated_media_collections(parent_id);
CREATE INDEX IF NOT EXISTS idx_gen_videos_collection ON public.generated_videos(collection_id);
CREATE INDEX IF NOT EXISTS idx_gen_slideshows_collection ON public.generated_slideshows(collection_id);

-- 4. RLS
ALTER TABLE public.generated_media_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_own_collections" ON public.generated_media_collections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "create_own_collections" ON public.generated_media_collections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_collections" ON public.generated_media_collections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "delete_own_collections" ON public.generated_media_collections
  FOR DELETE USING (auth.uid() = user_id);

-- 5. Fonction pour créer les collections par défaut
CREATE OR REPLACE FUNCTION create_user_default_media_collections()
RETURNS TRIGGER AS $$
BEGIN
  -- All Media (racine)
  INSERT INTO generated_media_collections (user_id, name, description, collection_type, color, icon, is_default, sort_order)
  VALUES 
    (NEW.id, 'All Media', 'All your generated content', 'mixed', '#6B7280', 'folder', true, 0),
    (NEW.id, '⭐ Favorites', 'Your favorite creations', 'mixed', '#F59E0B', 'star', false, 1),
    (NEW.id, '📝 Drafts', 'Work in progress', 'mixed', '#94A3B8', 'edit', false, 2),
    (NEW.id, '✅ Published', 'Posted to social media', 'mixed', '#10B981', 'check', false, 3)
  ON CONFLICT (user_id, name, parent_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger pour créer les collections automatiquement
DROP TRIGGER IF EXISTS create_default_media_collections_trigger ON auth.users;
CREATE TRIGGER create_default_media_collections_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_default_media_collections();

-- 7. Créer les collections pour les utilisateurs existants
INSERT INTO generated_media_collections (user_id, name, description, collection_type, color, icon, is_default, sort_order)
SELECT 
  id,
  'All Media',
  'All your generated content',
  'mixed',
  '#6B7280',
  'folder',
  true,
  0
FROM auth.users
ON CONFLICT (user_id, name, parent_id) DO NOTHING;

INSERT INTO generated_media_collections (user_id, name, description, collection_type, color, icon, is_default, sort_order)
SELECT 
  id,
  '⭐ Favorites',
  'Your favorite creations',
  'mixed',
  '#F59E0B',
  'star',
  false,
  1
FROM auth.users
ON CONFLICT (user_id, name, parent_id) DO NOTHING;

INSERT INTO generated_media_collections (user_id, name, description, collection_type, color, icon, is_default, sort_order)
SELECT 
  id,
  '📝 Drafts',
  'Work in progress',
  'mixed',
  '#94A3B8',
  'edit',
  false,
  2
FROM auth.users
ON CONFLICT (user_id, name, parent_id) DO NOTHING;

INSERT INTO generated_media_collections (user_id, name, description, collection_type, color, icon, is_default, sort_order)
SELECT 
  id,
  '✅ Published',
  'Posted to social media',
  'mixed',
  '#10B981',
  'check',
  false,
  3
FROM auth.users
ON CONFLICT (user_id, name, parent_id) DO NOTHING;

-- 8. Fonction helper pour obtenir les stats d'une collection
CREATE OR REPLACE FUNCTION get_collection_stats(collection_uuid UUID)
RETURNS JSON AS $$
DECLARE
  video_count INT;
  slideshow_count INT;
  subcollection_count INT;
BEGIN
  SELECT COUNT(*) INTO video_count
  FROM generated_videos
  WHERE collection_id = collection_uuid;
  
  SELECT COUNT(*) INTO slideshow_count
  FROM generated_slideshows
  WHERE collection_id = collection_uuid;
  
  SELECT COUNT(*) INTO subcollection_count
  FROM generated_media_collections
  WHERE parent_id = collection_uuid;
  
  RETURN json_build_object(
    'videos', video_count,
    'slideshows', slideshow_count,
    'subcollections', subcollection_count,
    'total_items', video_count + slideshow_count
  );
END;
$$ LANGUAGE plpgsql;

-- 9. Vue pour faciliter la navigation
CREATE OR REPLACE VIEW user_collections_tree AS
WITH RECURSIVE collection_tree AS (
  -- Collections racines
  SELECT 
    c.*,
    0 as level,
    ARRAY[c.name] as path,
    get_collection_stats(c.id) as stats
  FROM generated_media_collections c
  WHERE c.parent_id IS NULL
  
  UNION ALL
  
  -- Sous-collections
  SELECT 
    c.*,
    ct.level + 1,
    ct.path || c.name,
    get_collection_stats(c.id) as stats
  FROM generated_media_collections c
  INNER JOIN collection_tree ct ON c.parent_id = ct.id
  WHERE ct.level < 5 -- Limite de profondeur
)
SELECT * FROM collection_tree
ORDER BY level, sort_order, name;