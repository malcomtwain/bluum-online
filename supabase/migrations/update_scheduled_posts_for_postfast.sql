-- Migration pour mettre à jour la table scheduled_posts pour PostFast

-- D'abord, supprimer les anciennes contraintes
ALTER TABLE public.scheduled_posts DROP CONSTRAINT IF EXISTS scheduled_posts_platform_check;
ALTER TABLE public.scheduled_posts DROP CONSTRAINT IF EXISTS scheduled_posts_status_check;

-- Ajouter les nouvelles colonnes nécessaires pour PostFast
ALTER TABLE public.scheduled_posts 
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS media_urls TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS media_keys TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS social_account_id TEXT,
  ADD COLUMN IF NOT EXISTS social_account_name TEXT,
  ADD COLUMN IF NOT EXISTS controls JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS postfast_post_id TEXT;

-- Modifier la colonne platform pour accepter les valeurs PostFast
ALTER TABLE public.scheduled_posts 
  ALTER COLUMN platform TYPE TEXT;

-- Supprimer la référence à account_id si elle existe (on utilise social_account_id maintenant)
ALTER TABLE public.scheduled_posts 
  DROP CONSTRAINT IF EXISTS scheduled_posts_account_id_fkey;

-- Renommer ou supprimer les anciennes colonnes TikTok-spécifiques
ALTER TABLE public.scheduled_posts 
  DROP COLUMN IF EXISTS account_id,
  DROP COLUMN IF EXISTS account_username,
  DROP COLUMN IF EXISTS title,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS hashtags,
  DROP COLUMN IF EXISTS video_url,
  DROP COLUMN IF EXISTS thumbnail_url,
  DROP COLUMN IF EXISTS tiktok_privacy_level;

-- Créer la table postfast_api_keys si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.postfast_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL,
  name TEXT,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour postfast_api_keys
CREATE INDEX IF NOT EXISTS idx_postfast_api_keys_user_id ON public.postfast_api_keys(user_id);

-- RLS pour postfast_api_keys
ALTER TABLE public.postfast_api_keys ENABLE ROW LEVEL SECURITY;

-- Policies pour postfast_api_keys
CREATE POLICY "Users can view their own API keys"
  ON public.postfast_api_keys
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own API keys"
  ON public.postfast_api_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys"
  ON public.postfast_api_keys
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys"
  ON public.postfast_api_keys
  FOR DELETE
  USING (auth.uid() = user_id);

-- Fonction pour s'assurer qu'un seul API key est par défaut par utilisateur
CREATE OR REPLACE FUNCTION ensure_single_default_api_key()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.postfast_api_keys
    SET is_default = false
    WHERE user_id = NEW.user_id
    AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_default_api_key_trigger
  AFTER INSERT OR UPDATE ON public.postfast_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_api_key();