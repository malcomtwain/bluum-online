import { NextRequest, NextResponse } from 'next/server';
import { getRapidApiKey, rapidApiGetJson } from '@/lib/rapidapi';

// GET /api/tiktok-post?videoId=123 ... → returns minimal post stats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');
    if (!videoId) {
      return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
    }

    const apiKey = getRapidApiKey(request);
    if (!apiKey) {
      return NextResponse.json({ error: 'RapidAPI key missing' }, { status: 401 });
    }

    const host = 'tiktok-api23.p.rapidapi.com';
    const url = `https://${host}/api/post/detail?videoId=${encodeURIComponent(videoId)}`;
    const data = await rapidApiGetJson(url, apiKey, host);

    const item = data?.itemInfo?.itemStruct || data?.data?.itemInfo?.itemStruct || {};
    const stats = item?.stats || {};
    const result = {
      videoId,
      views: Number(stats?.playCount || 0),
      likes: Number(stats?.diggCount || 0),
      comments: Number(stats?.commentCount || 0),
      reposts: Number(stats?.shareCount || 0),
    };

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch post detail' }, { status: 500 });
  }
}


