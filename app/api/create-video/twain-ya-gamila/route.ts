import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { uploadAndSaveGeneratedVideo } from '@/lib/upload-generated-media';
import { createClient } from '@supabase/supabase-js';

const execPromise = promisify(exec);

// Initialize Supabase client - only if credentials are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseAdmin = (supabaseUrl && supabaseServiceKey) ? createClient(supabaseUrl, supabaseServiceKey) : null;

// Durées exactes pour chaque image (en secondes)
// 22 images de 0.5 secondes chacune
const IMAGE_DURATIONS = [
  0.50,   // Image 1: 00:00.00 - 00:00.49 (début)
  0.50,   // Image 2: 00:00.50 - 00:00.99
  0.50,   // Image 3: 00:01.00 - 00:01.49
  0.50,   // Image 4: 00:01.50 - 00:01.99
  0.50,   // Image 5: 00:02.00 - 00:02.49
  0.50,   // Image 6: 00:02.50 - 00:02.99
  0.50,   // Image 7: 00:03.00 - 00:03.49
  0.50,   // Image 8: 00:03.50 - 00:03.99
  0.50,   // Image 9: 00:04.00 - 00:04.49
  0.50,   // Image 10: 00:04.50 - 00:04.99
  0.50,   // Image 11: 00:05.00 - 00:05.49
  0.50,   // Image 12: 00:05.50 - 00:05.99
  0.50,   // Image 13: 00:06.00 - 00:06.49
  0.50,   // Image 14: 00:06.50 - 00:06.99
  0.50,   // Image 15: 00:07.00 - 00:07.49
  0.50,   // Image 16: 00:07.50 - 00:07.99
  0.50,   // Image 17: 00:08.00 - 00:08.49
  0.50,   // Image 18: 00:08.50 - 00:08.99
  0.50,   // Image 19: 00:09.00 - 00:09.49
  0.50,   // Image 20: 00:09.50 - 00:09.99
  0.50,   // Image 21: 00:10.00 - 00:10.49
  0.50    // Image 22: 00:10.50 - 00:10.99 (fin)
];

// Fonction pour mélanger intelligemment les images
function smartShuffle(images: any[], seed: number): any[] {
  const result = [...images];
  const usedCombinations = new Set<string>();
  
  // Créer une permutation unique basée sur le seed
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor((Math.sin(seed++) * 10000) % (i + 1));
    if (j < 0) continue;
    [result[i], result[j]] = [result[j], result[i]];
  }
  
  // Créer un hash de cette combinaison
  const hash = result.map((img, idx) => `${idx}-${img.url.slice(-10)}`).join('|');
  
  // Si cette combinaison existe déjà, faire une autre permutation
  if (usedCombinations.has(hash)) {
    return smartShuffle(images, seed + 1000);
  }
  
  usedCombinations.add(hash);
  return result;
}

// Générateur de variations pour créer de la diversité
class VariationGenerator {
  private counter: number = 0;
  
  // Patterns de réorganisation prédéfinis pour garantir la variété
  private patterns = [
    (arr: any[]) => arr, // Original
    (arr: any[]) => [...arr].reverse(), // Inversé
    (arr: any[]) => [...arr.slice(8), ...arr.slice(0, 8)], // Rotation milieu
    (arr: any[]) => arr.filter((_, i) => i % 2 === 0).concat(arr.filter((_, i) => i % 2 === 1)), // Pairs puis impairs
    (arr: any[]) => [...arr.slice(0, 5), ...arr.slice(10), ...arr.slice(5, 10)], // Segments mélangés
    (arr: any[]) => {
      // Spiral pattern
      const result = [];
      let left = 0, right = arr.length - 1;
      while (left <= right) {
        if (left === right) result.push(arr[left]);
        else {
          result.push(arr[left]);
          result.push(arr[right]);
        }
        left++;
        right--;
      }
      return result;
    },
  ];
  
