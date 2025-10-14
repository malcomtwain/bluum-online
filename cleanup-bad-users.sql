-- Supprimer les utilisateurs créés manuellement avec des mots de passe incorrects

-- 1. Supprimer de public.users d'abord (à cause des foreign keys)
DELETE FROM public.users 
WHERE email IN ('4rain.uknow@gmail.com', 'lolaareixala@gmail.com');

-- 2. Supprimer de auth.users
DELETE FROM auth.users 
WHERE email IN ('4rain.uknow@gmail.com', 'lolaareixala@gmail.com');

-- 3. Vérifier qu'ils sont supprimés
SELECT email FROM auth.users WHERE email IN ('4rain.uknow@gmail.com', 'lolaareixala@gmail.com');

-- 4. S'assurer que le trigger est actif
SELECT tgname, tgrelid::regclass, tgenabled 
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';