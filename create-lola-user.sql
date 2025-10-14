-- Créer l'utilisateur lolaareixala@gmail.com avec mot de passe Cristiano25

-- 1. Désactiver temporairement le trigger pour éviter les erreurs
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Créer l'utilisateur dans auth.users
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
  'lolaareixala@gmail.com',
  crypt('Cristiano25', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"full_name": "Lola"}',
  false
);

-- 3. Vérifier que l'utilisateur a été créé
SELECT id, email, created_at, email_confirmed_at 
FROM auth.users 
WHERE email = 'lolaareixala@gmail.com';

-- 4. Créer l'entrée correspondante dans public.users manuellement
INSERT INTO public.users (user_id, email)
SELECT id, email 
FROM auth.users 
WHERE email = 'lolaareixala@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- 5. Vérifier que l'entrée public.users a été créée
SELECT * FROM public.users WHERE email = 'lolaareixala@gmail.com';

-- 6. Réactiver le trigger pour les futurs utilisateurs
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();ééa