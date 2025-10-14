-- Table pour stocker les drafts et contenus programmés
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Compte associé
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram')),
  account_id UUID REFERENCES public.tiktok_accounts(id) ON DELETE CASCADE,
  account_username TEXT NOT NULL,
  
  -- Contenu
  title TEXT,
  description TEXT,
  hashtags TEXT[] DEFAULT '{}',
  video_url TEXT, -- URL de la vidéo générée
  thumbnail_url TEXT,
  
  -- Planification
  scheduled_for TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed', 'cancelled')),
  
  -- Métadonnées
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  -- Options TikTok spécifiques
  tiktok_privacy_level TEXT DEFAULT 'public' CHECK (tiktok_privacy_level IN ('public', 'friends', 'private')),
  allow_comments BOOLEAN DEFAULT true,
  allow_duet BOOLEAN DEFAULT true,
  allow_stitch BOOLEAN DEFAULT true,
  
  -- Données additionnelles
  metadata JSONB DEFAULT '{}'
);

-- Index pour améliorer les performances
CREATE INDEX idx_scheduled_posts_user_id ON public.scheduled_posts(user_id);
CREATE INDEX idx_scheduled_posts_status ON public.scheduled_posts(status);
CREATE INDEX idx_scheduled_posts_scheduled_for ON public.scheduled_posts(scheduled_for);
CREATE INDEX idx_scheduled_posts_platform ON public.scheduled_posts(platform);

-- RLS
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own scheduled posts"
  ON public.scheduled_posts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scheduled posts"
  ON public.scheduled_posts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled posts"
  ON public.scheduled_posts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled posts"
  ON public.scheduled_posts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Fonction pour mettre à jour updated_at
CREATE TRIGGER update_scheduled_posts_updated_at
  BEFORE UPDATE ON public.scheduled_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();