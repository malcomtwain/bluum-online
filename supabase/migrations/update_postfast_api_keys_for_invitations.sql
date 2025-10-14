-- First drop all existing policies before modifying the column type
DROP POLICY IF EXISTS "Users can view own API keys" ON postfast_api_keys;
DROP POLICY IF EXISTS "Users can create own API keys" ON postfast_api_keys;
DROP POLICY IF EXISTS "Users can update own API keys" ON postfast_api_keys;
DROP POLICY IF EXISTS "Users can delete own API keys" ON postfast_api_keys;

-- Drop the existing foreign key constraint
ALTER TABLE postfast_api_keys DROP CONSTRAINT IF EXISTS postfast_api_keys_user_id_fkey;

-- Change user_id to TEXT to support both UUIDs and invitation codes
ALTER TABLE postfast_api_keys 
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Create new policies - temporarily allow all access
-- You'll need to implement proper auth for invitation codes
CREATE POLICY "Users can view own API keys" ON postfast_api_keys
  FOR SELECT USING (true);

CREATE POLICY "Users can create own API keys" ON postfast_api_keys
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own API keys" ON postfast_api_keys
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete own API keys" ON postfast_api_keys
  FOR DELETE USING (true);

-- Update the trigger function to work with text user_id
CREATE OR REPLACE FUNCTION ensure_single_default_key()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE postfast_api_keys 
    SET is_default = false 
    WHERE user_id = NEW.user_id 
    AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;