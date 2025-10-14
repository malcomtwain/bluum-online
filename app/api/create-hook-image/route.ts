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
  console.log('[Create Hook Image] Starting transparent hook image generation...');
  
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
      hookText,
      style = 1,
      position = 'middle',
      offset = 0,
      template = 'default'
    } = data;
    
    console.log('[Create Hook Image] Request data:', {
      hookText,
      style,
      position,
      offset,
      template
    });
    
    if (!hookText || !hookText.trim()) {
      return NextResponse.json(
        { error: 'Hook text is required' },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    
    // Créer un dossier temporaire
    const tempDir = path.join(process.cwd(), 'public', 'generated-videos', `hook_image_${timestamp}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    try {
      // Nom de sortie
      const outputPath = path.join(
        process.cwd(), 
        'public', 
        'generated-videos', 
        `hook_image_${timestamp}.png`
      );
      
      // Fonts du template 2000
      const fonts2000 = [
        '/fonts/2000/Being Regular/OpenType-PS/Being-Regular.otf',
        '/fonts/2000/Unique/Web-TT/Unique-Bold.ttf',
        '/fonts/2000/THUNDER/Fonts/Web-TT/Thunder-BoldHC.ttf',
        '/fonts/2000/Valencia.ttf',
        '/fonts/2000/Alias/OpenType-TT/Alias-Bold.ttf',
        '/fonts/2000/Alinsa/Alinsa.ttf',
        '/fonts/2000/Lemon Regular/Web-TT/Lemon-Wide.ttf',
        '/fonts/2000/AV-Estiana/OpenType-TT/AVEstiana-Bold.ttf',
        '/fonts/2000/Estrella/Estrella-Early.otf'
      ];

      // Générer l'image hook transparente avec FFmpeg
      await new Promise((resolve, reject) => {
        // Pour le template 2000, utiliser une font aléatoire du dossier 2000
        const fontPath = template === '2000'
          ? path.join(process.cwd(), 'public' + fonts2000[Math.floor(Math.random() * fonts2000.length)])
          : path.join(process.cwd(), 'public/fonts/TikTokDisplayMedium.otf');
        
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
        
        const lines = wrapText(hookText, 35);
        const lineHeight = 70;
        
        // Calculer position Y selon la position
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

        // Template 2000 a son propre style
        if (template === '2000') {
          fontColor = 'white';
          borderColor = 'transparent';
          borderWidth = 0;
          fontSize = 125; // Font size du template 2000
        } else if (style === 1) {
          // Style 1: Border - Texte blanc avec bordure noire
          fontColor = 'white';
          borderColor = 'black';
          borderWidth = 3;
          fontSize = 50;
        } else if (style === 2) {
          // Style 2: White - Texte noir avec fond blanc
          fontColor = 'black';
          borderColor = 'white';
          borderWidth = 8;
          fontSize = 65;
        } else if (style === 3) {
          // Style 3: Black - Texte blanc avec fond noir
          fontColor = 'white';
          borderColor = 'black';
          borderWidth = 8;
          fontSize = 65;
        } else if (style === 4) {
          // Style 4: Normal - Texte blanc sans bordure
          fontColor = 'white';
          borderColor = 'transparent';
          borderWidth = 0;
          fontSize = 50;
        }
        
        // Créer une image transparente avec seulement le texte
        const videoFilters = [];
        
        // Commencer par une image transparente
        videoFilters.push('color=c=black@0.0:s=1080x1920:d=1[bg]');
        
        // Ajouter chaque ligne comme un drawtext séparé
        let currentFilter = '[bg]';
        lines.forEach((line, index) => {
          const escapedLine = line.replace(/'/g, "\\'").replace(/:/g, "\\:");
          const yPosition = startY + (index * lineHeight);
          const nextFilter = index === lines.length - 1 ? '[output]' : `[text${index}]`;
          
          let drawtextCommand = `${currentFilter}drawtext=text='${escapedLine}':fontfile='${fontPath}':fontsize=${fontSize}:fontcolor=${fontColor}:x=(w-text_w)/2:y=${yPosition}`;
          
          // Ajouter la bordure seulement si borderWidth > 0
          if (borderWidth > 0) {
            drawtextCommand += `:borderw=${borderWidth}:bordercolor=${borderColor}`;
          }
          
          drawtextCommand += nextFilter;
          videoFilters.push(drawtextCommand);
          currentFilter = nextFilter;
        });
        
        const ffmpegArgs = [
          '-f', 'lavfi',
          '-i', videoFilters.join(';'),
          '-map', '[output]',
          '-frames:v', '1',
          '-y',
          outputPath
        ];
        
        console.log(`[Create Hook Image] FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`);
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
            console.log(`[Create Hook Image] Hook image generated successfully`);
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
      let imageUrl = `/generated-videos/${path.basename(outputPath)}`;
      let imageId: string | undefined;
      
      if (userId) {
        try {
          const result = await uploadAndSaveGeneratedVideo(
            userId,
            outputPath,
            path.basename(outputPath),
            'hook-image',
            {
              hookText,
              style,
              position,
              offset,
              template,
              type: 'transparent-hook-image'
            }
          );
          
          if (result) {
            imageUrl = result.url;
            imageId = result.id;
            console.log(`[Create Hook Image] Image uploaded to Supabase: ${imageId}`);
            
            // Delete the local file after successful upload
            await fs.unlink(outputPath).catch(() => {});
          }
        } catch (uploadError) {
          console.error('[Create Hook Image] Failed to upload to Supabase:', uploadError);
          // Continue with local URL if upload fails
        }
      }
      
      // Nettoyer le dossier temporaire
      await fs.rm(tempDir, { recursive: true, force: true });
      
      return NextResponse.json({
        success: true,
        hookImageUrl: imageUrl,
        hookImageId: imageId,
        message: 'Hook image generated successfully',
        hookText,
        style,
        position,
        offset
      });
      
    } catch (error) {
      // Nettoyer en cas d'erreur
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      console.error(`[Create Hook Image] Error:`, error);
      throw error;
    }
    
  } catch (error) {
    console.error('[Create Hook Image] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate hook image',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}