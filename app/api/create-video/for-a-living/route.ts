import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

async function getDurationSeconds(filePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    const ff = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath]);
    let out = '';
    ff.stdout.on('data', (d) => (out += d.toString()));
    ff.on('close', () => {
      const secs = parseFloat((out || '').trim());
      if (Number.isFinite(secs)) resolve(secs);
      else resolve(null);
    });
    ff.on('error', () => resolve(null));
  });
}

// Fonction pour obtenir le chemin de la font sélectionnée
function getFontPath(selectedFont: string): string {
  const fontMap: { [key: string]: string } = {
    'all': '/fonts/TikTokDisplayMedium.otf',
    'tiktok': '/fonts/TikTokDisplayMedium.otf',
    'elgraine': '/fonts/new-fonts/Elgraine-LightItalic.otf',
    'garamond': '/fonts/new-fonts/Garamond Premier Pro Light Display.otf',
    'gazpacho': '/fonts/new-fonts/Gazpacho-Heavy.otf',
    'kaufmann': '/fonts/new-fonts/Kaufmann Bold.otf',
    'pepi': '/fonts/new-fonts/PepiTRIAL-Bold-BF676cc171e9076.otf',
    'rudi': '/fonts/new-fonts/RudiTRIAL-Bold-BF676cc17237a19.otf',
    'silk': '/fonts/new-fonts/Silk Serif SemiBold.otf',
    'routine': '/fonts/new-fonts/Thursday Routine.ttf'
  };

  return fontMap[selectedFont] || fontMap['tiktok'];
}

