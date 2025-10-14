import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Configuration TikTok OAuth
const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || 'aw0mvywpits9o5q1';
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || '';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Si l'utilisateur a refusé l'autorisation
    if (error) {
      console.error('TikTok OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        new URL(`/tiktok-accounts?error=${encodeURIComponent(errorDescription || error)}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/tiktok-accounts?error=Missing authorization code or state', request.url)
      );
    }

    // Échanger le code contre un access token
    const tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/';
    
    // Pour dev local, utiliser localhost
    const redirectUri = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000/api/tiktok/callback'
      : `${new URL(request.url).origin}/api/tiktok/callback`;
    
    const tokenParams = new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY,
      client_secret: TIKTOK_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString()
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error || !tokenData.access_token) {
      console.error('Failed to get access token:', tokenData);
      return NextResponse.redirect(
        new URL('/tiktok-accounts?error=Failed to get access token', request.url)
      );
    }

    // Récupérer les informations du profil utilisateur
    const userInfoResponse = await fetch('https://open.tiktokapis.com/v2/user/info/', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
      body: JSON.stringify({
        fields: {
          user: {
            display_name: true,
            username: true,
            avatar_url: true,
          },
          stats: {
            follower_count: true,
            following_count: true,
            video_count: true,
          }
        }
      })
    });

    const userInfo = await userInfoResponse.json();

    if (!userInfo.data || !userInfo.data.user) {
      console.error('Failed to get user info:', userInfo);
      return NextResponse.redirect(
        new URL('/tiktok-accounts?error=Failed to get user info', request.url)
      );
    }

    const tiktokUser = userInfo.data.user;
    const tiktokStats = userInfo.data.stats || {};

    // Récupérer l'ID de l'utilisateur depuis les cookies ou la session
    // Pour l'instant, on utilise une méthode simple avec les cookies
    const cookies = request.cookies;
    const userId = cookies.get('user_id')?.value;

    if (!userId) {
      return NextResponse.redirect(
        new URL('/tiktok-accounts?error=User not authenticated', request.url)
      );
    }

    // Sauvegarder le compte TikTok dans la base de données
    const { data, error: dbError } = await supabase
      .from('tiktok_accounts')
      .upsert({
        user_id: userId,
        username: tiktokUser.username,
        display_name: tiktokUser.display_name,
        avatar_url: tiktokUser.avatar_url,
        tiktok_user_id: tiktokUser.union_id || tiktokUser.open_id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        follower_count: tiktokStats.follower_count,
        following_count: tiktokStats.following_count,
        video_count: tiktokStats.video_count,
        connected_at: new Date().toISOString()
      }, {
        onConflict: 'username,user_id'
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.redirect(
        new URL('/tiktok-accounts?error=Failed to save account', request.url)
      );
    }

    // Rediriger vers la page des comptes avec succès
    return NextResponse.redirect(
      new URL('/tiktok-accounts?success=Account connected successfully', request.url)
    );

  } catch (error) {
    console.error('TikTok callback error:', error);
    return NextResponse.redirect(
      new URL('/tiktok-accounts?error=An unexpected error occurred', request.url)
    );
  }
}