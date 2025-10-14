-- Create table for storing PostFast API keys
CREATE TABLE IF NOT EXISTS postfast_api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS (Row Level Security) policies
ALTER TABLE postfast_api_keys ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view their own API keys
CREATE POLICY "Users can view own API keys" ON postfast_api_keys
  FOR SELECT USING (auth.uid() = user_id);

-- Policy to allow users to create their own API keys
CREATE POLICY "Users can create own API keys" ON postfast_api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to update their own API keys
CREATE POLICY "Users can update own API keys" ON postfast_api_keys
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy to allow users to delete their own API keys
CREATE POLICY "Users can delete own API keys" ON postfast_api_keys
  FOR DELETE USING (auth.uid() = user_id);

-- Function to ensure only one default key per user
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

-- Trigger to maintain single default key
CREATE TRIGGER maintain_single_default_key
AFTER INSERT OR UPDATE OF is_default ON postfast_api_keys
FOR EACH ROW
EXECUTE FUNCTION ensure_single_default_key();

-- Index for faster queries
CREATE INDEX idx_postfast_api_keys_user_id ON postfast_api_keys(user_id);
CREATE INDEX idx_postfast_api_keys_is_active ON postfast_api_keys(is_active);
CREATE INDEX idx_postfast_api_keys_is_default ON postfast_api_keys(is_default);