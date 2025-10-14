// Server-side only imports
// Version modifiée pour être compatible avec l'export statique
let ffmpeg: any;
let ffmpegPath: string;
let ffprobePath: string;

// Vérifier si nous sommes en environnement serveur
const isServer = typeof window === 'undefined';

// Import notre helper FFmpeg robuste
const ffmpegHelper = isServer ? (() => {
  try {
    return require('../utils/ffmpeg-helper');
  } catch (e) {
    console.warn('Impossible de charger ffmpeg-helper pendant le build statique');
    return null;
  }
})() : null;

// Vérifier si nous sommes dans l'environnement Netlify
const isNetlify = typeof process !== 'undefined' && 
                (process.env.NETLIFY === 'true' || 
                 process.env.NEXT_PUBLIC_NETLIFY_DEPLOYMENT === 'true');

// Vérifier si nous sommes côté client
const isClient = typeof window !== 'undefined';

// Vérifier si nous sommes sur Netlify côté client
const isNetlifyClient = isClient && isNetlify;

// Only import FFmpeg-related modules on the server side
if (isServer) {
  try {
    // Utiliser notre helper pour obtenir une instance de FFmpeg robuste
    ffmpeg = ffmpegHelper?.ffmpeg;
    
    // Get paths from environment variables or fallback to installed paths
    ffmpegPath = process.env.FFMPEG_PATH || '';
    ffprobePath = process.env.FFPROBE_PATH || '';
    
    // Verify paths are set
    if (!ffmpegPath || !ffprobePath) {
      console.warn('FFmpeg or FFprobe paths are not set, using defaults from installer packages');
    }

    // Log success without testing execution
    console.log('FFmpeg initialized with helper');

    // Skipping the execution test on Vercel
    // This prevents the error during build time while still allowing runtime functionality
  } catch (error: any) {
    console.error('Error loading FFmpeg modules:', error);
    // Instead of throwing, we log the error but continue
    // This allows the build to complete and will only fail at runtime if FFmpeg is actually used
    console.warn(`FFmpeg initialization warning: ${error.message}`);
  }
} else {
  // Stub implementations for client-side
  ffmpeg = null;
  ffmpegPath = '';
  ffprobePath = '';
}

// Import the shared hook text drawing function
import { drawHookText } from './utils';

export interface VideoGenerationOptions {
  template: {
    url: string;
    duration: number;
    position: 'top' | 'center' | 'bottom';
  };
  video: {
    path: string;
    duration: number;
  };
  music: {
    url: string;
  };
  hook: {
    text: string;
    style: {
      type: number;
      position: 'top' | 'middle' | 'bottom';
      offset: number;
    };
  };
  progress?: (progress: number) => void;
}

// Fonction pour rediriger vers la fonction Netlify lorsque dans l'environnement Netlify
async function processVideoOnNetlify(options: any): Promise<any> {
  console.log("Traitement vidéo sur Netlify...");
  
  try {
    const response = await fetch('/.netlify/functions/video-processing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: 'generateVideo',
        options: options
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erreur lors de l'appel à la fonction Netlify:", errorText);
      throw new Error(`Erreur lors de l'appel à la fonction Netlify: ${errorText || response.statusText}`);
    }
    
    const result = await response.json();
    console.log("Résultat de la fonction Netlify:", result);
    return result;
  } catch (error) {
    console.error("Erreur lors du traitement vidéo sur Netlify:", error);
    throw error;
  }
}

// Fonction pour le traitement local (développement)
async function processVideoLocally(options: any): Promise<any> {
  console.log("Traitement vidéo en local...");
  
  try {
    const response = await fetch('/api/create-video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erreur lors de l'appel à l'API locale:", errorText);
      throw new Error(`Erreur lors de l'appel à l'API locale: ${errorText || response.statusText}`);
    }
    
    const result = await response.json();
    console.log("Résultat de l'API locale:", result);
    return result;
  } catch (error) {
    console.error("Erreur lors du traitement vidéo en local:", error);
    throw error;
  }
}

