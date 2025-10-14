-- TEST : Insérer une vidéo de test dans la table
INSERT INTO generated_videos (
  user_id,
  file_name,
  file_path,
  file_url,
  model_type,
  metadata
) VALUES (
  '47c7551c-a410-4c5f-958f-dfda5f54f0d9', -- Votre user ID
  'test_video.mp4',
  'test/path/video.mp4',
  'https://test.url/video.mp4',
  'test-model',
  '{}'::jsonb
);

-- Vérifier que l'insertion a fonctionné
SELECT * FROM generated_videos ORDER BY created_at DESC LIMIT 5;