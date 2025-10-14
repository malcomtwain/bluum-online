-- Créer un utilisateur directement dans auth.users
-- Email: 4rain.uknow@gmail.com
-- Password: Splifdc3

-- Note: En production, il est recommandé d'utiliser l'API Auth de Supabase
-- Ce script est pour test/debug uniquement

-- 1. D'abord, désactiver le trigger pour éviter les conflits
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Insérer l'utilisateur dans auth.users avec mot de passe hashé
-- Le mot de passe sera hashé par Supabase automatiquement via l'API
-- Pour créer via SQL, on utilise la fonction auth.users

-- Alternative 1: Utiliser la fonction Supabase (recommandé)
SELECT auth.users FROM auth.sign_up('4rain.uknow@gmail.com', 'Splifdc3', '{"full_name": "4Rain"}');

-- Alternative 2: Si la fonction ci-dessus ne marche pas, créer manuellement
-- (Attention: le mot de passe doit être hashé avec bcrypt)
-- INSERT INTO auth.users (
--   id,
--   email,
--   encrypted_password,
--   email_confirmed_at,
--   created_at,
--   updated_at,
--   raw_user_meta_data
-- ) VALUES (
--   gen_random_uuid(),
--   '4rain.uknow@gmail.com',
--   crypt('Splifdc3', gen_salt('bf')),
--   now(),
--   now(),
--   now(),
--   '{"full_name": "4Rain"}'::jsonb
-- );

-- 3. Réactiver le trigger après test
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();