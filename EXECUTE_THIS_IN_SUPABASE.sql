-- ====================================
-- EXÉCUTER CE SCRIPT DANS SUPABASE SQL EDITOR
-- Dashboard Supabase > SQL Editor > New Query
-- ====================================

-- 1. Créer la table users pour la compatibilité
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    username TEXT,
    invitation_code TEXT,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id),
    UNIQUE(email),
    UNIQUE(username)
);

-- 2. Créer l'index
CREATE INDEX IF NOT EXISTS idx_users_user_id ON public.users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);

-- 3. Activer RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 4. Créer les politiques RLS (supprimer les anciennes d'abord)
DO $$ 
BEGIN
    -- Supprimer les politiques existantes si elles existent
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can view any profile') THEN
        DROP POLICY "Users can view any profile" ON public.users;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can view own profile') THEN
        DROP POLICY "Users can view own profile" ON public.users;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can update own profile') THEN
        DROP POLICY "Users can update own profile" ON public.users;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can insert own profile') THEN
        DROP POLICY "Users can insert own profile" ON public.users;
    END IF;
END $$;

-- Créer les nouvelles politiques seulement si la table existe et a la colonne user_id
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'user_id') THEN
        -- Permettre à tous les utilisateurs authentifiés de lire les profils (pour la connexion)
        CREATE POLICY "Users can view any profile" ON public.users
            FOR SELECT USING (true);

        -- Permettre aux utilisateurs de modifier leur propre profil
        CREATE POLICY "Users can update own profile" ON public.users
            FOR UPDATE USING (auth.uid() = user_id);

        -- Permettre aux utilisateurs de créer leur propre profil
        CREATE POLICY "Users can insert own profile" ON public.users
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 5. Créer la fonction ensure_default_collections (placeholder)
CREATE OR REPLACE FUNCTION public.ensure_default_collections(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Placeholder function - peut être implémentée plus tard
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Créer la fonction pour gérer les nouveaux utilisateurs
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Créer un profil utilisateur lors de l'inscription
    INSERT INTO public.users (user_id, email, username)
    VALUES (
        new.id, 
        new.email,
        -- Générer un username basé sur l'email si non fourni
        COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
    )
    ON CONFLICT (user_id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        updated_at = now();
    
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Créer le trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Migrer les utilisateurs existants
INSERT INTO public.users (user_id, email, username)
SELECT 
    id, 
    email,
    COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1))
FROM auth.users
ON CONFLICT (user_id) DO UPDATE
SET 
    email = EXCLUDED.email,
    username = COALESCE(public.users.username, EXCLUDED.username),
    updated_at = now();

-- 9. Vérifier le résultat
SELECT 
    COUNT(*) as total_users,
    COUNT(DISTINCT user_id) as unique_users
FROM public.users;

-- 10. Afficher les utilisateurs créés
SELECT 
    id,
    user_id,
    email,
    username,
    created_at
FROM public.users
ORDER BY created_at DESC
LIMIT 10;