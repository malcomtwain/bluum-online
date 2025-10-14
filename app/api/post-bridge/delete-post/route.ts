import { NextResponse } from 'next/server';
import { PostBridgeAPI } from '@/lib/post-bridge';
import { createClient } from '@/lib/supabase-server';

export async function DELETE(request: Request) {
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

    // Get post ID from query parameters
    const url = new URL(request.url);
    const postId = url.searchParams.get('id');

    if (!postId) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    // Initialize Post-bridge API
    const postBridgeApi = new PostBridgeAPI(apiKeyData.api_key);
    
    // Delete the post
    const result = await postBridgeApi.deletePost(postId);

    return NextResponse.json({
      success: result.success,
      message: 'Post deleted successfully'
    });

  } catch (error: any) {
    console.error('Post-bridge delete post error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to delete post',
      success: false 
    }, { status: 500 });
  }
}