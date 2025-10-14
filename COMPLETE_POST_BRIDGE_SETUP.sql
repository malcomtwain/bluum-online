-- Complete Post-bridge Setup
-- Run this entire script in your Supabase SQL Editor

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

-- 3. Add new columns to scheduled_posts for Post-bridge post IDs
ALTER TABLE scheduled_posts 
ADD COLUMN IF NOT EXISTS post_bridge_post_id TEXT,
ADD COLUMN IF NOT EXISTS media_ids TEXT[] DEFAULT '{}';

-- 4. Update RLS policies for the new table
ALTER TABLE post_bridge_api_keys ENABLE ROW LEVEL SECURITY;

-- Policy for users to manage their own API keys
DROP POLICY IF EXISTS "Users can manage their own Post-bridge API keys" ON post_bridge_api_keys;
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
DROP TRIGGER IF EXISTS update_post_bridge_api_keys_updated_at ON post_bridge_api_keys;
CREATE TRIGGER update_post_bridge_api_keys_updated_at 
    BEFORE UPDATE ON post_bridge_api_keys 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Grant necessary permissions
GRANT ALL ON post_bridge_api_keys TO authenticated;

-- 8. Insert your Post-bridge API key
-- First, find your user ID and replace in the INSERT below
DO $$
DECLARE
    user_id_var UUID;
BEGIN
    -- Try to find user by checking if we can get current user
    -- You may need to replace this with your actual user ID
    SELECT auth.uid() INTO user_id_var;
    
    -- If auth.uid() doesn't work, uncomment and modify the line below with your email
    -- SELECT id INTO user_id_var FROM auth.users WHERE email = 'your_email@example.com' LIMIT 1;
    
    IF user_id_var IS NOT NULL THEN
        INSERT INTO post_bridge_api_keys (user_id, api_key, is_active) 
        VALUES (user_id_var, 'pb_live_6wCwS8ojvWbVt92qtthRPW', true)
        ON CONFLICT (user_id, api_key) DO UPDATE SET
            is_active = true,
            updated_at = NOW();
            
        RAISE NOTICE 'Post-bridge API key inserted for user: %', user_id_var;
    ELSE
        RAISE NOTICE 'Could not determine user ID. Please run this manually:';
        RAISE NOTICE 'INSERT INTO post_bridge_api_keys (user_id, api_key) VALUES (''YOUR_USER_ID'', ''pb_live_6wCwS8ojvWbVt92qtthRPW'');';
    END IF;
END $$;

-- 9. Optional: Check what was created
SELECT 'Post-bridge API keys created:' as info;
SELECT user_id, api_key, is_active, created_at FROM post_bridge_api_keys;

-- 10. Optional: Deactivate old PostFast API keys (uncomment if desired)
-- UPDATE postfast_api_keys SET is_active = false WHERE user_id = auth.uid();

SELECT 'Setup completed successfully!' as result;