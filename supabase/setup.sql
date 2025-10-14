-- Extension pour générer des UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table pour les codes d'invitation
CREATE TABLE IF NOT EXISTS invitation_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  uses_allowed INTEGER NOT NULL DEFAULT 1,
  uses_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE
);

-- Index pour recherche rapide par code
CREATE INDEX IF NOT EXISTS idx_invitation_codes_code ON invitation_codes (code);

-- Table pour les utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  invitation_code TEXT REFERENCES invitation_codes(code),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fonction pour incrémenter facilement un compteur
CREATE OR REPLACE FUNCTION increment(row_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  current_count INTEGER;
BEGIN
  SELECT uses_count INTO current_count FROM invitation_codes WHERE code = row_id;
  RETURN current_count + 1;
END;
$$ LANGUAGE plpgsql;

-- Créer un premier code d'invitation pour démarrer (BLUUM-ADMIN)
INSERT INTO invitation_codes (code, uses_allowed, expires_at, is_active)
VALUES ('BLUUM-ADMIN', 1, NOW() + INTERVAL '1 year', TRUE)
ON CONFLICT (code) DO NOTHING;

-- Configuration des politiques de sécurité Row Level Security (RLS)
ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Politiques pour invitation_codes
CREATE POLICY "Tout le monde peut lire les codes d'invitation actifs" 
  ON invitation_codes FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Mise à jour des utilisations des codes" 
  ON invitation_codes FOR UPDATE USING (TRUE);

-- Politiques pour users
CREATE POLICY "Les utilisateurs peuvent lire leur propre profil" 
  ON users FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Les utilisateurs peuvent mettre à jour leur propre profil" 
  ON users FOR UPDATE USING (auth.uid() = id);

-- Autorisations pour l'API publique (avec anon)
GRANT SELECT ON invitation_codes TO anon;
GRANT SELECT, INSERT, UPDATE ON users TO anon;
GRANT EXECUTE ON FUNCTION increment TO anon; 