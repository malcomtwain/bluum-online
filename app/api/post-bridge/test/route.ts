import { NextResponse } from 'next/server';
import { PostBridgeAPI } from '@/lib/post-bridge';

export async function GET(request: Request) {
  try {
    // Get API key from Authorization header
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: 'No API key provided. Use Authorization: Bearer your_api_key' 
      }, { status: 400 });
    }
    
    const apiKey = authHeader.substring(7);
    
    // Validate API key format
    if (!apiKey.startsWith('pb_live_') && !apiKey.startsWith('pb_test_')) {
      return NextResponse.json({ 
        error: 'Invalid Post-bridge API key format. Must start with pb_live_ or pb_test_' 
      }, { status: 400 });
    }

    // Test the API key
    const postBridgeApi = new PostBridgeAPI(apiKey);
    
    // Try to fetch social accounts (limit 1 for testing)
    const response = await postBridgeApi.getSocialAccounts({ limit: 1 });
    
    return NextResponse.json({
      success: true,
      message: 'API key is valid!',
      apiKeyType: apiKey.startsWith('pb_live_') ? 'live' : 'test',
      accountsFound: response.data.length,
      totalAccounts: response.meta?.total || 0
    });

  } catch (error: any) {
    console.error('Post-bridge API test failed:', error);
    
    // Parse specific error messages
    let errorMessage = error.message;
    if (error.message.includes('401')) {
      errorMessage = 'Invalid API key - check your Post-bridge dashboard';
    } else if (error.message.includes('403')) {
      errorMessage = 'API key lacks permissions';
    } else if (error.message.includes('404')) {
      errorMessage = 'Post-bridge API endpoint not found';
    }
    
    return NextResponse.json({ 
      success: false,
      error: errorMessage,
      details: error.message
    }, { status: 400 });
  }
}