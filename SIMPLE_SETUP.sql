-- INSTRUCTIONS SIMPLES: 
-- 1. Copie et colle ce script dans Supabase SQL Editor
-- 2. Remplace 'your_email@example.com' par ton vrai email
-- 3. Clique "Run"

-- Create the table first
CREATE TABLE IF NOT EXISTS post_bridge_api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    api_key TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policy
ALTER TABLE post_bridge_api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own Post-bridge API keys" ON post_bridge_api_keys;
CREATE POLICY "Users can manage their own Post-bridge API keys" 
ON post_bridge_api_keys FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON post_bridge_api_keys TO authenticated;

-- Add columns to scheduled_posts
ALTER TABLE scheduled_posts 
ADD COLUMN IF NOT EXISTS post_bridge_post_id TEXT,
ADD COLUMN IF NOT EXISTS media_ids TEXT[] DEFAULT '{}';

-- Insert your API key (CHANGE THE EMAIL BELOW!)
INSERT INTO post_bridge_api_keys (user_id, api_key, is_active)
SELECT 
    id as user_id,
    'pb_live_6wCwS8ojvWbVt92qtthRPW' as api_key,
    true as is_active
FROM auth.users 
WHERE email = 'your_email@example.com'  -- CHANGE THIS TO YOUR EMAIL!
LIMIT 1;

-- Check if it worked
SELECT 
    'API key inserted for user:' as message,
    u.email,
    u.id as user_id,
    k.api_key,
    k.is_active,
    k.created_at
FROM post_bridge_api_keys k
JOIN auth.users u ON k.user_id = u.id
WHERE u.email = 'your_email@example.com'; -- CHANGE THIS TO YOUR EMAIL!