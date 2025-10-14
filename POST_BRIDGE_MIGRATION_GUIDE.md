# Migration Guide: PostFast → Post-bridge API

This guide will help you migrate from PostFast API to Post-bridge API.

## Overview

Post-bridge API offers:
- Simpler API structure
- Better documentation 
- More reliable service
- Support for multiple platforms including TikTok, Instagram, Facebook, Twitter, etc.

## Migration Steps

### Step 1: Database Migration

Run the database migration script:

```bash
npx supabase db push --file supabase/migrations/migrate_to_post_bridge.sql
```

This will:
- Create `post_bridge_api_keys` table
- Add `post_bridge_post_id` and `media_ids` columns to `scheduled_posts`
- Set up RLS policies

### Step 2: Add Your API Key

1. Find your user ID:
```sql
SELECT id FROM auth.users WHERE email = 'your_email@example.com';
```

2. Edit `INSERT_POST_BRIDGE_API_KEY.sql`:
   - Replace `YOUR_USER_ID_HERE` with your actual user ID
   - Your API key is already set: `pb_live_6wCwS8ojvWbVt92qtthRPW`

3. Run the SQL in Supabase dashboard

### Step 3: Code Changes

The following files have been updated:

#### New Files Created:
- `lib/post-bridge.ts` - Post-bridge API client
- `lib/post-bridge-scheduler.ts` - Post-bridge scheduler
- `app/api/post-bridge/social-accounts/route.ts`
- `app/api/post-bridge/create-posts/route.ts`
- `app/api/post-bridge/upload-media/route.ts`
- `app/api/post-bridge/delete-post/route.ts`
- `app/api/bulk-schedule-bridge/route.ts`

#### Updated Files:
- `app/distribution/page.tsx` - Now uses Post-bridge API
- `app/schedule/page.tsx` - Now uses Post-bridge API (partially updated)

### Step 4: Key Changes

#### API Endpoints:
- Old: `/api/postfast/*`
- New: `/api/post-bridge/*`

#### Authentication:
- Old: `x-postfast-api-key` header
- New: `Authorization: Bearer {api_key}` header

#### Social Account IDs:
- Old: String IDs
- New: Number IDs

#### Database Structure:
- New table: `post_bridge_api_keys`
- New columns in `scheduled_posts`: `post_bridge_post_id`, `media_ids`

## API Differences

### PostFast vs Post-bridge

| Feature | PostFast | Post-bridge |
|---------|----------|-------------|
| Account IDs | String | Number |
| Media Upload | Complex S3 flow | Simple upload URL |
| Post Creation | Multi-step process | Single API call |
| Platform Support | Limited | All major platforms |
| Documentation | Basic | Comprehensive |

### Example API Calls

#### Get Social Accounts:
```javascript
// Old PostFast
fetch('/api/postfast/social-accounts', {
  headers: { 'x-postfast-api-key': apiKey }
})

// New Post-bridge  
fetch('/api/post-bridge/social-accounts', {
  headers: { 'Authorization': `Bearer ${apiKey}` }
})
```

#### Create Post:
```javascript
// Post-bridge
const post = await postBridgeApi.createPost({
  caption: 'Hello World!',
  scheduled_at: '2024-01-01T12:00:00Z',
  social_accounts: [123], // Number IDs
  media: ['media_id_1', 'media_id_2'],
  platform_configurations: {
    tiktok: {
      draft: false,
      is_aigc: false
    }
  }
})
```

## Migration Verification

After migration, test these features:
1. ✅ Social accounts loading
2. ✅ Media upload
3. ✅ Post creation
4. ✅ Bulk scheduling
5. ✅ Post deletion

## Rollback Plan

If issues occur, you can:
1. Revert code changes to use PostFast
2. Keep both API keys active
3. Database migration is additive (doesn't break existing data)

## Support

- Post-bridge Documentation: https://api.post-bridge.com/docs
- API Key: `pb_live_6wCwS8ojvWbVt92qtthRPW`

## Notes

- Rate limits are more conservative with Post-bridge (100 posts/day vs 800)
- All existing scheduled posts will continue to work
- New posts will use Post-bridge API
- Media handling is simplified with direct upload URLs