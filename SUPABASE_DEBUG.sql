
-- Script de diagnostic Supabase
-- À exécuter dans Supabase Dashboard > SQL Editor

-- 1. Vérifier les tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('users', 'profiles');

-- 2. Vérifier les triggers
SELECT trigger_name, event_manipulation, action_statement 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';

-- 3. Vérifier les policies RLS
SELECT tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('users', 'profiles');

-- 4. Test simple d'insertion
INSERT INTO auth.users (email, encrypted_password) 
VALUES ('test@test.com', 'test') 
ON CONFLICT DO NOTHING;

