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

    // Get the uploaded file
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'video/mp4', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: `Unsupported file type: ${file.type}. Allowed types: ${allowedTypes.join(', ')}` 
      }, { status: 400 });
    }

    // Initialize Post-bridge API
    const postBridgeApi = new PostBridgeAPI(apiKeyData.api_key);
    
    // Upload the media
    const mediaId = await postBridgeApi.uploadMedia(file);
    
    // Get the media object to retrieve the URL
    const media = await postBridgeApi.getMediaById(mediaId);

    return NextResponse.json({
      success: true,
      key: mediaId,
      url: media.object.url,
      media_id: mediaId,
      media
    });

  } catch (error: any) {
    console.error('Post-bridge upload media error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to upload media',
      success: false 
    }, { status: 500 });
  }
}