  getNextVariation(images: any[]): any[] {
    this.counter++;
    
    // Utiliser différentes stratégies selon le compteur
    if (this.counter % 6 === 0) {
      // Tous les 6, utiliser un pattern prédéfini
      const patternIndex = Math.floor(this.counter / 6) % this.patterns.length;
      return this.patterns[patternIndex](images);
    } else {
      // Sinon, mélange intelligent avec seed basé sur le compteur
      return smartShuffle(images, this.counter * 1337);
    }
  }
}

const variationGen = new VariationGenerator();

export async function POST(request: NextRequest) {
  console.log('[Twain Ya Gamila] Starting intelligent video generation...');
  
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
    const { images, videos, hooks, hook, music, videoCount = 1, style = 1, position = 'middle', offset = 0, imageTiming, imageCount, maxVideoDuration, imageTimingMin, imageTimingMax } = data;
    
    console.log('[Twain Ya Gamila] Request data:', {
      imagesCount: images?.length,
      videosCount: videos?.length,
      hooksCount: hooks?.length,
      musicId: music?.id,
      musicUrl: music?.url ? 'present' : 'missing',
      videoCount,
      style,
      position,
      offset,
      intelligentDuration: `${(imageTimingMin || 8000) / 1000}s - ${(imageTimingMax || 15000) / 1000}s`
    });
    
    // Combiner images et vidéos en un seul tableau de médias
    const allMedia = [
      ...(images || []).map((img: any) => ({ ...img, type: 'image' })),
      ...(videos || []).map((vid: any) => ({ ...vid, type: 'video' }))
    ];
    
    // Déterminer si c'est principalement une collection vidéo
    const isVideoCollection = (videos && videos.length > 0) && (!images || images.length === 0);
    
    // Validation adaptée - on utilise ce qu'on a, pas de minimum artificiel
    if (!allMedia || allMedia.length === 0) {
      return NextResponse.json(
        { error: 'At least 1 image or video is required' },
        { status: 400 }
      );
    }
    
    console.log(`[Twain Ya Gamila] Available media: ${allMedia.length} items`);

    // Check if no-music option is selected
    const isNoMusicSelected = music?.id === 'no-music' || !music || !music.url;
    
    if (!isNoMusicSelected && (!music || !music.url)) {
      return NextResponse.json(
        { error: 'Music is required or select "Without music" option' },
        { status: 400 }
      );
    }

    const generatedVideos = [];
    const timestamp = Date.now();
    
    for (let videoIndex = 0; videoIndex < videoCount; videoIndex++) {
      console.log(`[Twain Ya Gamila] Creating unique variation ${videoIndex + 1}/${videoCount}`);
      
      // Générer un seed unique pour cette vidéo avec plus de variabilité
      const currentTime = Date.now(); // Timestamp actuel pour plus de variabilité
      const videoSeed = currentTime + videoIndex * 1000 + (allMedia.length * 137) + ((hooks?.length || 0) * 73) + Math.floor(Math.random() * 10000);
      
      // 🎯 VITESSE UNIFORME : Choisir UNE vitesse pour TOUT ce montage (0.1s à 0.5s par clip)
      const clipSpeedMin = 0.1; // Vitesse minimum par clip
      const clipSpeedMax = 0.5; // Vitesse maximum par clip
      
      // Utiliser Math.random() directement pour avoir une vraie variation
      const uniformClipSpeed = clipSpeedMin + Math.random() * (clipSpeedMax - clipSpeedMin);
      
      console.log(`[Twain Ya Gamila] Montage ${videoIndex + 1} uniform clip speed: ${uniformClipSpeed.toFixed(3)}s per clip for ALL media in this montage`);
      
      // 🎯 INTELLIGENCE AUTOCUT : Calculer automatiquement le nombre optimal de médias
      // Le frontend nous envoie la durée finale souhaitée (min/max en millisecondes)
      const targetMinDuration = (imageTimingMin || 8000) / 1000; // Convertir ms en secondes (défaut: 8s)
      const targetMaxDuration = (imageTimingMax || 15000) / 1000; // Convertir ms en secondes (défaut: 15s)
      
      // Calculer la durée cible pour ce montage (varie entre min et max)
      const targetDuration = targetMinDuration + Math.random() * (targetMaxDuration - targetMinDuration);
      
      // 🎯 CALCUL INTELLIGENT : Combien de clips nécessaires pour atteindre la durée cible
      const estimatedClipsNeeded = Math.ceil(targetDuration / uniformClipSpeed);
      
      // 🎯 LIMITE DE 20 MÉDIAS : Maximum 20 médias uniques par montage
      const maxUniqueMedia = Math.min(allMedia.length, 20);
      
      // 🔄 SYSTÈME DE LOOP : Si on a besoin de plus de clips que de médias disponibles
      const actualClipsCount = estimatedClipsNeeded;
      const uniqueMediaUsed = Math.min(actualClipsCount, maxUniqueMedia);
      
      // Créer la liste des médias en loopant si nécessaire
      const shuffledMedia = smartShuffle(allMedia, videoSeed);
      const selectedMedia = [];
      
      for (let i = 0; i < actualClipsCount; i++) {
        const mediaIndex = i % uniqueMediaUsed; // Loop sur les médias disponibles
        selectedMedia.push(shuffledMedia[mediaIndex]);
      }
      
      console.log(`[Twain Ya Gamila] 🎯 AutoCut: Target ${targetDuration.toFixed(1)}s = ${actualClipsCount} clips × ${uniformClipSpeed.toFixed(3)}s = ${(actualClipsCount * uniformClipSpeed).toFixed(1)}s`);
      console.log(`[Twain Ya Gamila] 🔄 Using ${uniqueMediaUsed} unique media, looped to ${actualClipsCount} clips (max 20 unique)`);
      
      // Tous les clips ont la même durée uniforme
      const clipDurations = new Array(actualClipsCount).fill(uniformClipSpeed);
      
      console.log(`[Twain Ya Gamila] 🧠 AutoCut selected ${selectedMedia.length}/${allMedia.length} media items for dynamic ${targetDuration.toFixed(1)}s montage`);
      
      // Traiter le hook - priorité à hook.imageUrl puis fallback vers hooks array
      let selectedHook = '';
      let hookImagePath = null;
      
      if (hook && hook.imageUrl) {
        console.log('[Twain Ya Gamila] Using hook image from preview');
        // Sauvegarder l'image du hook capturée du canvas
        hookImagePath = path.join(tempDir, 'hook_overlay.png');
        const base64Data = hook.imageUrl.replace(/^data:image\/png;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        await fs.writeFile(hookImagePath, imageBuffer);
      } else if (hooks && hooks.length > 0) {
        // Fallback vers l'ancien système pour compatibilité
        const hookIndex = Math.floor(Math.random() * hooks.length);
        selectedHook = hooks[hookIndex] || hooks[0];
        console.log(`[Twain Ya Gamila] Selected random hook ${hookIndex}:`, selectedHook);
      }
      
      console.log(`[Twain Ya Gamila] Processing ${selectedMedia.length} media items`);
      
      // Créer un dossier temporaire
      const tempDir = path.join(process.cwd(), 'public', 'generated-videos', `twain_${timestamp}_${videoIndex}`);
      await fs.mkdir(tempDir, { recursive: true });
      
      try {
        // Sauvegarder les médias (images et vidéos) avec des noms uniques
        const mediaPaths = [];
        for (let i = 0; i < selectedMedia.length; i++) {
          const media = selectedMedia[i];
          if (media.type === 'image') {
            // Traiter les images
            const imageData = media.url.replace(/^data:image\/\w+;base64,/, '');
            const imagePath = path.join(tempDir, `img_${i.toString().padStart(2, '0')}.jpg`);
            await fs.writeFile(imagePath, imageData, 'base64');
            mediaPaths.push(imagePath);
          } else if (media.type === 'video') {
            if (isVideoCollection) {
              // Pour les collections vidéo, utiliser les vidéos directement
              let videoPath: string;
              if (media.url.startsWith('data:')) {
                // Vidéo en base64
                const videoData = media.url.replace(/^data:video\/\w+;base64,/, '');
                videoPath = path.join(tempDir, `vid_${i.toString().padStart(2, '0')}.mp4`);
                await fs.writeFile(videoPath, videoData, 'base64');
              } else {
                // URL de vidéo
                videoPath = media.url;
              }
              
              // Redimensionner la vidéo au bon format et ajuster la durée
              const processedVideoPath = path.join(tempDir, `processed_vid_${i.toString().padStart(2, '0')}.mp4`);
              // 🎯 Utiliser la vitesse uniforme pour ce clip
              const videoDuration = clipDurations[i] || uniformClipSpeed;
              
              console.log(`[Twain Ya Gamila] 🎯 AutoCut Video ${i + 1} duration: ${videoDuration.toFixed(3)}s (uniform speed)`);
              
              await new Promise((resolve, reject) => {
                let ffmpegArgs;
                
                // Approche plus robuste pour éviter les figés
                ffmpegArgs = [
                  '-i', videoPath,
                  '-avoid_negative_ts', 'make_zero', // Éviter les timestamps négatifs
                  '-fflags', '+genpts', // Générer de nouveaux timestamps
                ];
                
                if (videoDuration > 0) {
                  // Pour les vidéos avec durée spécifiée
                  ffmpegArgs.push(
                    '-filter_complex', 
                    `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30[v]`,
                    '-map', '[v]',
                    '-t', videoDuration.toString(),
                    '-an' // Pas d'audio pour éviter les problèmes
                  );
                } else {
                  // Pour les vidéos sans durée spécifiée
                  ffmpegArgs.push(
                    '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30',
                    '-an' // Pas d'audio pour les vidéos individuelles
                  );
                }
                
                // Paramètres de sortie communs
                ffmpegArgs.push(
                  '-c:v', 'libx264',
                  '-preset', 'ultrafast', // Plus rapide pour éviter les timeouts
                  '-crf', '28', // Qualité un peu plus basse mais plus stable
                  '-pix_fmt', 'yuv420p',
                  '-movflags', '+faststart', // Optimisation streaming
                  '-y', processedVideoPath
                );
                
                console.log(`[Twain Ya Gamila] Processing video ${i + 1} with duration ${videoDuration}s`);
                console.log(`[Twain Ya Gamila] FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`);
                
                const ffmpeg = spawn('ffmpeg', ffmpegArgs);
                
                // Timeout de 30 secondes pour éviter les blocages
                const timeout = setTimeout(() => {
                  console.error(`[Twain Ya Gamila] Video ${i + 1} processing timeout, killing process`);
                  ffmpeg.kill('SIGKILL');
                  reject(new Error(`Video processing timeout after 30s`));
                }, 30000);
                
                ffmpeg.stdout.on('data', (data) => {
                  console.log(`[FFmpeg Video ${i + 1} stdout]: ${data.toString().slice(0, 200)}`);
                });
                
                ffmpeg.stderr.on('data', (data) => {
                  const output = data.toString();
                  console.log(`[FFmpeg Video ${i + 1} stderr]: ${output.slice(0, 200)}`);
                });
                
                ffmpeg.on('close', (code) => {
                  clearTimeout(timeout);
                  if (code === 0) {
                    console.log(`[Twain Ya Gamila] Video ${i + 1} processing completed successfully`);
                    resolve(processedVideoPath);
                  } else {
                    reject(new Error(`FFmpeg video processing failed with code ${code}`));
                  }
                });
                
                ffmpeg.on('error', (err) => {
                  clearTimeout(timeout);
                  reject(err);
                });
              });
              
              mediaPaths.push(processedVideoPath);
            } else {
              // Pour les collections mixtes, extraire une frame
              let videoPath: string;
              if (media.url.startsWith('data:')) {
                const videoData = media.url.replace(/^data:video\/\w+;base64,/, '');
                videoPath = path.join(tempDir, `vid_${i.toString().padStart(2, '0')}.mp4`);
                await fs.writeFile(videoPath, videoData, 'base64');
              } else {
                videoPath = media.url;
              }
              
              const framePath = path.join(tempDir, `frame_${i.toString().padStart(2, '0')}.jpg`);
              await new Promise((resolve, reject) => {
                const ffmpeg = spawn('ffmpeg', [
                  '-i', videoPath,
                  '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920', // Crop au lieu de pad pour remplir
                  '-vframes', '1',
                  '-y',
                  framePath
                ]);
                
                ffmpeg.on('close', (code) => {
                  if (code === 0) {
                    resolve(framePath);
                  } else {
                    reject(new Error(`FFmpeg frame extraction failed with code ${code}`));
                  }
                });
                
                ffmpeg.on('error', reject);
              });
              
              mediaPaths.push(framePath);
            }
          }
        }
        
        // Sauvegarder la musique seulement si elle n'est pas "no-music"
        let musicPath = null;
        if (!isNoMusicSelected && music && music.url) {
          const musicData = music.url.replace(/^data:audio\/\w+;base64,/, '');
          musicPath = path.join(tempDir, 'audio.mp3');
          await fs.writeFile(musicPath, musicData, 'base64');
        }
        
        // 🎯 Créer le fichier concat avec les durées uniformes
        let concatContent = '';
        for (let i = 0; i < mediaPaths.length; i++) {
          // 🎯 Utiliser la vitesse uniforme pour tous les clips
          const clipDuration = clipDurations[i] || uniformClipSpeed;
          
          concatContent += `file '${mediaPaths[i]}'\n`;
          concatContent += `duration ${clipDuration.toFixed(3)}\n`;
          
          console.log(`[Twain Ya Gamila] 🎯 AutoCut Clip ${i + 1} duration: ${clipDuration.toFixed(3)}s (uniform speed ${i + 1}/${clipDurations.length})`);
        }
        
        // Important : Ne PAS ajouter le dernier fichier sans durée - ça cause les figés
        // FFmpeg concat va automatiquement gérer la fin
        
        console.log(`[Twain Ya Gamila] Concat file will contain ${mediaPaths.length} media files`);
        console.log(`[Twain Ya Gamila] First few lines of concat:\n${concatContent.split('\n').slice(0, 6).join('\n')}`);
        
        const concatFile = path.join(tempDir, 'concat.txt');
        await fs.writeFile(concatFile, concatContent);
        
        // Nom de sortie unique
        const outputPath = path.join(
          process.cwd(), 
          'public', 
          'generated-videos', 
          `twain_${timestamp}_v${videoIndex + 1}.mp4`
        );
        
        // Créer la vidéo directement avec les 22 images
        await new Promise((resolve, reject) => {
          // Préparer les filtres vidéo
          let videoFilters = [
            'scale=1080:1920:force_original_aspect_ratio=increase',
            'crop=1080:1920',
            'setsar=1'
          ];
          
          // Note: Si hookImagePath existe, on utilisera filter_complex plus tard
          // Ajouter le texte du hook si pas d'image
          if (!hookImagePath && selectedHook && selectedHook.trim()) {
            // Fallback vers drawtext pour compatibilité
            const fontPath = path.join(process.cwd(), 'public/fonts/TikTokDisplayMedium.otf');
            
            // Fonction pour diviser le texte en lignes
            const wrapText = (text: string, maxCharsPerLine: number = 35): string[] => {
              const words = text.split(' ');
              const lines: string[] = [];
              let currentLine = '';
              
              for (const word of words) {
                if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
                  currentLine = currentLine ? `${currentLine} ${word}` : word;
                } else {
                  if (currentLine) lines.push(currentLine);
                  currentLine = word;
                }
              }
              if (currentLine) lines.push(currentLine);
              
              return lines;
            };
            
            const lines = wrapText(selectedHook, 35);
            const lineHeight = 70;
            
            // Calculer position Y selon la position (même logique que slideshow)
            let startY = 902; // middle par défaut (47% de 1920)
            if (position === 'top') {
              startY = 230; // 12% de 1920 = 230px
            } else if (position === 'bottom') {
              startY = 1382; // 72% de 1920 = 1382px
            }
            
            // Appliquer l'offset
            startY += (offset || 0) * 8;
            
            // Définir les styles selon le type
            let fontColor = 'white';
            let borderColor = 'black';
            let borderWidth = 3;
            let fontSize = 50;
            
            if (style === 1) {
              // Style 1: Texte blanc avec bordure noire
              fontColor = 'white';
              borderColor = 'black';
              borderWidth = 3;
              fontSize = 50;
            } else if (style === 2) {
              // Style 2: Texte noir avec fond blanc (on simule avec bordercolor)
              fontColor = 'black';
              borderColor = 'white';
              borderWidth = 8;
              fontSize = 65;
            } else if (style === 3) {
              // Style 3: Texte blanc avec fond noir
              fontColor = 'white';
              borderColor = 'black';
              borderWidth = 8;
              fontSize = 65;
            } else if (style === 4) {
              // Style 4: Texte blanc sans bordure
              fontColor = 'white';
              borderColor = 'transparent';
              borderWidth = 0;
              fontSize = 50;
            }

            // Ajouter chaque ligne comme un drawtext séparé
            lines.forEach((line, index) => {
              const escapedLine = line.replace(/'/g, "\\'").replace(/:/g, "\\:");
              const yPosition = startY + (index * lineHeight);
              
              let drawtextCommand = `drawtext=text='${escapedLine}':fontfile='${fontPath}':fontsize=${fontSize}:fontcolor=${fontColor}:x=(w-text_w)/2:y=${yPosition}`;
              
              // Ajouter la bordure seulement si borderWidth > 0
              if (borderWidth > 0) {
                drawtextCommand += `:borderw=${borderWidth}:bordercolor=${borderColor}`;
              }
              
              videoFilters.push(drawtextCommand);
            });
          }
          
          // Build FFmpeg command based on whether music is selected
          const ffmpegArgs = [
            '-f', 'concat',
            '-safe', '0',
            '-avoid_negative_ts', 'make_zero', // Éviter les timestamps négatifs
            '-fflags', '+genpts', // Générer de nouveaux timestamps
            '-i', concatFile
          ];
          
          // Add hook image input if present
          if (hookImagePath) {
            ffmpegArgs.push('-i', hookImagePath);
          }
          
          // Add music input only if musicPath exists
          if (musicPath) {
            ffmpegArgs.push('-i', musicPath);
          }
          
          // Add video filters - use filter_complex if we have hook image
          if (hookImagePath) {
            // Avec hook image, utiliser filter_complex pour overlay
            const videoFilter = videoFilters.join(',');
            const inputIndex = musicPath ? 1 : 1; // Hook image est toujours input 1
            ffmpegArgs.push('-filter_complex', `[0:v]${videoFilter}[v];[v][${inputIndex}:v]overlay=(W-w)/2:(H-h)/2[outv]`);
            ffmpegArgs.push('-map', '[outv]');
            if (musicPath) {
              const musicIndex = musicPath ? 2 : -1;
              ffmpegArgs.push('-map', `${musicIndex}:a`);
            }
          } else {
            // Sans hook image, utiliser vf normal
            ffmpegArgs.push('-vf', videoFilters.join(','));
          }
          
          // Video codec settings
          ffmpegArgs.push(
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '23',
            '-pix_fmt', 'yuv420p'
          );
          
          // Audio codec settings only if we have music
          if (musicPath) {
            ffmpegArgs.push(
              '-c:a', 'aac',
              '-b:a', '192k',
              '-ar', '44100'
            );
          }
          
          // Duration and output - Utiliser la durée calculée avec la vitesse uniforme
          const calculatedDuration = actualClipsCount * uniformClipSpeed;
          const totalDuration = calculatedDuration;
          const mediaCountToUse = actualClipsCount;
          
          console.log(`[Twain Ya Gamila] 🎯 AutoCut final duration: ${totalDuration.toFixed(2)}s (${selectedMedia.length} clips × ${uniformClipSpeed.toFixed(3)}s uniform speed)`);
          
          // TOUJOURS spécifier une durée pour éviter les figés à la fin
          ffmpegArgs.push('-t', totalDuration.toFixed(2));
          
          // Ajouter des paramètres pour forcer l'arrêt propre
          ffmpegArgs.push(
            '-avoid_negative_ts', 'make_zero',
            '-shortest' // S'arrêter dès que la plus courte source se termine
          );
          
          ffmpegArgs.push('-y', outputPath);
          
          console.log(`[Twain Ya Gamila] FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`);
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
              console.log(`[Twain Ya Gamila] Video ${videoIndex + 1} created successfully`);
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
        let videoUrl = `/generated-videos/${path.basename(outputPath)}`;
        let videoId: string | undefined;
        
        if (userId) {
          try {
            const result = await uploadAndSaveGeneratedVideo(
              userId,
              outputPath,
              path.basename(outputPath),
              'twain-ya-gamila',
              {
                hooks,
                mediaCount: selectedMedia.length,
                actualClipsCount: actualClipsCount,
                uniqueMediaUsed: uniqueMediaUsed,
                targetDuration: `${targetDuration.toFixed(1)}s`,
                finalDuration: `${totalDuration.toFixed(1)}s`,
                uniformClipSpeed: `${uniformClipSpeed.toFixed(3)}s`,
                autoCutIntelligence: true,
                uniformSpeed: true,
                loopSystem: actualClipsCount > uniqueMediaUsed,
                variation: `AutoCut AI #${videoIndex + 1}`
              }
            );
            
            if (result) {
              videoUrl = result.url;
              videoId = result.id;
              console.log(`[Twain Ya Gamila] Video uploaded to Supabase: ${videoId}`);
              
              // Delete the local file after successful upload
              await fs.unlink(outputPath).catch(() => {});
            }
          } catch (uploadError) {
            console.error('[Twain Ya Gamila] Failed to upload to Supabase:', uploadError);
            // Continue with local URL if upload fails
          }
        }
        
        // Nettoyer le dossier temporaire
        await fs.rm(tempDir, { recursive: true, force: true });
        
        // Ajouter à la liste des vidéos générées
        generatedVideos.push({ 
          url: videoUrl,
          id: videoId,
          index: videoIndex,
          autoCutIntelligence: {
            mediaSelected: selectedMedia.length,
            actualClipsCount: actualClipsCount,
            uniqueMediaUsed: uniqueMediaUsed,
            targetDuration: `${targetDuration.toFixed(1)}s`,
            finalDuration: `${totalDuration.toFixed(1)}s`,
            uniformClipSpeed: `${uniformClipSpeed.toFixed(3)}s`,
            loopSystem: actualClipsCount > uniqueMediaUsed
          },
          variation: `AutoCut AI #${videoIndex + 1}`
        });
        
      } catch (error) {
        // Nettoyer en cas d'erreur
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        throw error;
      }
    }
    
    return NextResponse.json({
      success: true,
      videos: generatedVideos,
      message: `🎯 AutoCut AI generated ${videoCount} video variation(s) with uniform speed and loop system`,
      stats: {
        totalVariations: videoCount,
        autoCutIntelligence: true,
        uniformSpeed: true,
        loopSystem: true,
        intelligentSelection: 'Uniform clip speed (0.1s-0.5s) with media looping system (max 20 unique)',
        timestamp: timestamp
      }
    });
    
  } catch (error) {
    console.error('[Twain Ya Gamila] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate video',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}