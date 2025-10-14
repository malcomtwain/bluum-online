import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
}

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      db: {
        schema: 'public',
      },
      auth: {
        persistSession: false,
      },
      global: {
        headers: {
          'x-client-info': 'bluum-worker',
        },
      },
    })
  : null;

// Helper function to upload base64 media to Supabase Storage
async function uploadBase64ToStorage(base64Data: string, filename: string, bucket: string = 'job-media'): Promise<string | null> {
  try {
    // Extract actual base64 data (remove data:image/png;base64, prefix)
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      console.error('Invalid base64 string format');
      return null;
    }

    const base64Content = matches[2];
    const buffer = Buffer.from(base64Content, 'base64');

    // Upload to Supabase Storage
    const { data, error } = await supabase!.storage
      .from(bucket)
      .upload(filename, buffer, {
        contentType: matches[1],
        upsert: true
      });

    if (error) {
      console.error('Storage upload error:', error);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase!.storage
      .from(bucket)
      .getPublicUrl(filename);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading to storage:', error);
    return null;
  }
}

// Helper function to process media arrays (images/videos)
async function processMediaArray(mediaArray: any[], prefix: string, timestamp: number): Promise<any[]> {
  if (!mediaArray || mediaArray.length === 0) return [];

  const processed = [];
  for (let i = 0; i < mediaArray.length; i++) {
    const item = mediaArray[i];

    // If URL is base64, upload to storage
    if (item.url && item.url.startsWith('data:')) {
      const filename = `${prefix}_${timestamp}_${i}.${item.url.includes('video') ? 'mp4' : 'jpg'}`;
      const publicUrl = await uploadBase64ToStorage(item.url, filename);

      if (publicUrl) {
        processed.push({ ...item, url: publicUrl });
      } else {
        console.warn(`Failed to upload ${filename}, keeping original`);
        processed.push(item);
      }
    } else {
      // Already a URL, keep as is
      processed.push(item);
    }
  }

  return processed;
}

export async function POST(req: Request) {
  try {
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'Supabase not configured'
      }, { status: 500 });
    }

    // Get user from authorization header
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
      }
    }

    // Users must be authenticated to create jobs
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required to create video jobs'
      }, { status: 401 });
    }

    const data = await req.json();
    const timestamp = Date.now();

    console.log('[Job] Processing media uploads...');

    // Upload all base64 media to Supabase Storage before creating job
    const processedData = { ...data };

    // Process different media arrays
    if (data.images) {
      processedData.images = await processMediaArray(data.images, 'img', timestamp);
      console.log(`[Job] Processed ${processedData.images.length} images`);
    }

    if (data.videos) {
      processedData.videos = await processMediaArray(data.videos, 'vid', timestamp);
      console.log(`[Job] Processed ${processedData.videos.length} videos`);
    }

    if (data.videosBeforeRefrain) {
      processedData.videosBeforeRefrain = await processMediaArray(data.videosBeforeRefrain, 'before', timestamp);
      console.log(`[Job] Processed ${processedData.videosBeforeRefrain.length} videos before refrain`);
    }

    if (data.videosAfterRefrain) {
      processedData.videosAfterRefrain = await processMediaArray(data.videosAfterRefrain, 'after', timestamp);
      console.log(`[Job] Processed ${processedData.videosAfterRefrain.length} videos after refrain`);
    }

    // Process music if it's base64
    if (data.music && data.music.url && data.music.url.startsWith('data:')) {
      const musicFilename = `music_${timestamp}.mp3`;
      const musicUrl = await uploadBase64ToStorage(data.music.url, musicFilename);
      if (musicUrl) {
        processedData.music = { ...data.music, url: musicUrl };
        console.log(`[Job] Processed music`);
      }
    }

    // Process hook images if present
    if (data.hookImages && Array.isArray(data.hookImages)) {
      const processedHooks = [];
      for (let i = 0; i < data.hookImages.length; i++) {
        const hookImg = data.hookImages[i];
        if (hookImg.startsWith('data:')) {
          const hookFilename = `hook_${timestamp}_${i}.png`;
          const hookUrl = await uploadBase64ToStorage(hookImg, hookFilename);
          processedHooks.push(hookUrl || hookImg);
        } else {
          processedHooks.push(hookImg);
        }
      }
      processedData.hookImages = processedHooks;
      console.log(`[Job] Processed ${processedHooks.length} hook images`);
    }

    // Now create job with URLs instead of base64
    const jobData = {
      ...processedData,
      timestamp,
      userId
    };

    console.log('[Job] Creating job in database...');

    // Create job in queue
    const { data: job, error: insertError } = await supabase
      .from('video_jobs')
      .insert({
        user_id: userId,
        status: 'pending',
        job_data: jobData,
        progress: 0
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating job:', insertError);
      return NextResponse.json({
        success: false,
        error: 'Failed to create video job'
      }, { status: 500 });
    }

    console.log(`✅ Job created: ${job.id}`);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Video job created successfully. Processing will continue in background.',
      estimatedTime: 60 // Rough estimate in seconds
    });

  } catch (error) {
    console.error('Error in create-video-job route:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
