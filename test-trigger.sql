-- Tester le trigger handle_new_user manuellement

-- 1. Vérifier si le trigger existe
SELECT tgname, tgrelid::regclass, tgenabled 
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- 2. Vérifier si la fonction existe et fonctionne
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user' 
AND routine_schema = 'public';

-- 3. Tester la fonction directement (simulation)
-- Créer un utilisateur temporaire pour test
DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
    test_email TEXT := 'test@example.com';
BEGIN
    -- Simuler ce que fait le trigger
    RAISE NOTICE 'Testing with user_id: % and email: %', test_user_id, test_email;
    
    BEGIN
        INSERT INTO public.users (user_id, email)
        VALUES (test_user_id, test_email);
        
        RAISE NOTICE 'Successfully inserted into public.users';
        
        -- Nettoyer le test
        DELETE FROM public.users WHERE user_id = test_user_id;
        RAISE NOTICE 'Test user deleted';
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error inserting into public.users: %', SQLERRM;
    END;
END $$;

-- 4. Vérifier les permissions sur la table public.users
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND table_name = 'users';