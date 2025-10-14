-- Vérifier TOUS les slideshows dans la base
SELECT 
    id,
    user_id,
    file_name,
    file_url,
    style_type,
    image_count,
    created_at
FROM generated_slideshows
ORDER BY created_at DESC
LIMIT 20;

-- Compter le total
SELECT COUNT(*) as total FROM generated_slideshows;