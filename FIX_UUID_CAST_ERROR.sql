-- Script pour corriger l'erreur de cast UUID

-- Si vous avez cette erreur "operator does not exist: uuid = text"
-- NE PAS UTILISER D'ID EN DUR !

-- 1. Pour chercher VOS propres enregistrements
-- Utilisez auth.uid() qui retourne automatiquement le bon type UUID
SELECT * FROM postfast_api_keys 
WHERE user_id = auth.uid();

-- 2. Pour insérer une clé API pour VOUS
-- Utilisez auth.uid() pour votre user_id
INSERT INTO public.postfast_api_keys (user_id, name, api_key, is_active, is_default)
VALUES (
  auth.uid(),  -- Automatiquement votre UUID
  'Ma clé PostFast',
  'pf-api-key-xxx', -- Remplacez par votre vraie clé API
  true,
  true
)
ON CONFLICT (id) DO NOTHING;

-- 3. Alternative : utiliser auth.uid() si vous êtes connecté
-- INSERT INTO public.postfast_api_keys (user_id, name, api_key, is_active, is_default)
-- VALUES (
--   auth.uid(), -- Utilise directement l'UUID de l'utilisateur connecté
--   'Ma clé PostFast',
--   'pf-api-key-xxx',
--   true,
--   true
-- );

-- 4. Pour vérifier votre user_id actuel
SELECT id, email FROM auth.users WHERE email = 'votre-email@example.com';

-- 5. Si vous voulez voir tous les types de colonnes
SELECT 
  column_name, 
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('postfast_api_keys', 'scheduled_posts')
AND column_name LIKE '%user%'
ORDER BY table_name, ordinal_position;