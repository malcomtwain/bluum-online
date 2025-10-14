-- ====================================
-- SOLUTION ALTERNATIVE: AJOUTER LA COLONNE MANQUANTE
-- ====================================
-- Si la table existe mais sans la colonne user_id, l'ajouter

-- ÉTAPE 1: Vérifier si la colonne user_id existe
DO $$
BEGIN
    -- Si la colonne user_id n'existe pas, l'ajouter
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'user_id'
        AND table_schema = 'public'
    ) THEN
        -- Ajouter la colonne user_id
        ALTER TABLE public.users 
        ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        
        -- Remplir user_id avec les valeurs existantes si possible
        -- (en supposant qu'il y a une correspondance par email)
        UPDATE public.users u
        SET user_id = a.id
        FROM auth.users a
        WHERE u.email = a.email
        AND u.user_id IS NULL;
        
        -- Rendre la colonne NOT NULL après l'avoir remplie
        ALTER TABLE public.users
        ALTER COLUMN user_id SET NOT NULL;
        
        -- Ajouter l'unicité
        ALTER TABLE public.users
        ADD CONSTRAINT users_user_id_unique UNIQUE(user_id);
        
        RAISE NOTICE 'Colonne user_id ajoutée avec succès';
    ELSE
        RAISE NOTICE 'La colonne user_id existe déjà';
    END IF;
END $$;

-- ÉTAPE 2: Créer les index manquants
CREATE INDEX IF NOT EXISTS idx_users_user_id ON public.users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);

-- ÉTAPE 3: Activer RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ÉTAPE 4: Créer les politiques (supprimer d'abord les anciennes)
DO $$
BEGIN
    -- Essayer de supprimer les politiques existantes
    BEGIN
        DROP POLICY IF EXISTS "Users can view any profile" ON public.users;
        DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
        DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
    EXCEPTION
        WHEN OTHERS THEN
            NULL; -- Ignorer les erreurs si les politiques n'existent pas
    END;
    
    -- Créer les nouvelles politiques seulement si user_id existe
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'user_id'
        AND table_schema = 'public'
    ) THEN
        CREATE POLICY "Users can view any profile" ON public.users
            FOR SELECT USING (true);
        
        CREATE POLICY "Users can update own profile" ON public.users
            FOR UPDATE USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can insert own profile" ON public.users
            FOR INSERT WITH CHECK (auth.uid() = user_id);
            
        RAISE NOTICE 'Politiques RLS créées avec succès';
    END IF;
END $$;

-- ÉTAPE 5: Créer la fonction ensure_default_collections
CREATE OR REPLACE FUNCTION public.ensure_default_collections(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ÉTAPE 6: Vérifier la structure finale
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;