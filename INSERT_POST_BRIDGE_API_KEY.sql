-- Insert Post-bridge API key for user
-- First, we need to run the migration to create the table structure

-- 1. Run the migration first (if not already done)
-- You should execute the migration file: supabase/migrations/migrate_to_post_bridge.sql

-- 2. Find your user ID (replace with your actual email)
-- Run this query to find your user ID:
-- SELECT id FROM auth.users WHERE email = 'your_email@example.com';

-- 3. Insert your Post-bridge API key (replace YOUR_USER_ID with the actual UUID from step 2)
INSERT INTO post_bridge_api_keys (user_id, api_key, is_active) 
VALUES (
  'YOUR_USER_ID_HERE', -- Replace with your actual user ID from auth.users
  'pb_live_6wCwS8ojvWbVt92qtthRPW',
  true
)
ON CONFLICT (user_id, api_key) DO UPDATE SET
  is_active = true,
  updated_at = NOW();

-- 4. Optionally, deactivate old PostFast API keys
-- UPDATE postfast_api_keys SET is_active = false WHERE user_id = 'YOUR_USER_ID_HERE';

-- 5. Verify the insertion
-- SELECT * FROM post_bridge_api_keys WHERE user_id = 'YOUR_USER_ID_HERE';