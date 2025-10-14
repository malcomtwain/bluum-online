-- Tester la requête qui cause l'erreur 400
-- L'erreur vient de: /rest/v1/users?id=eq.47c7551c-a410-4c5f-958f-dfda5f54f0d9

-- 1. Vérifier si l'utilisateur existe avec user_id
SELECT * FROM public.users 
WHERE user_id = '47c7551c-a410-4c5f-958f-dfda5f54f0d9';

-- 2. Si pas de résultat, vérifier dans auth.users
SELECT id, email, created_at 
FROM auth.users 
WHERE id = '47c7551c-a410-4c5f-958f-dfda5f54f0d9';

-- 3. Si l'utilisateur existe dans auth.users mais pas dans public.users, l'insérer
INSERT INTO public.users (user_id, email, username, created_at)
SELECT 
    id as user_id,
    email,
    COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1)) as username,
    created_at
FROM auth.users 
WHERE id = '47c7551c-a410-4c5f-958f-dfda5f54f0d9'
ON CONFLICT (user_id) DO UPDATE 
SET 
    email = EXCLUDED.email,
    updated_at = now();

-- 4. Vérifier que l'insertion a fonctionné
SELECT * FROM public.users 
WHERE user_id = '47c7551c-a410-4c5f-958f-dfda5f54f0d9';