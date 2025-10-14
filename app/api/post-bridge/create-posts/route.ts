import { NextResponse } from 'next/server';
import { PostBridgeAPI } from '@/lib/post-bridge';
import { createClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's Post-bridge API key
    const { data: apiKeyData } = await supabase
      .from('post_bridge_api_keys')
      .select('api_key')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!apiKeyData?.api_key) {
      return NextResponse.json({ error: 'No active Post-bridge API key found' }, { status: 400 });
    }

    // Get request data
    const { posts, controls } = await request.json();

    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json({ error: 'Posts array is required' }, { status: 400 });
    }

    // Initialize Post-bridge API
    const postBridgeApi = new PostBridgeAPI(apiKeyData.api_key);
    
    const results = [];
    const errors = [];

    // Process each post
    for (const post of posts) {
      try {
        // Prepare platform configurations based on controls
        const platformConfigurations: any = {};
        
        if (controls) {
          // Handle TikTok specific settings
          if (controls.tiktokPrivacy || controls.tiktokAllowComments !== undefined || 
              controls.tiktokAllowDuet !== undefined || controls.tiktokAllowStitch !== undefined ||
              controls.tiktokIsDraft !== undefined) {
            platformConfigurations.tiktok = {
              caption: post.content,
              draft: controls.tiktokIsDraft || false,
            };
            
            if (post.mediaItems && post.mediaItems.length > 0) {
              platformConfigurations.tiktok.media = post.mediaItems.map((item: any) => item.key);
            }
          }
        }

        // Create the post via Post-bridge API
        const createdPost = await postBridgeApi.createPost({
          caption: post.content,
          scheduled_at: post.scheduledAt,
          social_accounts: [post.socialMediaId],
          media: post.mediaItems?.map((item: any) => item.key),
          platform_configurations: Object.keys(platformConfigurations).length > 0 ? platformConfigurations : undefined,
          is_draft: controls?.tiktokIsDraft || false,
          processing_enabled: true
        });

        results.push({
          success: true,
          postId: createdPost.id,
          post: createdPost
        });

      } catch (error: any) {
        console.error('Error creating post:', error);
        errors.push({
          success: false,
          error: error.message,
          post: post
        });
      }
    }

    return NextResponse.json({
      success: results.length > 0,
      postIds: results.map(r => r.postId),
      results,
      errors,
      created: results.length,
      failed: errors.length
    });

  } catch (error: any) {
    console.error('Post-bridge create posts error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to create posts',
      success: false 
    }, { status: 500 });
  }
}