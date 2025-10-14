const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');

const execAsync = promisify(exec);

// Configuration
const PORT = process.env.PORT || 3001;
const WORKER_ID = process.env.WORKER_ID || `worker-${Date.now()}`;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '5000'); // 5 seconds

// Supabase setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Express app for health checks
const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    worker_id: WORKER_ID,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Stats endpoint
let stats = {
  processed: 0,
  failed: 0,
  lastJobAt: null
};

app.get('/stats', (req, res) => {
  res.json({
    worker_id: WORKER_ID,
    ...stats,
    uptime: process.uptime()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Worker ${WORKER_ID} listening on port ${PORT}`);
  console.log(`📊 Stats: http://localhost:${PORT}/stats`);
  console.log(`❤️ Health: http://localhost:${PORT}/health`);
});

// ===== VIDEO PROCESSING LOGIC =====

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
  const fetch = (await import('node-fetch')).default;

  if (url.startsWith('data:')) {
    // Handle data URLs
    const matches = url.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      const buffer = Buffer.from(matches[2], 'base64');
      await fs.writeFile(outputPath, buffer);
      return;
    }
  }

  if (url.startsWith('http')) {
    // Download from HTTP
    const response = await fetch(url);
    const buffer = await response.buffer();
    await fs.writeFile(outputPath, buffer);
    return;
  }

  // Try Supabase storage
  if (url.startsWith('/') || url.includes('supabase')) {
    const bucketPath = url.replace(/^\//, '').split('/').slice(1).join('/');
    const { data, error } = await supabase.storage
      .from('clips')
      .download(bucketPath);

    if (error) throw error;
    const buffer = Buffer.from(await data.arrayBuffer());
    await fs.writeFile(outputPath, buffer);
    return;
  }

  throw new Error(`Unsupported URL format: ${url.substring(0, 50)}`);
}

async function processVideoJob(job) {
  const { id, job_data } = job;

  console.log(`\n🎬 Processing job ${id}`);
  console.log(`📦 Job data:`, { mode: job_data.mode, apiEndpoint: job_data.apiEndpoint });

  const tempDir = path.join(os.tmpdir(), `bluum_job_${id}`);

  try {
    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true });
    await updateJobProgress(id, 10);

    // Get API endpoint and data from job
    const { apiEndpoint, mode, userId, timestamp, ...videoData } = job_data;

    // Determine which video processor to use
    let videoUrl;
    if (apiEndpoint === '/api/create-video/2000') {
      videoUrl = await process2000Video(id, videoData, tempDir);
    } else if (apiEndpoint === '/api/create-video/add-hook') {
      videoUrl = await processAddHookVideo(id, videoData, tempDir);
    } else if (apiEndpoint === '/api/create-video/tiktok-creative') {
      videoUrl = await processTikTokCreativeVideo(id, videoData, tempDir);
    } else {
      throw new Error(`Unsupported API endpoint: ${apiEndpoint}`);
    }

    await updateJobProgress(id, 90);

    // Update job as completed
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

    return videoUrl;

  } catch (error) {
    console.error(`❌ Job ${id} failed:`, error);

    // Cleanup on error
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

    throw error;
  }
}

