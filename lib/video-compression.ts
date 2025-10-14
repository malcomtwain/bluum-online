import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

interface CompressionOptions {
  quality?: 'low' | 'medium' | 'high';
  maxWidth?: number;
  maxHeight?: number;
  format?: 'mp4' | 'webm';
  generateThumbnail?: boolean;
}

/**
 * Compresse une vidéo pour optimiser le chargement
 */
export async function compressVideo(
  inputPath: string,
  outputPath: string,
  options: CompressionOptions = {}
): Promise<{ videoPath: string; thumbnailPath?: string }> {
  const {
    quality = 'medium',
    maxWidth = 720,
    maxHeight = 1280,
    format = 'mp4',
    generateThumbnail = true
  } = options;

  // Paramètres FFmpeg selon la qualité
  const qualitySettings = {
    low: { crf: 30, preset: 'veryfast', bitrate: '500k' },
    medium: { crf: 23, preset: 'fast', bitrate: '1M' },
    high: { crf: 18, preset: 'medium', bitrate: '2M' }
  };

  const settings = qualitySettings[quality];
  const scale = `scale='min(${maxWidth},iw)':min'(${maxHeight},ih)':force_original_aspect_ratio=decrease`;

  try {
    // Commande FFmpeg pour compression
    const ffmpegCommand = `ffmpeg -i "${inputPath}" \
      -c:v libx264 \
      -preset ${settings.preset} \
      -crf ${settings.crf} \
      -maxrate ${settings.bitrate} \
      -bufsize ${settings.bitrate} \
      -vf "${scale}" \
      -movflags +faststart \
      -c:a aac -b:a 128k \
      -y "${outputPath}"`;

    console.log('🎬 Compressing video...');
    await execAsync(ffmpegCommand);
    console.log('✅ Video compressed successfully');

    let thumbnailPath: string | undefined;
    
    if (generateThumbnail) {
      // Générer thumbnail à 1 seconde
      thumbnailPath = outputPath.replace(/\.(mp4|webm)$/, '_thumb.jpg');
      const thumbCommand = `ffmpeg -i "${inputPath}" -ss 00:00:01 -vframes 1 -vf "${scale}" -y "${thumbnailPath}"`;
      
      console.log('📸 Generating thumbnail...');
      await execAsync(thumbCommand);
      console.log('✅ Thumbnail generated');
    }

    return { videoPath: outputPath, thumbnailPath };
  } catch (error) {
    console.error('Error compressing video:', error);
    throw error;
  }
}

/**
 * Génère plusieurs résolutions pour streaming adaptatif
 */
export async function generateAdaptiveVersions(
  inputPath: string,
  outputDir: string
): Promise<{ 
  resolutions: Array<{ width: number; height: number; path: string; bitrate: string }>;
  thumbnail: string;
}> {
  const resolutions = [
    { width: 360, height: 640, bitrate: '400k' },
    { width: 480, height: 854, bitrate: '800k' },
    { width: 720, height: 1280, bitrate: '1500k' }
  ];

  await fs.mkdir(outputDir, { recursive: true });

  const outputs = [];
  
  for (const res of resolutions) {
    const outputPath = path.join(outputDir, `${res.height}p.mp4`);
    const scale = `scale=${res.width}:${res.height}:force_original_aspect_ratio=increase,crop=${res.width}:${res.height}`;
    
    const command = `ffmpeg -i "${inputPath}" \
      -c:v libx264 -preset fast -crf 23 \
      -maxrate ${res.bitrate} -bufsize ${res.bitrate} \
      -vf "${scale}" \
      -movflags +faststart \
      -c:a aac -b:a 96k \
      -y "${outputPath}"`;
    
    await execAsync(command);
    outputs.push({ ...res, path: outputPath });
  }

  // Générer thumbnail
  const thumbnailPath = path.join(outputDir, 'thumbnail.jpg');
  await execAsync(`ffmpeg -i "${inputPath}" -ss 00:00:01 -vframes 1 -vf "scale=360:640" -y "${thumbnailPath}"`);

  return {
    resolutions: outputs,
    thumbnail: thumbnailPath
  };
}

/**
 * Optimise une vidéo pour le web (conversion en WebM)
 */
export async function convertToWebM(
  inputPath: string,
  outputPath: string,
  quality: 'low' | 'medium' | 'high' = 'medium'
): Promise<string> {
  const qualitySettings = {
    low: { crf: 40, bitrate: '500k' },
    medium: { crf: 30, bitrate: '1M' },
    high: { crf: 20, bitrate: '2M' }
  };

  const settings = qualitySettings[quality];

  const command = `ffmpeg -i "${inputPath}" \
    -c:v libvpx-vp9 \
    -crf ${settings.crf} \
    -b:v ${settings.bitrate} \
    -c:a libopus -b:a 128k \
    -y "${outputPath}"`;

  await execAsync(command);
  return outputPath;
}