-- INSTRUCTIONS: Copy and paste this entire script into your Supabase SQL Editor
-- Go to: https://supabase.com/dashboard/project/wjtguiusxvxaabutfxls/sql/new
-- Paste this script and click "Run"

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

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can manage their own Post-bridge API keys" ON post_bridge_api_keys;

-- Create policy for users to manage their own API keys
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

-- 8. Find your user ID and display it
SELECT 
    'Your user ID is: ' || id::text as user_info,
    email
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- 9. Insert your Post-bridge API key
-- IMPORTANT: Replace 'YOUR_USER_ID_HERE' with the actual UUID from step 8 above
-- Uncomment and modify the line below:

-- INSERT INTO post_bridge_api_keys (user_id, api_key, is_active) 
-- VALUES ('YOUR_USER_ID_HERE', 'pb_live_6wCwS8ojvWbVt92qtthRPW', true);

-- 10. After running step 9, verify the insertion:
-- SELECT * FROM post_bridge_api_keys;

-- 11. Optional: Deactivate old PostFast API keys
-- UPDATE postfast_api_keys SET is_active = false;

SELECT 'Migration script completed! Remember to insert your API key in step 9.' as final_message;