// Process 2000-style video (simplified version)
async function process2000Video(jobId, data, tempDir) {
  console.log(`[2000] Processing video for job ${jobId}`);

  const ts = Date.now();
  const { videosBeforeRefrain = [], videosAfterRefrain = [], music, wordTimestamps = [], lyricsStyle = 'words' } = data;

  // Download videos
  const videoPaths = [];
  for (let i = 0; i < videosBeforeRefrain.length; i++) {
    const videoPath = path.join(tempDir, `video_${i}.mp4`);
    await downloadFile(videosBeforeRefrain[i].url, videoPath);
    videoPaths.push(videoPath);
  }

  // Download music
  let musicPath = null;
  if (music?.url) {
    musicPath = path.join(tempDir, 'music.mp3');
    await downloadFile(music.url, musicPath);
  }

  await updateJobProgress(jobId, 30);

  // Create video segments (simplified - 1.2s per segment)
  const chords = [0, 0.75, 2.00, 3.20, 4.40, 5.60, 6.80, 8.00, 9.20, 10.40, 11.60, 12.80, 14.00, 15.20];
  const segmentPaths = [];

  for (let i = 0; i < chords.length - 1; i++) {
    const duration = chords[i + 1] - chords[i];
    const videoPath = videoPaths[i % videoPaths.length];
    const segmentPath = path.join(tempDir, `seg_${i}.mp4`);

    await execAsync(`ffmpeg -stream_loop -1 -i "${videoPath}" -t ${duration} -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" -an -c:v libx264 -preset ultrafast -y "${segmentPath}"`);
    segmentPaths.push(segmentPath);
  }

  await updateJobProgress(jobId, 50);

  // Concatenate segments
  const concatList = segmentPaths.map(s => `file '${s}'`).join('\n');
  const concatFile = path.join(tempDir, 'concat.txt');
  await fs.writeFile(concatFile, concatList);

  const concatenatedPath = path.join(tempDir, 'concatenated.mp4');
  await execAsync(`ffmpeg -f concat -safe 0 -i "${concatFile}" -c copy -y "${concatenatedPath}"`);

  await updateJobProgress(jobId, 70);

  // Add music
  const outputPath = path.join(tempDir, `output_${ts}.mp4`);
  if (musicPath) {
    await execAsync(`ffmpeg -i "${concatenatedPath}" -i "${musicPath}" -shortest -c:v copy -c:a aac -y "${outputPath}"`);
  } else {
    await fs.copyFile(concatenatedPath, outputPath);
  }

  // Upload to Supabase storage
  const videoUrl = await uploadVideoToSupabase(outputPath, `2000_${ts}.mp4`);

  return videoUrl;
}

// Process add-hook video (simplified)
async function processAddHookVideo(jobId, data, tempDir) {
  console.log(`[AddHook] Processing video for job ${jobId}`);

  const ts = Date.now();
  const { images = [], videos = [], hookImages = [] } = data;

  const processedMedia = [];

  // Process first image/video as example
  if (images.length > 0) {
    const imagePath = path.join(tempDir, 'input.jpg');
    await downloadFile(images[0].url, imagePath);

    const hookPath = path.join(tempDir, 'hook.png');
    await downloadFile(hookImages[0], hookPath);

    const outputPath = path.join(tempDir, `output_${ts}.jpg`);
    await execAsync(`ffmpeg -i "${imagePath}" -i "${hookPath}" -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[bg];[bg][1:v]overlay=0:0" -y "${outputPath}"`);

    const url = await uploadVideoToSupabase(outputPath, `hooked_${ts}.jpg`);
    processedMedia.push({ url, type: 'image' });
  }

  await updateJobProgress(jobId, 50);

  return processedMedia[0]?.url || null;
}

// Process TikTok Creative video (simplified)
async function processTikTokCreativeVideo(jobId, data, tempDir) {
  console.log(`[TikTok] Processing video for job ${jobId}`);

  const ts = Date.now();
  const { images = [], videos = [], music, hooks = [], clipDuration = 0.6 } = data;

  // Download media
  const mediaPaths = [];
  for (let i = 0; i < Math.min(images.length, 10); i++) {
    const imgPath = path.join(tempDir, `img_${i}.jpg`);
    await downloadFile(images[i].url, imgPath);
    mediaPaths.push(imgPath);
  }

  await updateJobProgress(jobId, 30);

  // Create concat file
  const concatContent = mediaPaths.map(p => `file '${p}'\nduration ${clipDuration}\n`).join('');
  const concatFile = path.join(tempDir, 'concat.txt');
  await fs.writeFile(concatFile, concatContent);

  // Download music
  let musicPath = null;
  if (music?.url && music.id !== 'no-music') {
    musicPath = path.join(tempDir, 'music.mp3');
    await downloadFile(music.url, musicPath);
  }

  await updateJobProgress(jobId, 50);

  // Create video
  const outputPath = path.join(tempDir, `tiktok_${ts}.mp4`);
  const musicArgs = musicPath ? `-i "${musicPath}" -shortest -c:a aac` : '';
  await execAsync(`ffmpeg -f concat -safe 0 -i "${concatFile}" ${musicArgs} -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" -c:v libx264 -preset medium -crf 23 -r 30 -pix_fmt yuv420p -y "${outputPath}"`);

  await updateJobProgress(jobId, 70);

  // Upload
  const videoUrl = await uploadVideoToSupabase(outputPath, `tiktok_${ts}.mp4`);

  return videoUrl;
}