export async function generateVideo(
  options: VideoGenerationOptions,
  outputPath: string
): Promise<string> {
  // Vérifier si nous sommes dans l'environnement Netlify côté serveur
  if (isServer && isNetlify) {
    console.log("Utilisation du traitement Netlify côté serveur");
    try {
      const result = await processVideoOnNetlify(options);
      return result.videoPath || outputPath;
    } catch (error) {
      console.error("Erreur lors du traitement vidéo sur Netlify:", error);
      throw error;
    }
  }

  // Ensure this function only runs on the server
  if (typeof window !== 'undefined') {
    throw new Error('generateVideo can only be called from the server side');
  }

  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const path = require('path');
    const fs = require('fs/promises');
    const os = require('os');
    const execAsync = promisify(exec);

    // Update progress to 10%
    if (options.progress) options.progress(10);

    // Create temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'temp');
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (error) {
      console.error('Error creating temp directory:', error);
      throw error;
    }

    // Update progress to 20%
    if (options.progress) options.progress(20);

    // Download template and music with error handling
    let templatePath: string;
    let musicPath: string;

    try {
      // Download template
      const templateResponse = await fetch(options.template.url);
      if (!templateResponse.ok) {
        throw new Error(`Failed to fetch template: ${templateResponse.statusText}`);
      }
      const templateBuffer = await templateResponse.arrayBuffer();
      templatePath = path.join(tempDir, `template-${Date.now()}.mp4`);
      await fs.writeFile(templatePath, Buffer.from(templateBuffer));

      // Update progress to 40%
      if (options.progress) options.progress(40);

      // Download music
      const musicResponse = await fetch(options.music.url);
      if (!musicResponse.ok) {
        throw new Error(`Failed to fetch music: ${musicResponse.statusText}`);
      }
      const musicBuffer = await musicResponse.arrayBuffer();
      musicPath = path.join(tempDir, `music-${Date.now()}.mp3`);
      await fs.writeFile(musicPath, Buffer.from(musicBuffer));

      // Update progress to 50%
      if (options.progress) options.progress(50);
    } catch (error: any) {
      console.error('Error downloading media files:', error);
      throw new Error(`Failed to download media files: ${error.message}`);
    }

    // Create a temporary directory for FFmpeg processing
    const ffmpegTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ffmpeg-'));
    console.log('Created temporary directory:', ffmpegTempDir);
    
    // Update progress to 60%
    if (options.progress) options.progress(60);

    // Copy files to temporary directory with simple names
    const simpleTemplatePath = path.join(ffmpegTempDir, 'template.mp4');
    const simpleVideoPath = path.join(ffmpegTempDir, 'video.mp4');
    const simpleMusicPath = path.join(ffmpegTempDir, 'music.mp3');
    const simpleOutputPath = path.join(ffmpegTempDir, 'output.mp4');

    // Copy files to temporary directory including font
    const tempFontPath = path.join(ffmpegTempDir, 'font.otf');
    await Promise.all([
      fs.copyFile(templatePath, simpleTemplatePath),
      fs.copyFile(options.video.path, simpleVideoPath),
      fs.copyFile(musicPath, simpleMusicPath),
      fs.copyFile(path.join(process.cwd(), 'fonts/TikTokDisplayMedium.otf'), tempFontPath)
    ]);

    // Update progress to 70%
    if (options.progress) options.progress(70);

    // Create hook overlay from Canvas (same as preview)
    let overlayFilter = '';
    if (options.hook.text.trim()) {
      // Register custom fonts
      const { createCanvas, registerFont } = require('canvas');
      registerFont(path.join(process.cwd(), 'fonts/TikTokDisplayMedium.otf'), {
        family: 'TikTok Display Medium'
      });

      // Create canvas for text overlay (same size as video)
      const canvas = createCanvas(1080, 1920);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw hook text using shared function (EXACTLY like preview)
      const { drawHookText } = require('./utils');
      drawHookText(ctx, options.hook.text, options.hook.style);

      // Save text overlay
      const textOverlayPath = path.join(ffmpegTempDir, 'text_overlay.png');
      const textOverlayBuffer = canvas.toBuffer('image/png');
      await fs.writeFile(textOverlayPath, textOverlayBuffer);
      
      overlayFilter = `,overlay=0:0:format=auto`;
    }
    
    // Step 1: Generate the video with overlay
    const baseCommand = `ffmpeg -i "${simpleTemplatePath}" -i "${simpleVideoPath}" -i "${simpleMusicPath}" ${options.hook.text.trim() ? `-i "${path.join(ffmpegTempDir, 'text_overlay.png')}"` : ''} \\
      -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=PTS-STARTPTS[scaled_template];[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=PTS-STARTPTS+${options.template.duration}/TB[scaled_video];[scaled_template][scaled_video]concat=n=2:v=1[video_base]${options.hook.text.trim() ? ';[video_base][3:v]overlay=0:0:format=auto[final]' : ''}" \\
      -map "[${options.hook.text.trim() ? 'final' : 'video_base'}]" -map 2:a \\
      -c:v libx264 -c:a aac \\
      -t ${options.template.duration + options.video.duration} \\
      "${simpleOutputPath}"`;

    try {
      console.log('Executing FFmpeg command:', baseCommand);
      await execAsync(baseCommand);
      console.log('Video generated successfully with text overlay');

      // Copy final output to destination
      await fs.copyFile(simpleOutputPath, outputPath);

      // Update progress to 90%
      if (options.progress) options.progress(90);

      // Clean up temporary files
      const filesToDelete = [
        simpleTemplatePath,
        simpleVideoPath,
        simpleMusicPath,
        simpleOutputPath,
        tempFontPath
      ];
      
      if (options.hook.text.trim()) {
        filesToDelete.push(path.join(ffmpegTempDir, 'text_overlay.png'));
      }
      
      await Promise.all(
        filesToDelete.map(file => fs.unlink(file))
      ).catch(console.error);

      // Update progress to 100%
      if (options.progress) options.progress(100);

      return outputPath;
    } catch (error) {
      console.error('Error in video generation:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in generateVideo:', error);
    throw error;
  }
}

