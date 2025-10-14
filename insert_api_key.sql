-- Script pour insérer directement votre clé API PostFast
-- Remplacez 'VOTRE_INVITATION_CODE' par votre vrai code d'invitation (ex: invitation_BLUUM-e4ac-3b8a-460f-c3b3)
-- Remplacez 'VOTRE_CLE_API_POSTFAST' par votre vraie clé API PostFast

INSERT INTO postfast_api_keys (
  user_id,
  name,
  api_key,
  is_active,
  is_default
) VALUES (
  'VOTRE_INVITATION_CODE', -- Remplacez par votre invitation code
  'Ma clé PostFast',
  'VOTRE_CLE_API_POSTFAST', -- Remplacez par votre clé API
  true,
  true
);

-- Pour vérifier que la clé a été ajoutée
SELECT * FROM postfast_api_keys WHERE user_id = 'VOTRE_INVITATION_CODE';