import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { uploadAndSaveGeneratedVideo } from '@/lib/upload-generated-media';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseAdmin = (supabaseUrl && supabaseServiceKey) ? createClient(supabaseUrl, supabaseServiceKey) : null;

export async function POST(request: NextRequest) {
  console.log('[Add Hook Template] Starting template-based video generation...');
  
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
      templateImageUrl, // URL de l'image avec hook générée précédemment
      videos, 
      imageCount = 1,
      videoCount = 1 
    } = data;
    
    console.log('[Add Hook Template] Request data:', {
      templateImageUrl,
      videosCount: videos?.length,
      imageCount,
      videoCount
    });
    
    if (!templateImageUrl) {
      return NextResponse.json(
        { error: 'Template image URL is required' },
        { status: 400 }
      );
    }

    if (!videos || videos.length === 0) {
      return NextResponse.json(
        { error: 'At least 1 video is required' },
        { status: 400 }
      );
    }

    const processedVideos = [];
    const timestamp = Date.now();
    
    // Traiter les vidéos avec le template
    const videosToProcess = videoCount && videoCount > 0 ? Math.min(videoCount, videos.length) : videos.length;
    console.log(`[Add Hook Template] Processing ${videosToProcess} videos out of ${videos.length} available`);
    
    // Sélectionner les vidéos à traiter (mélange aléatoire)
    const shuffledVideos = [...videos].sort(() => Math.random() - 0.5);
    const selectedVideos = shuffledVideos.slice(0, videosToProcess);
    
    for (let videoIndex = 0; videoIndex < selectedVideos.length; videoIndex++) {
      const video = selectedVideos[videoIndex];
      console.log(`[Add Hook Template] Processing video ${videoIndex + 1}/${selectedVideos.length}`);
      
      // Créer un dossier temporaire pour cette vidéo
      const tempDir = path.join(process.cwd(), 'public', 'generated-videos', `add_hook_template_${timestamp}_${videoIndex}`);
      await fs.mkdir(tempDir, { recursive: true });
      
      try {
        // Télécharger le template
        const templateResponse = await fetch(templateImageUrl);
        const templateBuffer = await templateResponse.arrayBuffer();
        const templatePath = path.join(tempDir, 'template.jpg');
        await fs.writeFile(templatePath, Buffer.from(templateBuffer));
        
        // Sauvegarder la vidéo
        let inputVideoPath: string;
        
        if (video.url.startsWith('data:')) {
          // Vidéo en base64
          const videoData = video.url.replace(/^data:video\/\w+;base64,/, '');
          inputVideoPath = path.join(tempDir, 'input.mp4');
          await fs.writeFile(inputVideoPath, videoData, 'base64');
        } else {
          // URL de vidéo
          inputVideoPath = video.url;
        }
        
        // Nom de sortie
        const outputPath = path.join(
          process.cwd(), 
          'public', 
          'generated-videos', 
          `hooked_template_video_${timestamp}_${videoIndex + 1}.mp4`
        );
        
        // Appliquer l'image hook comme overlay sur la vidéo avec FFmpeg
        await new Promise((resolve, reject) => {
          console.log(`[Add Hook Template] Applying hook overlay to video ${videoIndex + 1}`);
          
          const ffmpegArgs = [
            '-i', inputVideoPath,
            '-i', templatePath,
            '-filter_complex', [
              // Redimensionner la vidéo pour remplir le format 9:16 (crop)
              '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[video]',
              // L'image hook est déjà transparente, juste la redimensionner
              '[1:v]scale=1080:1920[hook_overlay]',
              '[video][hook_overlay]overlay=0:0[output]'
            ].join(';'),
            '-map', '[output]',
            '-map', '0:a?', // Copier l'audio si présent
            '-c:a', 'copy',
            '-t', '10', // Limiter à 10 secondes
            '-y',
            outputPath
          ];
          
          console.log(`[Add Hook Template] FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`);
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
              console.log(`[Add Hook Template] Video ${videoIndex + 1} processed successfully`);
              resolve(outputPath);
            } else {
              reject(new Error(`FFmpeg exited with code ${code}`));
            }
          });
          
          ffmpeg.on('error', (err) => {
            reject(err);
          });
        });
        
        // Upload to Supabase if user is authenticated
        let videoUrl = `/generated-videos/${path.basename(outputPath)}`;
        let videoId: string | undefined;
        
        if (userId) {
          try {
            const result = await uploadAndSaveGeneratedVideo(
              userId,
              outputPath,
              path.basename(outputPath),
              'add-hook-template',
              {
                originalVideoIndex: videoIndex,
                templateImageUrl,
                processingMethod: 'template-overlay'
              }
            );
            
            if (result) {
              videoUrl = result.url;
              videoId = result.id;
              console.log(`[Add Hook Template] Video uploaded to Supabase: ${videoId}`);
              
              // Delete the local file after successful upload
              await fs.unlink(outputPath).catch(() => {});
            }
          } catch (uploadError) {
            console.error('[Add Hook Template] Failed to upload to Supabase:', uploadError);
            // Continue with local URL if upload fails
          }
        }
        
        // Nettoyer le dossier temporaire
        await fs.rm(tempDir, { recursive: true, force: true });
        
        // Ajouter à la liste des vidéos traitées
        processedVideos.push({ 
          url: videoUrl,
          id: videoId,
          originalIndex: videoIndex,
          type: 'video'
        });
        
      } catch (error) {
        // Nettoyer en cas d'erreur
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        console.error(`[Add Hook Template] Error processing video ${videoIndex + 1}:`, error);
        // Continuer avec les autres vidéos même si une échoue
      }
    }
    
    return NextResponse.json({
      success: true,
      videos: processedVideos,
      message: `Generated ${processedVideos.length} videos using template`,
      stats: {
        totalProcessed: processedVideos.length,
        totalRequested: videosToProcess,
        timestamp: timestamp
      }
    });
    
  } catch (error) {
    console.error('[Add Hook Template] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate videos with template',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}