// Fonction principale pour la génération de vidéo
export async function generateVideoWithFFmpeg(
  optionsOrConfig: VideoGenerationOptions | {
    templateImage: string;
    mediaFile: string;
    musicFile?: string;
    hookText?: string;
    hookStyle?: {
      type: number;
      position: 'top' | 'middle' | 'bottom';
      offset: number;
    };
  }
): Promise<Blob> {
  // Vérifier si nous sommes dans l'environnement Netlify
  if (isNetlifyClient || (isServer && isNetlify)) {
    console.log("Environnement Netlify détecté, utilisation du traitement Netlify");
    try {
      const result = await processVideoOnNetlify(optionsOrConfig);
      
      // Si nous sommes côté client, récupérer la vidéo à partir de l'URL
      if (isClient && result.videoPath) {
        const response = await fetch(result.videoPath);
        return await response.blob();
      }
      
      // Si nous sommes côté serveur, retourner un stub Blob
      // (cela ne devrait pas se produire en pratique)
      return new Blob([], { type: 'video/mp4' });
    } catch (error: any) {
      console.error('Error processing video on Netlify:', error);
      throw error;
    }
  }
  
  // Si nous ne sommes pas sur Netlify, utiliser le traitement local
  console.log("Utilisation du traitement local");
  try {
    const result = await processVideoLocally(optionsOrConfig);
    
    // Si nous sommes côté client, récupérer la vidéo à partir de l'URL
    if (isClient && result.videoPath) {
      const response = await fetch(result.videoPath);
      return await response.blob();
    }
    
    // Si nous sommes côté serveur, retourner un stub Blob
    // (cela ne devrait pas se produire en pratique)
    return new Blob([], { type: 'video/mp4' });
  } catch (error: any) {
    console.error('Error processing video locally:', error);
    throw error;
  }
}

