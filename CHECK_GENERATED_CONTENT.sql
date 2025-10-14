-- VÉRIFIER LES VIDÉOS GÉNÉRÉES
SELECT 
    id,
    user_id,
    file_name,
    model_type,
    created_at
FROM generated_videos
ORDER BY created_at DESC
LIMIT 5;

-- VÉRIFIER LES SLIDESHOWS GÉNÉRÉS
SELECT 
    id,
    user_id,
    file_name,
    style_type,
    created_at
FROM generated_slideshows
ORDER BY created_at DESC
LIMIT 5;

-- COMPTER LE CONTENU PAR UTILISATEUR
SELECT 
    user_id,
    COUNT(*) FILTER (WHERE file_name LIKE '%slideshow%') as slideshow_count,
    COUNT(*) FILTER (WHERE file_name NOT LIKE '%slideshow%') as video_count,
    COUNT(*) as total_count
FROM (
    SELECT user_id, file_name FROM generated_videos
    UNION ALL
    SELECT user_id, file_name FROM generated_slideshows
) as all_content
GROUP BY user_id;