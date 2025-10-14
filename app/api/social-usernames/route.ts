import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const userId = request.headers.get('x-invitation-code');
    
    if (!userId) {
      return NextResponse.json({ error: 'No user ID provided' }, { status: 400 });
    }
    
    const { data, error } = await supabase
      .from('social_account_usernames')
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    
    // Convert array to object for easy lookup
    const usernamesMap = (data || []).reduce((acc: any, item: any) => {
      acc[item.account_id] = item.custom_username;
      return acc;
    }, {});
    
    return NextResponse.json({ usernames: usernamesMap, rows: data || [] });
  } catch (error) {
    console.error('Error fetching usernames:', error);
    return NextResponse.json({ error: 'Failed to fetch usernames' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { userId, accountId, platform, username } = await request.json();
    
    if (!userId || !accountId || !username) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Clean username (remove @ if present)
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
    
    // Upsert (insert or update)
    const { data, error } = await supabase
      .from('social_account_usernames')
      .upsert({
        user_id: userId,
        account_id: accountId,
        platform: platform,
        custom_username: cleanUsername,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,account_id'
      });
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, username: cleanUsername });
  } catch (error) {
    console.error('Error saving username:', error);
    return NextResponse.json({ error: 'Failed to save username' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { userId, accountId } = await request.json();
    
    if (!userId || !accountId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const { error } = await supabase
      .from('social_account_usernames')
      .delete()
      .eq('user_id', userId)
      .eq('account_id', accountId);
    
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting username:', error);
    return NextResponse.json({ error: 'Failed to delete username' }, { status: 500 });
  }
}