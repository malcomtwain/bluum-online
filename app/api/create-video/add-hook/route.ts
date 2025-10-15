import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { uploadAndSaveGeneratedVideo } from '@/lib/upload-generated-media';
import { createClient } from '@supabase/supabase-js';
import { createCanvas, registerFont, GlobalFonts } from 'canvas';
import { drawHookText } from '@/lib/utils';

const execPromise = promisify(require('child_process').exec);

// Initialize Supabase client - only if credentials are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseAdmin = (supabaseUrl && supabaseServiceKey) ? createClient(supabaseUrl, supabaseServiceKey) : null;

// Register fonts for canvas (only once)
let fontsRegistered = false;
function registerFontsForCanvas() {
  if (!fontsRegistered) {
    try {
      const fontsDir = path.join(process.cwd(), 'public/fonts');

      // Register all TikTok fonts
      registerFont(path.join(fontsDir, 'TikTokDisplayMedium.otf'), { family: 'TikTok Display Medium' });
      registerFont(path.join(fontsDir, 'TikTokDisplayBold.otf'), { family: 'TikTok Display Bold' });
      registerFont(path.join(fontsDir, 'TikTokDisplayRegular.otf'), { family: 'TikTok Display Regular' });

      // Register other common fonts
      registerFont(path.join(fontsDir, 'proximanova-bold.otf'), { family: 'Proxima Nova Bold' });
      registerFont(path.join(fontsDir, 'proximanova-semibold.otf'), { family: 'Proxima Nova Semibold' });
      registerFont(path.join(fontsDir, 'TestSohne-Dreiviertelfett-BF663d89ccc5f66.otf'), { family: 'Test Söhne Dreiviertelfett' });
      registerFont(path.join(fontsDir, 'TestSohne-Halbfett-BF663d89cd2d67b.otf'), { family: 'Test Söhne Halbfett' });

      console.log('[Add Hook] Fonts registered successfully');
      fontsRegistered = true;
    } catch (error) {
      console.error('[Add Hook] Error registering fonts:', error);
    }
  }
}

// Function to generate transparent hook image using canvas
async function generateHookImage(
  hookText: string,
  style: number,
  position: 'top' | 'middle' | 'bottom',
  offset: number,
  fontName: string = 'TikTok Display Medium',
  fontSizeMultiplier: number = 1.0,
  outputPath: string
): Promise<void> {
  // Register fonts before drawing
  registerFontsForCanvas();

  // Create canvas with video dimensions
  const canvas = createCanvas(1080, 1920);
  const ctx = canvas.getContext('2d');

  // Clear canvas (transparent background)
  ctx.clearRect(0, 0, 1080, 1920);

  // Draw hook text using the same function as frontend
  // transparentBackground: false pour inclure les backgrounds (style 2, 3, etc.)
  drawHookText(ctx, hookText, {
    type: style,
    position: position,
    offset: offset
  }, 1080, 1920, fontName, fontSizeMultiplier, false);

  // Save as PNG with transparency
  const buffer = canvas.toBuffer('image/png');
  await fs.writeFile(outputPath, buffer);
  console.log(`[Add Hook] Generated hook image at ${outputPath}`);
}

