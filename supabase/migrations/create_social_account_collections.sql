-- Create table to store social account to collection associations
CREATE TABLE IF NOT EXISTS public.social_account_collections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id VARCHAR(255) NOT NULL,
  collection_id UUID NOT NULL REFERENCES public.generated_media_collections(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(user_id, account_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_social_account_collections_user_id ON public.social_account_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_social_account_collections_account_id ON public.social_account_collections(account_id);
CREATE INDEX IF NOT EXISTS idx_social_account_collections_collection_id ON public.social_account_collections(collection_id);

-- Enable RLS
ALTER TABLE public.social_account_collections ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own account collections"
  ON public.social_account_collections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own account collections"
  ON public.social_account_collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own account collections"
  ON public.social_account_collections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own account collections"
  ON public.social_account_collections FOR DELETE
  USING (auth.uid() = user_id);