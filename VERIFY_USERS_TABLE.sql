-- VÉRIFIER LA STRUCTURE DE LA TABLE USERS
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- VÉRIFIER LES CONTRAINTES
SELECT 
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'users' AND table_schema = 'public';

-- VÉRIFIER LES POLITIQUES RLS
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'users';

-- VÉRIFIER LES DONNÉES
SELECT 
    id,
    user_id,
    email,
    username,
    created_at
FROM public.users
LIMIT 5;

-- VÉRIFIER LA FONCTION ensure_default_collections
SELECT 
    routine_name
FROM information_schema.routines
WHERE routine_name = 'ensure_default_collections'
AND routine_schema = 'public';