export async function POST(request: NextRequest) {
  console.log('[Add Hook] Starting hook addition on individual media...');
  
  try {
    // Get the Authorization header to identify the user
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;
    
    if (supabaseAdmin && authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
      }
    }
    
    const data = await request.json();
    const {
      images,
      videos,
      hookImages, // Recevoir les images de hook générées par le frontend
      imageCount,
      videoCount
    } = data;

    console.log('[Add Hook] Request data:', {
      imagesCount: images?.length,
      videosCount: videos?.length,
      hookImagesCount: hookImages?.length,
      imageCount,
      videoCount
    });

    if ((!images || images.length === 0) && (!videos || videos.length === 0)) {
      return NextResponse.json(
        { error: 'At least 1 image or video is required' },
        { status: 400 }
      );
    }

    if (!hookImages || hookImages.length === 0) {
      return NextResponse.json(
        { error: 'At least 1 hook image is required' },
        { status: 400 }
      );
    }

    const processedMedia = [];
    const timestamp = Date.now();
    
    // Traiter les images si elles existent
    if (images && images.length > 0) {
      const imagesToProcess = imageCount && imageCount > 0 ? Math.min(imageCount, images.length) : images.length;
      console.log(`[Add Hook] Processing ${imagesToProcess} images out of ${images.length} available`);
      
      // Sélectionner les images à traiter (mélange aléatoire pour éviter de toujours prendre les mêmes)
      const shuffledImages = [...images].sort(() => Math.random() - 0.5);
      const selectedImages = shuffledImages.slice(0, imagesToProcess);
      
      // Traiter chaque image individuellement
      for (let imageIndex = 0; imageIndex < selectedImages.length; imageIndex++) {
      const image = selectedImages[imageIndex];
      console.log(`[Add Hook] Processing image ${imageIndex + 1}/${selectedImages.length}`);
      
      // Sélectionner une image de hook aléatoire
      const hookIndex = Math.floor(Math.random() * hookImages.length);
      const selectedHookImage = hookImages[hookIndex];

      if (!selectedHookImage) {
        console.log(`[Add Hook] Skipping image ${imageIndex + 1} - no valid hook image`);
        continue;
      }

      console.log(`[Add Hook] Adding hook image to image ${imageIndex + 1}`);

      // Créer un dossier temporaire pour cette image
      const tempDir = path.join(process.cwd(), 'public', 'generated-videos', `add_hook_${timestamp}_${imageIndex}`);
      await fs.mkdir(tempDir, { recursive: true });

      try {
        // Sauvegarder l'image
        const imageData = image.url.replace(/^data:image\/\w+;base64,/, '');
        const inputImagePath = path.join(tempDir, 'input.jpg');
        await fs.writeFile(inputImagePath, imageData, 'base64');

        // Sauvegarder l'image du hook (reçue du frontend)
        const hookImageData = selectedHookImage.replace(/^data:image\/\w+;base64,/, '');
        const hookImagePath = path.join(tempDir, 'hook_overlay.png');
        await fs.writeFile(hookImagePath, hookImageData, 'base64');

        // Nom de sortie
        const outputPath = path.join(
          process.cwd(),
          'public',
          'generated-videos',
          `hooked_image_${timestamp}_${imageIndex + 1}.jpg`
        );

        // Ajouter le hook sur l'image avec FFmpeg (overlay)
        await new Promise((resolve, reject) => {
          console.log(`[Add Hook] Processing image`);

          // Build filter chain: scale image then overlay hook
          const videoFilters = [
            'scale=1080:1920:force_original_aspect_ratio=decrease',
            'pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black'
          ].join(',');

          const ffmpegArgs = [
            '-i', inputImagePath,
            '-i', hookImagePath,
            '-filter_complex', `[0:v]${videoFilters}[bg];[bg][1:v]overlay=0:0`,
            '-y',
            outputPath
          ];
          
          console.log(`[Add Hook] FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`);
          const ffmpeg = spawn('ffmpeg', ffmpegArgs);
          
          ffmpeg.stdout.on('data', (data) => {
            console.log(`[FFmpeg stdout]: ${data.toString()}`);
          });
          
          ffmpeg.stderr.on('data', (data) => {
            const output = data.toString();
            console.log(`[FFmpeg stderr]: ${output}`);
            if (output.includes('Error') || output.includes('Invalid') || output.includes('failed')) {
              console.error(`[FFmpeg Error]: ${output}`);
            }
          });
          
          ffmpeg.on('close', (code) => {
            if (code === 0) {
              console.log(`[Add Hook] Image ${imageIndex + 1} processed successfully`);
              resolve(outputPath);
            } else {
              reject(new Error(`FFmpeg exited with code ${code}`));
            }
          });
          
          ffmpeg.on('error', (err) => {
            reject(err);
          });
        });
        
        // If user is authenticated, upload to Supabase
        let mediaUrl = `/generated-videos/${path.basename(outputPath)}`;
        let mediaId: string | undefined;
        
        if (userId) {
          try {
            const result = await uploadAndSaveGeneratedVideo(
              userId,
              outputPath,
              path.basename(outputPath),
              'add-hook',
              {
                originalImageIndex: imageIndex,
                hookText: selectedHook,
                style,
                position,
                offset
              }
            );
            
            if (result) {
              mediaUrl = result.url;
              mediaId = result.id;
              console.log(`[Add Hook] Image uploaded to Supabase: ${mediaId}`);
              
              // Delete the local file after successful upload
              await fs.unlink(outputPath).catch(() => {});
            }
          } catch (uploadError) {
            console.error('[Add Hook] Failed to upload to Supabase:', uploadError);
            // Continue with local URL if upload fails
          }
        }
        
        // Nettoyer le dossier temporaire
        await fs.rm(tempDir, { recursive: true, force: true });
        
        // Ajouter à la liste des médias traités
        processedMedia.push({ 
          url: mediaUrl,
          id: mediaId,
          originalIndex: imageIndex,
          hookText: selectedHook,
          type: 'image'
        });
        
      } catch (error) {
        // Nettoyer en cas d'erreur
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        console.error(`[Add Hook] Error processing image ${imageIndex + 1}:`, error);
        // Continuer avec les autres images même si une échoue
      }
    }
    }
    
    // Traiter les vidéos si elles existent
    if (videos && videos.length > 0) {
      const videosToProcess = videoCount && videoCount > 0 ? Math.min(videoCount, videos.length) : videos.length;
      console.log(`[Add Hook] Processing ${videosToProcess} videos out of ${videos.length} available`);
      
      // Sélectionner les vidéos à traiter (mélange aléatoire pour éviter de toujours prendre les mêmes)
      const shuffledVideos = [...videos].sort(() => Math.random() - 0.5);
      const selectedVideos = shuffledVideos.slice(0, videosToProcess);
      
      // Traiter chaque vidéo individuellement
      for (let videoIndex = 0; videoIndex < selectedVideos.length; videoIndex++) {
        const video = selectedVideos[videoIndex];
        console.log(`[Add Hook] Processing video ${videoIndex + 1}/${selectedVideos.length}`);
        
        // Sélectionner une image de hook aléatoire
        const hookIndex = Math.floor(Math.random() * hookImages.length);
        const selectedHookImage = hookImages[hookIndex];

        if (!selectedHookImage) {
          console.log(`[Add Hook] Skipping video ${videoIndex + 1} - no valid hook image`);
          continue;
        }

        console.log(`[Add Hook] Adding hook image to video ${videoIndex + 1}`);

        // Créer un dossier temporaire pour cette vidéo
        const tempDir = path.join(process.cwd(), 'public', 'generated-videos', `add_hook_video_${timestamp}_${videoIndex}`);
        await fs.mkdir(tempDir, { recursive: true });

        try {
          // Sauvegarder la vidéo
          let inputVideoPath: string;

          if (video.url.startsWith('data:')) {
            // Vidéo en base64
            const videoData = video.url.replace(/^data:video\/\w+;base64,/, '');
            inputVideoPath = path.join(tempDir, 'input.mp4');
            await fs.writeFile(inputVideoPath, videoData, 'base64');
          } else {
            // URL de vidéo - on peut la télécharger ou utiliser directement
            inputVideoPath = video.url;
          }

          // Sauvegarder l'image du hook (reçue du frontend)
          const hookImageData = selectedHookImage.replace(/^data:image\/\w+;base64,/, '');
          const hookImagePath = path.join(tempDir, 'hook_overlay.png');
          await fs.writeFile(hookImagePath, hookImageData, 'base64');

          // Nom de sortie
          const outputPath = path.join(
            process.cwd(),
            'public',
            'generated-videos',
            `hooked_video_${timestamp}_${videoIndex + 1}.mp4`
          );

          // Ajouter le hook sur la vidéo avec FFmpeg (overlay)
          await new Promise((resolve, reject) => {
            console.log(`[Add Hook] Processing video`);

            // Build filter chain: scale video then overlay hook
            const videoFilters = [
              'scale=1080:1920:force_original_aspect_ratio=decrease',
              'pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black'
            ].join(',');

            const ffmpegArgs = [
              '-i', inputVideoPath,
              '-i', hookImagePath,
              '-filter_complex', `[0:v]${videoFilters}[bg];[bg][1:v]overlay=0:0`,
              '-c:a', 'copy', // Copy audio without re-encoding
              '-y',
              outputPath
            ];
            
            console.log(`[Add Hook] FFmpeg command for video: ffmpeg ${ffmpegArgs.join(' ')}`);
            const ffmpeg = spawn('ffmpeg', ffmpegArgs);
            
            ffmpeg.stdout.on('data', (data) => {
              console.log(`[FFmpeg stdout]: ${data.toString()}`);
            });
            
            ffmpeg.stderr.on('data', (data) => {
              const output = data.toString();
              console.log(`[FFmpeg stderr]: ${output}`);
              if (output.includes('Error') || output.includes('Invalid') || output.includes('failed')) {
                console.error(`[FFmpeg Error]: ${output}`);
              }
            });
            
            ffmpeg.on('close', (code) => {
              if (code === 0) {
                console.log(`[Add Hook] Video ${videoIndex + 1} processed successfully`);
                resolve(outputPath);
              } else {
                reject(new Error(`FFmpeg exited with code ${code}`));
              }
            });
            
            ffmpeg.on('error', (err) => {
              reject(err);
            });
          });
          
          // If user is authenticated, upload to Supabase
          let mediaUrl = `/generated-videos/${path.basename(outputPath)}`;
          let mediaId: string | undefined;
          
          if (userId) {
            try {
              const result = await uploadAndSaveGeneratedVideo(
                userId,
                outputPath,
                path.basename(outputPath),
                'add-hook',
                {
                  originalVideoIndex: videoIndex,
                  hookText: selectedHook,
                  style,
                  position,
                  offset
                }
              );
              
              if (result) {
                mediaUrl = result.url;
                mediaId = result.id;
                console.log(`[Add Hook] Video uploaded to Supabase: ${mediaId}`);
                
                // Delete the local file after successful upload
                await fs.unlink(outputPath).catch(() => {});
              }
            } catch (uploadError) {
              console.error('[Add Hook] Failed to upload video to Supabase:', uploadError);
              // Continue with local URL if upload fails
            }
          }
          
          // Nettoyer le dossier temporaire
          await fs.rm(tempDir, { recursive: true, force: true });
          
          // Ajouter à la liste des médias traités
          processedMedia.push({ 
            url: mediaUrl,
            id: mediaId,
            originalIndex: videoIndex,
            hookText: selectedHook,
            type: 'video'
          });
          
        } catch (error) {
          // Nettoyer en cas d'erreur
          await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
          console.error(`[Add Hook] Error processing video ${videoIndex + 1}:`, error);
          // Continuer avec les autres vidéos même si une échoue
        }
      }
    }
    
    // Calculer les statistiques
    const totalProcessed = processedMedia.length;
    const imageProcessed = processedMedia.filter(m => m.type === 'image').length;
    const videoProcessed = processedMedia.filter(m => m.type === 'video').length;
    const totalRequested = (images?.length || 0) + (videos?.length || 0);
    
    return NextResponse.json({
      success: true,
      media: processedMedia,
      message: `Added hooks to ${totalProcessed} media (${imageProcessed} images, ${videoProcessed} videos)`,
      stats: {
        totalProcessed,
        imageProcessed,
        videoProcessed,
        totalRequested,
        totalAvailable: {
          images: images?.length || 0,
          videos: videos?.length || 0
        },
        timestamp: timestamp
      }
    });
    
  } catch (error) {
    console.error('[Add Hook] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to add hooks to media',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}