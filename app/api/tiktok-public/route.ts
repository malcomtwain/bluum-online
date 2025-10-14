import { NextRequest, NextResponse } from 'next/server';

// API pour récupérer des infos TikTok publiques SANS OAuth
// Utilise l'embed API qui ne nécessite pas d'authentification

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const username = searchParams.get('username');
  const videoId = searchParams.get('videoId');

  try {
    if (videoId) {
      // Récupérer les infos d'une vidéo via oEmbed (pas besoin d'auth!)
      const response = await fetch(`https://www.tiktok.com/oembed?url=https://www.tiktok.com/@username/video/${videoId}`);
      const data = await response.json();
      
      return NextResponse.json({
        success: true,
        video: {
          title: data.title,
          author: data.author_name,
          thumbnail: data.thumbnail_url,
          embed_html: data.html
        }
      });
    }

    if (username) {
      // Pour un profil public, on peut scraper ou utiliser des APIs tierces
      // Exemple avec une API tierce gratuite (non officielle)
      
      return NextResponse.json({
        success: true,
        message: 'Pour les profils, utilisez OAuth ou une API tierce',
        alternatives: [
          'RapidAPI TikTok API',
          'TikAPI.com',
          'TikTok oEmbed pour vidéos individuelles'
        ]
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Username or videoId required'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch TikTok data'
    }, { status: 500 });
  }
}