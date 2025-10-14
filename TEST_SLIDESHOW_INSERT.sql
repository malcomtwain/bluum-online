-- Test direct d'insertion d'un slideshow
INSERT INTO generated_slideshows (
    user_id,
    file_name,
    file_path,
    file_url,
    image_count,
    style_type,
    metadata
) VALUES (
    '47c7551c-a410-4c5f-958f-dfda5f54f0d9',
    'test-slideshow-' || EXTRACT(EPOCH FROM NOW())::INTEGER,
    '/generated-slideshows/test',
    '/generated-slideshows/test',
    5,
    1,
    '{"test": true}'::jsonb
) RETURNING *;

-- Vérifier que l'insertion a fonctionné
SELECT * FROM generated_slideshows 
WHERE user_id = '47c7551c-a410-4c5f-958f-dfda5f54f0d9'
ORDER BY created_at DESC;