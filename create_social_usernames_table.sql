-- Table pour stocker les vrais usernames des comptes sociaux
CREATE TABLE IF NOT EXISTS social_account_usernames (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL, -- L'invitation code ou UUID
  account_id TEXT NOT NULL, -- L'ID du compte PostFast
  platform TEXT NOT NULL, -- TIKTOK, INSTAGRAM, etc.
  custom_username TEXT NOT NULL, -- Le vrai username (@username)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Une seule entrée par compte et utilisateur
  UNIQUE(user_id, account_id)
);

-- Activer RLS
ALTER TABLE social_account_usernames ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own usernames" ON social_account_usernames
  FOR SELECT USING (true);

CREATE POLICY "Users can create own usernames" ON social_account_usernames
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own usernames" ON social_account_usernames
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete own usernames" ON social_account_usernames
  FOR DELETE USING (true);

-- Index pour les performances
CREATE INDEX idx_social_usernames_user_id ON social_account_usernames(user_id);
CREATE INDEX idx_social_usernames_account_id ON social_account_usernames(account_id);

-- Vérification
SELECT 'Table social_account_usernames created successfully!' as message;