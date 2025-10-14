import { NextResponse } from 'next/server';
import { PostBridgeAPI } from '@/lib/post-bridge';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request) {
  try {
    // Check if this is a direct API key test (Post-bridge API key in Authorization header)
    const authHeader = request.headers.get('Authorization');
    let apiKey = null;
    
    // Check if the header contains a Post-bridge API key (starts with pb_)
    if (authHeader && authHeader.startsWith('Bearer pb_')) {
      apiKey = authHeader.substring(7);
    } else {
      // If no API key in header, get from database (normal flow)
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Get user from JWT token in Authorization header
      const authHeaderValue = request.headers.get('Authorization');
      let userId = null;
      
      if (authHeaderValue && authHeaderValue.startsWith('Bearer ')) {
        // Get user from JWT token
        const token = authHeaderValue.substring(7);
        try {
          const { data: { user } } = await supabase.auth.getUser(token);
          userId = user?.id;
        } catch (error) {
          console.error('Error getting user from token:', error);
        }
      }
      
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized - authentication required' }, { status: 401 });
      }

      // Get user's Post-bridge API key
      const { data: apiKeyData, error } = await supabase
        .from('post_bridge_api_keys')
        .select('api_key')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('API key lookup error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      if (!apiKeyData?.api_key) {
        return NextResponse.json({ error: 'No active Post-bridge API key found' }, { status: 400 });
      }
      
      apiKey = apiKeyData.api_key;
    }

    // Initialize Post-bridge API
    const postBridgeApi = new PostBridgeAPI(apiKey);
    
    // Get URL parameters for filtering
    const url = new URL(request.url);
    const platform = url.searchParams.getAll('platform');
    const username = url.searchParams.getAll('username');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const limit = parseInt(url.searchParams.get('limit') || '100');

    const params: any = { offset, limit };
    if (platform.length > 0) params.platform = platform;
    if (username.length > 0) params.username = username;

    // Fetch social accounts from Post-bridge
    const response = await postBridgeApi.getSocialAccounts(params);

    return NextResponse.json({
      success: true,
      accounts: response.data,
      allAccounts: response.data, // For compatibility with existing code
      meta: response.meta
    });

  } catch (error: any) {
    console.error('Post-bridge social accounts error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch social accounts',
      success: false 
    }, { status: 500 });
  }
}