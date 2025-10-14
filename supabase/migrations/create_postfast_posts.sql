-- Create PostFast posts tracking table
CREATE TABLE IF NOT EXISTS postfast_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    postfast_post_id TEXT NOT NULL, -- ID returned by PostFast API
    content TEXT NOT NULL,
    media_urls TEXT[] DEFAULT '{}',
    scheduled_at TIMESTAMPTZ,
    platform TEXT NOT NULL CHECK (platform IN ('TIKTOK', 'INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'X', 'LINKEDIN')),
    status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED')),
    social_account_id TEXT,
    social_account_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    error_message TEXT,
    controls JSONB
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_postfast_posts_user_id ON postfast_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_postfast_posts_status ON postfast_posts(status);
CREATE INDEX IF NOT EXISTS idx_postfast_posts_platform ON postfast_posts(platform);
CREATE INDEX IF NOT EXISTS idx_postfast_posts_scheduled_at ON postfast_posts(scheduled_at);

-- Enable RLS
ALTER TABLE postfast_posts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own posts" ON postfast_posts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own posts" ON postfast_posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" ON postfast_posts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts" ON postfast_posts
    FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_postfast_posts_updated_at
    BEFORE UPDATE ON postfast_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();