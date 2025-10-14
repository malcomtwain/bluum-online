-- 1. D'abord supprimer l'entrée incorrecte
DELETE FROM postfast_api_keys WHERE user_id = 'VOTRE_INVITATION_CODE';

-- 2. Insérer la vraie clé avec le vrai invitation code
INSERT INTO postfast_api_keys (
  user_id,
  name,
  api_key,
  is_active,
  is_default
) VALUES (
  'invitation_BLUUM-e4ac-3b8a-460f-c3b3', -- Votre vrai invitation code
  'Ma clé PostFast',
  '/exVqYMq07y5uqCH1Hnv2nux6BCUOmIK0b6Zin4M+pQ=', -- Votre vraie clé API PostFast
  true,
  true
);

-- 3. Vérifier que c'est bien inséré
SELECT * FROM postfast_api_keys WHERE user_id = 'invitation_BLUUM-e4ac-3b8a-460f-c3b3';