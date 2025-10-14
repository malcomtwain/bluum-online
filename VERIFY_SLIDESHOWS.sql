-- Vérifier tous les slideshows créés
SELECT 
    id,
    user_id,
    file_name,
    style_type,
    image_count,
    created_at,
    file_url
FROM generated_slideshows
WHERE user_id = '47c7551c-a410-4c5f-958f-dfda5f54f0d9'
ORDER BY created_at DESC;

-- Vérifier s'il y a des slideshows récents
SELECT 
    COUNT(*) as total_slideshows,
    MAX(created_at) as last_created
FROM generated_slideshows
WHERE user_id = '47c7551c-a410-4c5f-958f-dfda5f54f0d9';