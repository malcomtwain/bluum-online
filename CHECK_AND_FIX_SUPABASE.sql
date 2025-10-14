-- ====================================
-- SCRIPT DE DIAGNOSTIC ET RÉPARATION
-- Exécute ceci dans Supabase SQL Editor
-- ====================================

-- 1. VÉRIFIER SI LA TABLE USERS EXISTE DÉJÀ
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- 2. SI LA TABLE N'EXISTE PAS, LA CRÉER
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        CREATE TABLE public.users (
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
        
        RAISE NOTICE 'Table users créée avec succès';
    ELSE
        RAISE NOTICE 'Table users existe déjà';
    END IF;
END $$;

-- 3. CRÉER LES INDEX SI ILS N'EXISTENT PAS
CREATE INDEX IF NOT EXISTS idx_users_user_id ON public.users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);

-- 4. ACTIVER RLS SI PAS DÉJÀ ACTIVÉ
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 5. CRÉER LA FONCTION ensure_default_collections
CREATE OR REPLACE FUNCTION public.ensure_default_collections(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Fonction placeholder
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. CRÉER LA FONCTION handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (user_id, email, username)
    VALUES (
        new.id, 
        new.email,
        COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
    )
    ON CONFLICT (user_id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        updated_at = now();
    
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. CRÉER LE TRIGGER
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. MIGRER LES UTILISATEURS EXISTANTS
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

-- 9. CRÉER LES POLITIQUES RLS
DO $$
BEGIN
    -- Supprimer les anciennes politiques si elles existent
    DROP POLICY IF EXISTS "Users can view any profile" ON public.users;
    DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
    DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
    
    -- Créer les nouvelles politiques
    CREATE POLICY "Users can view any profile" ON public.users
        FOR SELECT USING (true);
    
    CREATE POLICY "Users can update own profile" ON public.users
        FOR UPDATE USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can insert own profile" ON public.users
        FOR INSERT WITH CHECK (auth.uid() = user_id);
        
    RAISE NOTICE 'Politiques RLS créées avec succès';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erreur lors de la création des politiques: %', SQLERRM;
END $$;

-- 10. VÉRIFIER LE RÉSULTAT FINAL
SELECT 
    'Nombre total utilisateurs' as description,
    COUNT(*) as count
FROM public.users
UNION ALL
SELECT 
    'Nombre utilisateurs auth.users',
    COUNT(*)
FROM auth.users;

-- 11. AFFICHER LES DERNIERS UTILISATEURS CRÉÉS
SELECT 
    id,
    user_id,
    email,
    username,
    created_at
FROM public.users
ORDER BY created_at DESC
LIMIT 5;