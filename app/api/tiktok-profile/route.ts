import { NextRequest, NextResponse } from 'next/server';
import { getRapidApiKey, rapidApiGetJson } from '@/lib/rapidapi';

// Simple proxy to fetch basic TikTok user profile by username via RapidAPI
// Expects query param ?username=USERNAME (without @)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const usernameRaw = searchParams.get('username') || '';
    const username = usernameRaw.replace(/^@/, '').trim();
    if (!username) {
      return NextResponse.json({ error: 'username is required' }, { status: 400 });
    }

    const apiKey = getRapidApiKey(request);
    if (!apiKey) {
      return NextResponse.json({ error: 'RapidAPI key missing' }, { status: 401 });
    }

    // Example endpoint from RapidAPI vendor (host may vary)
    const host = 'tiktok-api23.p.rapidapi.com';
    // Some vendors use uniqueId, others unique_id
    const infoUrlA = `https://${host}/api/user/info?uniqueId=${encodeURIComponent(username)}`;
    const infoUrlB = `https://${host}/api/user/info?unique_id=${encodeURIComponent(username)}`;
    let info: any;
    try {
      info = await rapidApiGetJson(infoUrlA, apiKey, host);
    } catch (eA) {
      try {
        info = await rapidApiGetJson(infoUrlB, apiKey, host);
      } catch (eB) {
        // If both fail (quota/invalid key), return basic profile to avoid 500
        return NextResponse.json({
          username,
          displayName: username,
          avatar: '',
          followers: 0,
          following: 0,
          hearts: 0,
          videos: 0,
          verified: false,
          signature: '',
          views: 0,
          comments: 0,
          reposts: 0,
          secUid: ''
        });
      }
    }

    // Normalize across possible shapes
    const userA = info?.userInfo?.user;
    const statsA = info?.userInfo?.stats;
    const userB = info?.data?.user;
    const statsB = info?.data?.stats;
    const user = userA || userB || {};
    const stats = statsA || statsB || {};
    const secUid = user?.secUid || user?.sec_uid || info?.data?.secUid || '';

    // Optionally fetch last posts to compute views/likes/comments/reposts totals
    let views = 0;
    let likes = Number(stats?.heart || stats?.heartCount || 0);
    let comments = 0;
    let reposts = 0;
    if (secUid) {
      const postsUrl = `https://${host}/api/user/posts?secUid=${encodeURIComponent(secUid)}&count=35&cursor=0`;
      try {
        const posts = await rapidApiGetJson(postsUrl, apiKey, host);
        const awemeList = posts?.aweme_list || posts?.data?.aweme_list || posts?.data?.videos || [];
        for (const p of awemeList) {
          const s = p?.statistics || p?.stats || {};
          views += Number(s?.play_count || s?.playCount || 0);
          likes += Number(s?.digg_count || s?.diggCount || 0);
          comments += Number(s?.comment_count || s?.commentCount || 0);
          reposts += Number(s?.share_count || s?.shareCount || 0);
        }
      } catch (ePosts) {
        // ignore post fetch errors (rate limit) and keep base profile
      }
    }

    const profile = {
      username: user?.uniqueId || user?.unique_id || username,
      displayName: user?.nickname || user?.uniqueId || username,
      avatar: user?.avatarLarger || user?.avatarMedium || user?.avatarThumb || '',
      followers: Number(stats?.followerCount || 0),
      following: Number(stats?.followingCount || 0),
      hearts: Number(stats?.heart || stats?.heartCount || likes || 0),
      videos: Number(stats?.videoCount || 0),
      verified: Boolean(user?.verified),
      signature: user?.signature || '',
      views,
      comments,
      reposts,
      secUid,
    };

    return NextResponse.json(profile, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch TikTok profile' }, { status: 500 });
  }
}

// Removed legacy duplicate handler and extra imports