// Upload video to Supabase storage
async function uploadVideoToSupabase(filePath, filename) {
  try {
    const fileBuffer = await fs.readFile(filePath);

    const { data, error } = await supabase.storage
      .from('videos')
      .upload(`generated/${filename}`, fileBuffer, {
        contentType: filename.endsWith('.jpg') ? 'image/jpeg' : 'video/mp4',
        upsert: true
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('videos')
      .getPublicUrl(`generated/${filename}`);

    return publicUrl;
  } catch (error) {
    console.error('Upload to Supabase failed:', error);
    throw error;
  }
}

async function generateHookImage(hook, tempDir) {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });

  const fontSize = hook.style === 1 ? 60 : hook.style === 4 ? 50 : 75;

  const normalStyle = `
    font-size: 60px;
    line-height: 1.2;
    color: #fff;
    font-weight: normal;
    text-shadow: -2.8px -2.8px 0 #000, 2.8px -2.8px 0 #000, -2.8px 2.8px 0 #000, 2.8px 2.8px 0 #000;
    padding: 0.8rem 1.5rem 1rem 1.5rem;
  `;

  const backgroundWhiteStyle = `
    font-size: 65px;
    line-height: 1.2;
    background: #fff;
    padding: 0.1rem 1.5rem 0.75rem 1.5rem;
    color: #000;
  `;

  const backgroundBlackStyle = `
    font-size: 65px;
    line-height: 1.2;
    background: #000;
    padding: 0.1rem 1.5rem 0.75rem 1.5rem;
    color: #fff;
  `;

  const normalNewStyle = `
    font-size: 50px;
    line-height: 1.2;
    color: #fff;
    font-weight: normal;
    text-shadow: -2.8px -2.8px 0 #000, 2.8px -2.8px 0 #000, -2.8px 2.8px 0 #000, 2.8px 2.8px 0 #000;
    padding: 0.8rem 1.5rem 1rem 1.5rem;
  `;

  const styles = {
    1: normalStyle,
    2: backgroundWhiteStyle,
    3: backgroundBlackStyle,
    4: normalNewStyle
  };

  const selectedStyle = styles[hook.style] || normalStyle;

  const html = `
    <html>
      <head>
        <style>
          body {
            margin: 0;
            width: 1080px;
            height: 1920px;
            display: flex;
            align-items: ${hook.position === 'top' ? 'flex-start' : hook.position === 'middle' ? 'center' : 'flex-end'};
            justify-content: center;
            padding: ${hook.position === 'top' ? '250px' : hook.position === 'bottom' ? '600px' : '0px'} 0;
            background: transparent;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          h1 {
            width: 85%;
            text-align: center;
            margin: 0;
            padding: 0;
          }
          .hook-text {
            ${selectedStyle}
            display: inline-block;
            max-width: 80%;
            text-align: center;
            transform: translateY(${hook.offset || 0}px);
          }
        </style>
      </head>
      <body>
        <h1><div class="hook-text">${hook.text}</div></h1>
      </body>
    </html>
  `;

  await page.setContent(html);

  const hookImagePath = path.join(tempDir, 'hook.png');
  await page.screenshot({
    path: hookImagePath,
    omitBackground: true,
    type: 'png'
  });

  await browser.close();

  return hookImagePath;
}

// ===== JOB POLLING =====

let isProcessing = false;

async function pollForJobs() {
  if (isProcessing) {
    return;
  }

  try {
    isProcessing = true;

    // Get next job using the SQL function
    const { data, error } = await supabase.rpc('get_next_video_job');

    if (error) {
      console.error('Error fetching job:', error);
      return;
    }

    if (!data || data.length === 0) {
      return; // No jobs available
    }

    const job = data[0];
    await processVideoJob(job);

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
