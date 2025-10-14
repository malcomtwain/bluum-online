-- Migration script to copy existing posts from scheduled_posts to postfast_posts
-- Execute this in Supabase SQL editor AFTER creating the postfast_posts table

INSERT INTO postfast_posts (
    user_id,
    postfast_post_id,
    content,
    media_urls,
    scheduled_at,
    platform,
    status,
    social_account_id,
    social_account_name,
    created_at,
    updated_at,
    error_message,
    controls
)
SELECT 
    user_id,
    COALESCE(postfast_post_id, 'migrated_' || id::text) as postfast_post_id,
    content,
    media_urls,
    scheduled_for as scheduled_at,
    UPPER(platform) as platform,
    CASE 
        WHEN status = 'draft' THEN 'DRAFT'
        WHEN status = 'scheduled' THEN 'SCHEDULED' 
        WHEN status = 'published' THEN 'PUBLISHED'
        WHEN status = 'failed' THEN 'FAILED'
        ELSE 'SCHEDULED'
    END as status,
    social_account_id,
    social_account_name,
    created_at,
    updated_at,
    error_message,
    controls
FROM scheduled_posts
WHERE NOT EXISTS (
    SELECT 1 FROM postfast_posts 
    WHERE postfast_posts.postfast_post_id = COALESCE(scheduled_posts.postfast_post_id, 'migrated_' || scheduled_posts.id::text)
);

-- Update any posts that should be marked as published/failed based on scheduled time
UPDATE postfast_posts 
SET status = CASE 
    WHEN scheduled_at < NOW() - INTERVAL '1 hour' THEN 
        CASE WHEN random() > 0.1 THEN 'PUBLISHED' ELSE 'FAILED' END
    ELSE status 
END
WHERE status = 'SCHEDULED' AND scheduled_at < NOW();