// De même pour generateImageWithHook
export async function generateImageWithHook(
  imagePath: string,
  hookText: string,
  hookStyle: {
    type: number;
    position: 'top' | 'middle' | 'bottom';
    offset: number;
  }
): Promise<Blob> {
  // Vérifier si nous sommes dans l'environnement Netlify
  if (isNetlifyClient || (isServer && isNetlify)) {
    console.log("Environnement Netlify détecté, utilisation du traitement Netlify pour l'image");
    try {
      const result = await fetch('/.netlify/functions/video-processing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'generateHookPreview',
          options: {
            imagePath,
            hookText,
            hookStyle
          }
        }),
      });
      
      if (!result.ok) {
        throw new Error(`Erreur lors de l'appel à la fonction Netlify: ${result.statusText}`);
      }
      
      return await result.blob();
    } catch (error: any) {
      console.error('Error generating hook image on Netlify:', error);
      throw error;
    }
  }
  
  // Si nous ne sommes pas sur Netlify, utiliser la méthode classique
  // Logique existante pour la génération d'image...
  
  // Placeholder pour le moment (à adapter avec le code existant)
  return new Blob([], { type: 'image/png' });
}

function generateSubtitleFile(
  text: string,
  styleType: number,
  position: 'top' | 'middle' | 'bottom',
  offset: number,
  duration: number
): string {
  const verticalPosition = position === 'top' ? 10 : position === 'middle' ? 50 : 90;
  const adjustedPosition = verticalPosition + offset;

  // Style 1: Texte blanc avec ombre
  const style1 = {
    fontname: 'Proxima Nova',
    fontsize: 72, // Augmenté pour correspondre à text-2xl
    primaryColour: '&HFFFFFF', // Blanc
    secondaryColour: '&H000000',
    outlineColour: '&H000000',
    backColour: '&H000000',
    bold: -1,
    italic: 0,
    borderStyle: 1,
    outline: 2, // Réduit pour correspondre à l'ombre
    shadow: 2, // Ajout d'une ombre
    alignment: 2,
    marginL: 10,
    marginR: 10,
    marginV: adjustedPosition,
    encoding: 1,
    spacing: 0.001 // Ajout du letter-spacing
  };

  // Style 2: Texte noir sur fond blanc
  const style2 = {
    fontname: 'Proxima Nova',
    fontsize: 72, // Augmenté pour correspondre à text-2xl
    primaryColour: '&H000000', // Noir
    secondaryColour: '&HFFFFFF',
    outlineColour: '&HFFFFFF',
    backColour: '&HFFFFFF', // Fond blanc
    bold: 1, // Gras pour correspondre à fontWeight: 600
    italic: 0,
    borderStyle: 1,
    outline: 0,
    shadow: 2,
    alignment: 2,
    marginL: 10,
    marginR: 10,
    marginV: adjustedPosition,
    encoding: 1,
    spacing: 0.001 // Ajout du letter-spacing
  };

  const style = styleType === 1 ? style1 : style2;

  return `[Script Info]
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontname},${style.fontsize},${style.primaryColour},${style.secondaryColour},${style.outlineColour},${style.backColour},${style.bold},${style.italic},${style.borderStyle},${style.outline},${style.shadow},${style.alignment},${style.marginL},${style.marginR},${style.marginV},${style.encoding}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:${duration.toString().padStart(2, '0')}:00.00,Default,,0,0,0,,${text}`;
}

export async function cleanupTempFiles(files: string[]) {
  if (typeof window !== 'undefined') {
    throw new Error('cleanupTempFiles can only be called from the server side');
  }

  const fs = require('fs/promises');
  await Promise.all(
    files.map(async (file) => {
      try {
        await fs.unlink(file);
      } catch (error) {
        console.error(`Error deleting temporary file ${file}:`, error);
      }
    })
  );
}

