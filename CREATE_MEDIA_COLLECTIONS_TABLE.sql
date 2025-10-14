-- Créer la table media_collections qui manque
CREATE TABLE IF NOT EXISTS public.media_collections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('image', 'video', 'mixed')) DEFAULT 'mixed',
  description TEXT,
  thumbnail_url TEXT,
  item_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Créer les index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_media_collections_user_id ON public.media_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_media_collections_type ON public.media_collections(type);

-- Activer RLS
ALTER TABLE public.media_collections ENABLE ROW LEVEL SECURITY;

-- Créer les policies RLS
CREATE POLICY "Users can view their own media collections"
  ON public.media_collections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own media collections"
  ON public.media_collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own media collections"
  ON public.media_collections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own media collections"
  ON public.media_collections FOR DELETE
  USING (auth.uid() = user_id);

-- Table pour les items dans les collections
CREATE TABLE IF NOT EXISTS public.media_collection_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES public.media_collections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_type TEXT CHECK (media_type IN ('image', 'video')) NOT NULL,
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_name TEXT,
  file_size BIGINT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Index pour les items
CREATE INDEX IF NOT EXISTS idx_media_collection_items_collection_id ON public.media_collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_media_collection_items_user_id ON public.media_collection_items(user_id);

-- Activer RLS pour les items
ALTER TABLE public.media_collection_items ENABLE ROW LEVEL SECURITY;

-- Policies pour les items
CREATE POLICY "Users can view their own media items"
  ON public.media_collection_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add items to their collections"
  ON public.media_collection_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own media items"
  ON public.media_collection_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own media items"
  ON public.media_collection_items FOR DELETE
  USING (auth.uid() = user_id);