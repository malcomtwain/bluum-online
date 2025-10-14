import { NextResponse } from 'next/server';

// CONDITIONNEMENT DES IMPORTS NATIFS
// Ces imports ne seront utilisés que côté serveur, pas pendant la compilation
let pathModule: any = null;
let fsPromises: any = null;
let osModule: any = null;
let ffmpegModule: any = null;
let progressModule: any = null;

// Imports conditionnels pour éviter les erreurs pendant la compilation
if (typeof window === 'undefined') {
  try {
    // Import des modules côté serveur seulement
    pathModule = require('path');
    fsPromises = require('fs/promises');
    osModule = require('os');
    // Import conditionnel des modules de l'application
    ffmpegModule = require('@/lib/ffmpeg');
    progressModule = require('@/lib/progress');
  } catch (e) {
    console.warn('Modules natifs non disponibles pendant la compilation', e);
  }
}

// Helpers pour accéder aux modules de manière sécurisée
const generateVideo = ffmpegModule?.generateVideo || (async () => '');
const cleanupTempFiles = ffmpegModule?.cleanupTempFiles || (async () => {});
const updateProgress = progressModule?.updateProgress || (() => {});

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes maximum

export function generateStaticParams() {
  return [];
}

export async function POST(request: Request) {
  try {
    // Vérifie si FFmpeg est disponible dans l'environnement
    // Si non, répond avec une erreur explicite plutôt que de planter
    const ffmpegHelper = typeof window === 'undefined' ? require('@/utils/ffmpeg-helper') : null;
    if (!ffmpegHelper?.ffmpeg) {
      console.warn('FFmpeg not available in this environment');
      return NextResponse.json({
        success: false,
        message: 'Video generation is not available in this environment',
      }, { status: 503 }); // Service Unavailable
    }

    // Ne pas compléter cette fonction pendant la compilation
    if (!pathModule || !fsPromises || !osModule) {
      console.warn('Modules natifs requis non disponibles - environnement de compilation');
      return NextResponse.json({
        success: false,
        message: 'This function requires Node.js modules which are only available at runtime',
      }, { status: 503 });
    }

    const formData = await request.formData();
    const jsonData = JSON.parse(formData.get('json') as string);
    
    // Create temp directory for processing
    const tempDir = await fsPromises.mkdtemp(pathModule.join(osModule.tmpdir(), 'video-gen-'));
    const generatedVideos: string[] = [];
    
    // Save videos to temp directory
    const videoFiles: string[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('video_') && value instanceof File) {
        const filePath = pathModule.join(tempDir, value.name);
        await fsPromises.writeFile(filePath, Buffer.from(await value.arrayBuffer()));
        videoFiles.push(filePath);
      }
    }

    try {
      // Generate videos for each hook and video combination
      for (const hook of jsonData.hooks) {
        for (const videoPath of videoFiles) {
          try {
            // Generate output filename
            const outputFileName = `output_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`;
            const outputPath = pathModule.join(process.cwd(), 'public', 'generated', outputFileName);

            // Generate video with progress tracking
            const options = {
              template: {
                url: jsonData.template.url,
                duration: jsonData.duration.template,
                position: jsonData.templateImagePosition
              },
              video: {
                path: videoPath,
                duration: jsonData.duration.video,
              },
              music: {
                url: jsonData.music.url,
              },
              hook: {
                text: hook,
                style: {
                  type: jsonData.style.type,
                  position: jsonData.style.position,
                  offset: jsonData.style.offset,
                },
              },
              progress: (progress: number) => {
                console.log(`Progress: ${progress}%`);
                updateProgress(progress);
              },
            };

            console.log('Generating video with durations:', {
              template: options.template.duration,
              video: options.video.duration,
              total: options.template.duration + options.video.duration
            });

            await generateVideo(options, outputPath);

            generatedVideos.push(`/generated/${outputFileName}`);
          } catch (error) {
            console.error('Error generating video:', error);
          }
        }
      }
    } catch (ffmpegError) {
      console.error('FFmpeg processing error:', ffmpegError);
      // Retourner une réponse appropriée sans interrompre le déploiement
      return NextResponse.json({
        success: false,
        message: 'Video generation is not available in this environment',
        error: ffmpegError instanceof Error ? ffmpegError.message : 'FFmpeg error',
      }, { status: 503 }); // Service Unavailable
    }

    // Clean up temp files
    await cleanupTempFiles(videoFiles);
    await fsPromises.rmdir(tempDir);
    
    return NextResponse.json({
      success: true,
      videos: generatedVideos,
    });

  } catch (error) {
    console.error('Error generating videos:', error);
    return NextResponse.json({
      success: false,
      message: 'Error generating videos',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
} 