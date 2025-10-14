const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { spawn } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

const execAsync = promisify(require('child_process').exec);

// Configuration
const PORT = process.env.PORT || 3001;
const WORKER_ID = process.env.WORKER_ID || `worker-${Date.now()}`;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '5000');

// Supabase setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Express app
const app = express();
app.use(express.json());

let stats = {
  processed: 0,
  failed: 0,
  lastJobAt: null
};

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    worker_id: WORKER_ID,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/stats', (req, res) => {
  res.json({
    worker_id: WORKER_ID,
    ...stats,
    uptime: process.uptime()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Worker ${WORKER_ID} listening on port ${PORT}`);
  console.log(`📊 Stats: http://localhost:${PORT}/stats`);
  console.log(`❤️ Health: http://localhost:${PORT}/health`);
});

// Helper functions
async function updateJobProgress(jobId, progress) {
  try {
    await supabase
      .from('video_jobs')
      .update({ progress })
      .eq('id', jobId);
  } catch (error) {
    console.error('Error updating progress:', error);
  }
}

async function downloadFile(url, outputPath) {
  console.log(`📥 Downloading: ${url.substring(0, 80)}...`);
  const fetch = (await import('node-fetch')).default;

  if (url.startsWith('http')) {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = await response.buffer();
    await fs.writeFile(outputPath, buffer);
    console.log(`   ✅ Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
    return;
  }

  throw new Error(`Unsupported URL format: ${url.substring(0, 50)}`);
}

// Process TikTok Creative video (handles both images AND videos)
async function processTikTokCreativeVideo(jobId, data, tempDir) {
  console.log(`[TikTok Creative] Processing job ${jobId}`);

  const ts = Date.now();
  const {
    images = [],
    videos = [],
    music,
    hooks = [],
    clipDuration = 0.6,
    videoCount = 1
  } = data;

  // Combine images and videos
  const allMedia = [
    ...images.map(img => ({ ...img, type: 'image' })),
    ...videos.map(vid => ({ ...vid, type: 'video' }))
  ];

  if (allMedia.length === 0) {
    throw new Error('No media to process');
  }

  console.log(`[TikTok Creative] Processing ${allMedia.length} media items (${images.length} images, ${videos.length} videos)`);

  // Download media (limit to first 15 for performance)
  const mediaToProcess = allMedia.slice(0, 15);
  const mediaPaths = [];

  for (let i = 0; i < mediaToProcess.length; i++) {
    const media = mediaToProcess[i];

    if (media.type === 'image') {
      const imgPath = path.join(tempDir, `img_${i.toString().padStart(2, '0')}.jpg`);
      await downloadFile(media.url, imgPath);
      mediaPaths.push(imgPath);
    } else if (media.type === 'video') {
      const vidPath = path.join(tempDir, `vid_${i.toString().padStart(2, '0')}.mp4`);
      await downloadFile(media.url, vidPath);

      // Convert video to standard format
      const processedPath = path.join(tempDir, `processed_${i.toString().padStart(2, '0')}.mp4`);
      await execAsync(
        `ffmpeg -i "${vidPath}" -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" ` +
        `-c:v libx264 -preset ultrafast -crf 28 -an -r 30 -pix_fmt yuv420p -y "${processedPath}"`
      );
      mediaPaths.push(processedPath);
    }
  }

  await updateJobProgress(jobId, 40);

  // Create concat file
  const concatContent = mediaPaths.map(p => `file '${p}'\nduration ${clipDuration}\n`).join('');
  const concatFile = path.join(tempDir, 'concat.txt');
  await fs.writeFile(concatFile, concatContent);

  console.log(`[TikTok Creative] Created concat file with ${mediaPaths.length} items`);

  // Download music if present
  let musicPath = null;
  if (music?.url && music.id !== 'no-music') {
    musicPath = path.join(tempDir, 'music.mp3');
    await downloadFile(music.url, musicPath);
  }

  await updateJobProgress(jobId, 60);

  // Create video with FFmpeg
  const outputPath = path.join(tempDir, `tiktok_${ts}.mp4`);

  let ffmpegCmd = `ffmpeg -f concat -safe 0 -i "${concatFile}"`;

  if (musicPath) {
    ffmpegCmd += ` -i "${musicPath}" -shortest -c:a aac`;
  }

  ffmpegCmd += ` -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" ` +
    `-c:v libx264 -preset medium -crf 23 -r 30 -pix_fmt yuv420p -y "${outputPath}"`;

  console.log(`[TikTok Creative] Running FFmpeg...`);
  await execAsync(ffmpegCmd);

  await updateJobProgress(jobId, 80);

  // Upload to Supabase Storage
  const fileBuffer = await fs.readFile(outputPath);
  const filename = `generated/tiktok_${ts}_${jobId}.mp4`;

  const { error: uploadError } = await supabase.storage
    .from('videos')
    .upload(filename, fileBuffer, {
      contentType: 'video/mp4',
      upsert: true
    });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('videos')
    .getPublicUrl(filename);

  console.log(`[TikTok Creative] ✅ Video uploaded: ${publicUrl}`);

  return publicUrl;
}

// Main job processor
async function processVideoJob(job) {
  const { id, job_data } = job;

  console.log(`\n🎬 Processing job ${id}`);
  console.log(`📦 Job data:`, { mode: job_data.mode, apiEndpoint: job_data.apiEndpoint });

  const tempDir = path.join(os.tmpdir(), `bluum_job_${id}`);

  try {
    await fs.mkdir(tempDir, { recursive: true });
    await supabase.from('video_jobs').update({ status: 'processing' }).eq('id', id);
    await updateJobProgress(id, 10);

    const { apiEndpoint } = job_data;
    let videoUrl;

    // Route to appropriate processor
    if (apiEndpoint === '/api/create-video/tiktok-creative' || job_data.mode === 'autocut') {
      videoUrl = await processTikTokCreativeVideo(id, job_data, tempDir);
    } else {
      throw new Error(`Unsupported endpoint: ${apiEndpoint}`);
    }

    await updateJobProgress(jobId, 90);

    // Mark as completed
    await supabase
      .from('video_jobs')
      .update({
        status: 'completed',
        video_url: videoUrl,
        progress: 100,
        completed_at: new Date().toISOString()
      })
      .eq('id', id);

    console.log(`✅ Job ${id} completed: ${videoUrl}`);
    stats.processed++;
    stats.lastJobAt = new Date().toISOString();

    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

  } catch (error) {
    console.error(`❌ Job ${id} failed:`, error.message);

    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

    await supabase
      .from('video_jobs')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('id', id);

    stats.failed++;
  }
}

// Job polling
let isProcessing = false;

async function pollForJobs() {
  if (isProcessing) return;

  try {
    isProcessing = true;

    const { data: jobs, error } = await supabase
      .from('video_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) {
      console.error('Error fetching jobs:', error);
      return;
    }

    if (jobs && jobs.length > 0) {
      await processVideoJob(jobs[0]);
    }

  } catch (error) {
    console.error('Error in job polling:', error);
  } finally {
    isProcessing = false;
  }
}

// Start polling
console.log(`🔄 Starting job polling every ${POLL_INTERVAL}ms`);
setInterval(pollForJobs, POLL_INTERVAL);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