// Fonction pour sélectionner une font aléatoire parmi les fonts sélectionnées
function getRandomSelectedFontPath(selectedFonts: string[], seed: number): string {
  if (selectedFonts.length === 0) {
    return '/fonts/TikTokDisplayMedium.otf';
  }

  if (selectedFonts.length === 1) {
    return getFontPath(selectedFonts[0]);
  }

  const randomIndex = Math.floor(Math.abs(Math.sin(seed * 0.00789) * 10000) % selectedFonts.length);
  return getFontPath(selectedFonts[randomIndex]);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const videos: any[] = body?.videos || [];
    const hooks: string[] = body?.hooks || [];
    const style: number = body?.style ?? 1;
    const positionInput: 'top' | 'middle' | 'bottom' = body?.position || 'middle';
    const offset: number = body?.offset ?? 0;
    const songUrl: string = body?.song || '';
    const selectedFonts: string[] = body?.selectedFonts || ['tiktok'];

    if (!songUrl) {
      return NextResponse.json({ error: 'Missing song URL' }, { status: 400 });
    }

    if (videos.length < 6) {
      return NextResponse.json({ error: 'For a living template requires at least 6 videos/images' }, { status: 400 });
    }

    const tempDir = path.join(process.cwd(), 'temp');
    const tempOutputDir = path.join(process.cwd(), 'public', 'temp-videos');
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(tempOutputDir, { recursive: true });

    const timestamp = Date.now();
    const outputFileName = `video_${timestamp}.mp4`;
    const outputPath = path.join(tempOutputDir, outputFileName);

    // Download song
    const songPath = path.join(tempDir, `song_${timestamp}.mp3`);
    const songResponse = await fetch(songUrl);
    const songBuffer = await songResponse.arrayBuffer();
    await fs.writeFile(songPath, Buffer.from(songBuffer));

    const songDuration = await getDurationSeconds(songPath);
    if (!songDuration) {
      return NextResponse.json({ error: 'Could not get song duration' }, { status: 500 });
    }

    // Process first 5 videos/images for the montage
    const first5Paths: string[] = [];
    for (let i = 0; i < 5; i++) {
      const video = videos[i];
      const videoPath = path.join(tempDir, `input_${i}_${timestamp}.mp4`);

      if (video.url.startsWith('http')) {
        const response = await fetch(video.url);
        const buffer = await response.arrayBuffer();
        await fs.writeFile(videoPath, Buffer.from(buffer));
      } else {
        const localPath = path.join(process.cwd(), 'public', video.url);
        await fs.copyFile(localPath, videoPath);
      }

      // Scale to 1080x1920 for montage preparation
      const scaledPath = path.join(tempDir, `scaled_${i}_${timestamp}.mp4`);
      await new Promise((resolve, reject) => {
        const ff = spawn('ffmpeg', [
          '-i', videoPath,
          '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-r', '30',
          '-an',
          scaledPath
        ]);
        ff.on('close', (code) => code === 0 ? resolve(null) : reject(new Error(`FFmpeg failed with code ${code}`)));
        ff.on('error', reject);
      });

      first5Paths.push(scaledPath);
    }

    // Create montage segment with 5 images in grid (2x2 + 1 centered on top or bottom)
    // Layout: Top row: 2 images, Middle row: 1 centered image, Bottom row: 2 images
    const montagePath = path.join(tempDir, `montage_${timestamp}.mp4`);
    const montageDuration = 3; // Duration for montage segment

    // Create a complex filter that displays all 5 images simultaneously in a grid
    // Each image is 540x640 (half width, 1/3 height)
    const montageFilter = `
      [0:v]scale=540:640,setsar=1[v0];
      [1:v]scale=540:640,setsar=1[v1];
      [2:v]scale=540:640,setsar=1[v2];
      [3:v]scale=540:640,setsar=1[v3];
      [4:v]scale=540:640,setsar=1[v4];
      color=black:1080x1920:d=${montageDuration}[bg];
      [bg][v0]overlay=0:0[tmp1];
      [tmp1][v1]overlay=540:0[tmp2];
      [tmp2][v2]overlay=270:640[tmp3];
      [tmp3][v3]overlay=0:1280[tmp4];
      [tmp4][v4]overlay=540:1280[out]
    `.replace(/\n/g, '');

    await new Promise((resolve, reject) => {
      const args = [];
      first5Paths.forEach(p => {
        args.push('-i', p);
      });
      args.push(
        '-filter_complex', montageFilter,
        '-map', '[out]',
        '-t', montageDuration.toString(),
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-r', '30',
        montagePath
      );

      const ff = spawn('ffmpeg', args);
      ff.on('close', (code) => code === 0 ? resolve(null) : reject(new Error(`FFmpeg montage failed with code ${code}`)));
      ff.on('error', reject);
    });

    // Process remaining videos (from index 5 onwards) in fullscreen
    const remainingPaths: string[] = [];
    const totalRemainingDuration = songDuration - montageDuration;
    const durationPerVideo = totalRemainingDuration / (videos.length - 5);

    for (let i = 5; i < videos.length; i++) {
      const video = videos[i];
      const videoPath = path.join(tempDir, `input_${i}_${timestamp}.mp4`);

      if (video.url.startsWith('http')) {
        const response = await fetch(video.url);
        const buffer = await response.arrayBuffer();
        await fs.writeFile(videoPath, Buffer.from(buffer));
      } else {
        const localPath = path.join(process.cwd(), 'public', video.url);
        await fs.copyFile(localPath, videoPath);
      }

      // Scale to fullscreen 1080x1920
      const scaledPath = path.join(tempDir, `fullscreen_${i}_${timestamp}.mp4`);
      await new Promise((resolve, reject) => {
        const ff = spawn('ffmpeg', [
          '-i', videoPath,
          '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
          '-t', durationPerVideo.toString(),
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-r', '30',
          '-an',
          scaledPath
        ]);
        ff.on('close', (code) => code === 0 ? resolve(null) : reject(new Error(`FFmpeg failed with code ${code}`)));
        ff.on('error', reject);
      });

      remainingPaths.push(scaledPath);
    }

    // Concatenate montage + remaining fullscreen videos
    const concatListPath = path.join(tempDir, `concat_${timestamp}.txt`);
    const concatContent = [montagePath, ...remainingPaths]
      .map(p => `file '${p}'`)
      .join('\n');
    await fs.writeFile(concatListPath, concatContent);

    const videoNoAudioPath = path.join(tempDir, `video_no_audio_${timestamp}.mp4`);
    await new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', [
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListPath,
        '-c', 'copy',
        videoNoAudioPath
      ]);
      ff.on('close', (code) => code === 0 ? resolve(null) : reject(new Error(`FFmpeg concat failed with code ${code}`)));
      ff.on('error', reject);
    });

    // Add audio
    await new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', [
        '-i', videoNoAudioPath,
        '-i', songPath,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-shortest',
        outputPath
      ]);
      ff.on('close', (code) => code === 0 ? resolve(null) : reject(new Error(`FFmpeg audio merge failed with code ${code}`)));
      ff.on('error', reject);
    });

    // Add hook if provided
    if (hooks.length > 0 && hooks[0]) {
      const hookText = hooks[0];
      const fontRelativePath = getRandomSelectedFontPath(selectedFonts, timestamp);
      const fontPath = path.join(process.cwd(), 'public' + fontRelativePath);

      // Calculate position
      let startY = 902; // middle by default
      if (positionInput === 'top') {
        startY = 230;
      } else if (positionInput === 'bottom') {
        startY = 1382;
      }
      startY += offset * 8;

      // Define style
      let fontColor = 'white';
      let borderColor = 'black';
      let borderWidth = 3;
      let fontSize = 65;

      if (style === 1) {
        fontColor = 'white';
        borderColor = 'black';
        borderWidth = 3;
        fontSize = 50;
      } else if (style === 2) {
        fontColor = 'black';
        borderColor = 'white';
        borderWidth = 8;
        fontSize = 65;
      } else if (style === 3) {
        fontColor = 'white';
        borderColor = 'black';
        borderWidth = 8;
        fontSize = 65;
      } else if (style === 4) {
        fontColor = 'white';
        borderColor = 'transparent';
        borderWidth = 0;
        fontSize = 50;
      }

      const escapedText = hookText.replace(/'/g, "\\'").replace(/:/g, "\\:");
      let drawtextCommand = `drawtext=text='${escapedText}':fontfile='${fontPath}':fontsize=${fontSize}:fontcolor=${fontColor}:x=(w-text_w)/2:y=${startY}`;

      if (borderWidth > 0) {
        drawtextCommand += `:borderw=${borderWidth}:bordercolor=${borderColor}`;
      }

      const videoWithHookPath = path.join(tempDir, `video_with_hook_${timestamp}.mp4`);
      await new Promise((resolve, reject) => {
        const ff = spawn('ffmpeg', [
          '-i', outputPath,
          '-vf', drawtextCommand,
          '-c:v', 'libx264',
          '-c:a', 'copy',
          videoWithHookPath
        ]);
        ff.on('close', (code) => code === 0 ? resolve(null) : reject(new Error(`FFmpeg hook overlay failed with code ${code}`)));
        ff.on('error', reject);
      });

      // Replace output with hooked version
      await fs.rename(videoWithHookPath, outputPath);
    }

    const expirationTime = Date.now() + 15 * 60 * 1000;
    try {
      const metaFilePath = path.join(tempOutputDir, `${outputFileName}.meta.json`);
      await fs.writeFile(metaFilePath, JSON.stringify({ expires: expirationTime, created: Date.now() }));
    } catch {}

    return NextResponse.json({
      success: true,
      videoPath: `/temp-videos/${outputFileName}`,
      expiresAt: expirationTime
    });

  } catch (error) {
    console.error('For-a-living route error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
