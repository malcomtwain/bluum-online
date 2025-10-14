-- Table pour stocker les posts programmés
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  
  -- PostFast data
  postfast_post_id TEXT, -- ID retourné par PostFast après création
  
  -- Content
  content TEXT NOT NULL,
  media_urls JSONB DEFAULT '[]', -- Array of media URLs
  media_keys JSONB DEFAULT '[]', -- Array of S3 keys from PostFast
  
  -- Scheduling
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, scheduled, published, failed
  
  -- Platform data
  platform TEXT NOT NULL, -- TIKTOK, INSTAGRAM, etc.
  social_account_id TEXT NOT NULL, -- ID from PostFast social accounts
  social_account_name TEXT, -- Display name for UI
  
  -- Platform-specific controls
  controls JSONB DEFAULT '{}', -- TikTok privacy, Instagram type, etc.
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  error_message TEXT
);

-- Create indexes separately
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_id ON scheduled_posts (user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_for ON scheduled_posts (scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts (status);

-- Activer RLS
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own scheduled posts" ON scheduled_posts
  FOR SELECT USING (true);

CREATE POLICY "Users can create own scheduled posts" ON scheduled_posts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own scheduled posts" ON scheduled_posts
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete own scheduled posts" ON scheduled_posts
  FOR DELETE USING (true);

-- Fonction pour nettoyer les vieux posts publiés (optionnel)
CREATE OR REPLACE FUNCTION cleanup_old_posts()
RETURNS void AS $$
BEGIN
  DELETE FROM scheduled_posts 
  WHERE status = 'published' 
  AND scheduled_for < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;