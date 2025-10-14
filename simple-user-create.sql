-- Script pour créer un utilisateur directement dans Supabase SQL Editor
-- ATTENTION: Exécuter ligne par ligne dans le SQL Editor de Supabase

-- 1. Vérifier l'état actuel de la table auth.users
SELECT COUNT(*) as total_users FROM auth.users;

-- 2. Vérifier s'il y a des triggers actifs
SELECT tgname, tgrelid::regclass as table_name 
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- 3. Désactiver temporairement le trigger problématique
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 4. Essayer de créer l'utilisateur manuellement 
-- (Le mot de passe sera en clair ici - à changer après)
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data,
    is_super_admin
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    '4rain.uknow@gmail.com',
    crypt('Splifdc3', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"full_name": "4Rain"}',
    false
);

-- 5. Vérifier que l'utilisateur a été créé
SELECT id, email, created_at FROM auth.users WHERE email = '4rain.uknow@gmail.com';

-- 6. Réactiver le trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();