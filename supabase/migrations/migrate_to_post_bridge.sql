-- Migration to Post-bridge API
-- This script migrates from PostFast API to Post-bridge API

-- 1. Create new table for Post-bridge API keys
CREATE TABLE IF NOT EXISTS post_bridge_api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    api_key TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_post_bridge_api_keys_user_id ON post_bridge_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_post_bridge_api_keys_active ON post_bridge_api_keys(user_id, is_active);

-- 3. Add new column to scheduled_posts for Post-bridge post IDs
ALTER TABLE scheduled_posts 
ADD COLUMN IF NOT EXISTS post_bridge_post_id TEXT,
ADD COLUMN IF NOT EXISTS media_ids TEXT[] DEFAULT '{}';

-- 4. Update RLS policies for the new table
ALTER TABLE post_bridge_api_keys ENABLE ROW LEVEL SECURITY;

-- Policy for users to manage their own API keys
CREATE POLICY "Users can manage their own Post-bridge API keys" 
ON post_bridge_api_keys FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- 5. Create function to handle updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Create trigger for post_bridge_api_keys
CREATE TRIGGER update_post_bridge_api_keys_updated_at 
    BEFORE UPDATE ON post_bridge_api_keys 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Insert your Post-bridge API key
-- You'll need to run this separately with the actual user ID
-- INSERT INTO post_bridge_api_keys (user_id, api_key) 
-- VALUES ('YOUR_USER_ID', 'pb_live_6wCwS8ojvWbVt92qtthRPW');

-- 8. Create a view for backward compatibility
CREATE OR REPLACE VIEW postfast_compatibility AS
SELECT 
    id,
    user_id,
    content,
    media_urls,
    media_ids as media_keys, -- Map new field to old name for compatibility
    scheduled_for,
    status,
    platform,
    social_account_id,
    social_account_name,
    controls,
    created_at,
    updated_at,
    error_message,
    post_bridge_post_id as postfast_post_id -- Map new field to old name
FROM scheduled_posts;

-- 9. Grant necessary permissions
GRANT ALL ON post_bridge_api_keys TO authenticated;
GRANT SELECT ON postfast_compatibility TO authenticated;