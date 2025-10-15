import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fsPromises } from 'fs';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { uploadAndSaveGeneratedSlideshow } from '@/lib/upload-generated-media';
import { createClient } from '@supabase/supabase-js';

const execPromise = promisify(exec);

// Fonction pour obtenir le chemin de la font sélectionnée
function getFontPath(selectedFont: string): string {
  const fontMap: { [key: string]: string } = {
    'all': '/fonts/TikTokDisplayMedium.otf', // Default when mixing fonts
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
  
  return fontMap[selectedFont] || fontMap['tiktok']; // Fallback to TikTok font if not found
}

// Fonction pour sélectionner une font aléatoire parmi les fonts sélectionnées
function getRandomSelectedFontPath(selectedFonts: string[], seed: number): string {
  if (selectedFonts.length === 0) {
    return '/fonts/TikTokDisplayMedium.otf'; // Fallback
  }
  
  if (selectedFonts.length === 1) {
    return getFontPath(selectedFonts[0]);
  }
  
  // Sélectionner aléatoirement parmi les fonts sélectionnées
  const randomIndex = Math.floor(Math.abs(Math.sin(seed * 0.00789) * 10000) % selectedFonts.length);
  return getFontPath(selectedFonts[randomIndex]);
}

// Fonction pour mélanger intelligemment les images avec seed unique
function smartShuffleImages(images: string[], seed: number): string[] {
  const result = [...images];
  
  // Créer une permutation unique basée sur le seed et timestamp
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor((Math.sin(seed + i) * 10000) % (i + 1));
    if (j >= 0 && j < result.length) {
      [result[i], result[j]] = [result[j], result[i]];
    }
  }
  
  return result;
}

// Fonction pour sélectionner un hook aléatoire pour le mode "first"
function selectRandomHook(hooks: string[], seed: number): string {
  if (hooks.length === 0) return '';
  
  console.log(`[HOOK SELECTION] Starting selection with ${hooks.length} hooks available`);
  console.log(`[HOOK SELECTION] Raw seed: ${seed}`);
  
  // Utiliser plusieurs méthodes de randomisation pour garantir la diversité
  const method1 = Math.abs(Math.sin(seed * 0.001)) * hooks.length;
  const method2 = Math.abs(Math.cos(seed * 0.003)) * hooks.length; 
  const method3 = (seed * 9301 + 49297) % 233280 / 233280 * hooks.length;
  
  // Combiner les méthodes pour plus de diversité
  const combined = (method1 + method2 + method3) / 3;
  const randomIndex = Math.floor(combined) % hooks.length;
  
  console.log(`[HOOK SELECTION] Method1: ${method1}, Method2: ${method2}, Method3: ${method3}`);
  console.log(`[HOOK SELECTION] Combined: ${combined}, Final index: ${randomIndex}/${hooks.length}`);
  console.log(`[HOOK SELECTION] First 5 hooks:`, hooks.slice(0, 5).map((h, i) => `${i}: ${h.substring(0, 30)}...`));
  console.log(`[HOOK SELECTION] ✅ SELECTED HOOK AT INDEX ${randomIndex}:`, hooks[randomIndex]?.substring(0, 50) + '...');
  
  return hooks[randomIndex] || hooks[0];
}

// Générateur de combinaisons uniques basé sur timestamp + contenu
function generateUniqueSeed(images: string[], hooks: string[]): number {
  const now = Date.now();
  const microseconds = performance.now() * 1000;
  const contentHash = (images.join('') + hooks.join('')).length;
  const randomComponent = Math.random() * 1000000;
  const extraRandom = Math.floor(Math.random() * 999999999);
  
  const seed = Math.floor(now + microseconds + contentHash + randomComponent + extraRandom);
  console.log(`[SEED GENERATION] Timestamp: ${now}, Microseconds: ${microseconds}, ContentHash: ${contentHash}, Final seed: ${seed}`);
  
  return seed;
}

// Initialize Supabase client - only if credentials are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseAdmin = (supabaseUrl && supabaseServiceKey) ? createClient(supabaseUrl, supabaseServiceKey) : null;

// Fonction pour redimensionner une image en 9:16 avec hook FFmpeg drawtext (comme twain-ya-gamila)
async function resizeImageWithHook(
  inputPath: string, 
  outputPath: string, 
  hookText?: string,
  style?: number,
  position?: string,
  offset?: number,
  selectedFonts?: string[],
  seed?: number
) {
  try {
    // Filtres vidéo de base pour redimensionner en 9:16
    let videoFilters = [
      'scale=1080:1920:force_original_aspect_ratio=increase',
      'crop=1080:1920',
      'setsar=1'
    ];
    
    // Ajouter le hook text si fourni (utilise la même logique que twain-ya-gamila)
    if (hookText && hookText.trim()) {
      // Pour les styles 2 et 3 (White/Black), forcer la font TikTok
      let fontRelativePath;
      if (style === 2 || style === 3) {
        fontRelativePath = '/fonts/TikTokDisplayMedium.otf';
      } else if (selectedFonts && selectedFonts.length > 0 && seed) {
        fontRelativePath = getRandomSelectedFontPath(selectedFonts, seed);
      } else {
        fontRelativePath = '/fonts/TikTokDisplayMedium.otf';
      }
      
      const fontPath = path.join(process.cwd(), 'public' + fontRelativePath);
      
      // Fonction pour diviser le texte en lignes (identique à twain-ya-gamila)
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
      const lineHeight = 80;
      
      // Calculer position Y selon le style (même logique que preview)
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
      let fontSize = 65;
      
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
      
      // Ajouter chaque ligne comme un drawtext séparé (identique à twain-ya-gamila)
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
    
    // Commande FFmpeg avec filtres
    const command = `ffmpeg -i "${inputPath}" -vf "${videoFilters.join(',')}" -y "${outputPath}"`;
    
    console.log('Resizing image with hook:', command);
    const { stdout, stderr } = await execPromise(command);
    
    if (fs.existsSync(outputPath)) {
      console.log('Image resized successfully with hook applied');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to resize image with hook:', error);
    return false;
  }
}


export async function POST(request: Request) {
  console.log('=== Create slideshow API called ===');
  
  try {
    // Get the Authorization header to identify the user
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;
    
    console.log('Auth header:', authHeader ? 'Present' : 'Missing');
    console.log('Supabase admin:', supabaseAdmin ? 'Initialized' : 'Not initialized');
    
    if (supabaseAdmin && authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      console.log('Attempting to get user from token...');
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
        console.log('User ID found:', userId);
      } else {
        console.error('Failed to get user from token:', error);
      }
    } else {
      console.log('Missing requirements for auth:', {
        supabaseAdmin: !!supabaseAdmin,
        authHeader: !!authHeader,
        isBearerToken: authHeader?.startsWith('Bearer ') || false
      });
    }
    
    const body = await request.json();
    console.log('Request body:', JSON.stringify(body, null, 2));
    const { images, song, hooks, style, imageCount, positions, selectedFonts = ['tiktok'] } = body;
    
    // Générer un seed unique pour cette génération
    const uniqueSeed = generateUniqueSeed(images || [], hooks || []);
    console.log('Generated unique seed:', uniqueSeed);
    
    // Debug logs pour les hooks
    console.log('=== API HOOK DEBUG ===');
    console.log('Received hooks:', hooks);
    console.log('Hooks type:', typeof hooks);
    console.log('Hooks array?:', Array.isArray(hooks));
    if (Array.isArray(hooks)) {
      console.log('Hooks length:', hooks.length);
      hooks.forEach((hook, i) => {
        console.log(`Hook ${i}:`, hook, typeof hook);
      });
    }
    console.log('=====================');

    if (!images || !Array.isArray(images) || images.length === 0) {
      console.log('Invalid images:', images);
      return NextResponse.json({ 
        error: 'No images provided. Please select image collections first in the Images page.',
        details: 'Images array is empty or invalid'
      }, { status: 400 });
    }
    
    // Créer un dossier pour ce slideshow
    const timestamp = Date.now();
    const slideshowDir = path.join(process.cwd(), 'public', 'generated-slideshows', `slideshow-${timestamp}`);
    console.log('Creating slideshow directory:', slideshowDir);
    
    try {
      await fsPromises.mkdir(slideshowDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create slideshow directory:', error);
      return NextResponse.json({ 
        error: 'Failed to create slideshow directory',
        details: error instanceof Error ? error.message : String(error)
      }, { status: 500 });
    }

    // Array pour stocker les chemins des images générées
    let generatedImages: string[] = [];

    // Mélanger intelligemment les images pour éviter les répétitions
    const shuffledImages = smartShuffleImages(images, uniqueSeed);
    console.log('Original images order:', images.slice(0, 5));
    console.log('Shuffled images order:', shuffledImages.slice(0, 5));

    // Déterminer le mode de hook et extraire les textes avec randomisation
    let hookMode: 'none' | 'first' | 'each' = 'none';
    let selectedRandomHook: string = '';
    let perImageHooks: Map<number, string> = new Map();
    
    if (hooks && Array.isArray(hooks) && hooks.length > 0) {
      console.log('Received hooks:', JSON.stringify(hooks));
      // Vérifier si c'est un tableau de strings (hook uniquement sur la première image)
      if (hooks.every(h => typeof h === 'string')) {
        hookMode = 'first';
        // Sélectionner UN hook aléatoire au lieu de prendre le premier
        selectedRandomHook = selectRandomHook(hooks, uniqueSeed);
        console.log('Original hooks count:', hooks.length);
        console.log('Selected random hook:', selectedRandomHook.substring(0, 50) + '...');
      } 
      // Ou si c'est un tableau d'objets avec position (hook par image)
      else if (hooks.every(h => h && typeof h === 'object' && 'position' in h)) {
        hookMode = 'each';
        hooks.forEach((hook: any) => {
          if (hook.text && hook.text.trim()) {
            perImageHooks.set(hook.position, hook.text.trim());
          }
        });
      }
    }

    console.log('Hook mode:', hookMode);
    console.log('Selected random hook:', selectedRandomHook);
    console.log('Per image hooks:', perImageHooks);
    console.log('Style:', style);
    console.log('Positions:', positions);
    console.log(`Processing ${imageCount} images...`);
    
    // Traiter chaque image
    for (let i = 0; i < imageCount; i++) {
      // Utiliser les images mélangées au lieu de l'ordre séquentiel
      const imageUrl = shuffledImages[i % shuffledImages.length];
      
      try {
        // Télécharger l'image
        console.log(`Downloading image ${i + 1}/${imageCount}: ${imageUrl}`);
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        
        // Déterminer si cette image devrait avoir un hook appliqué
        let shouldApplyHook = false;
        let hookTextToApply = '';
        
        if (hookMode === 'first') {
          // Appliquer le hook sélectionné aléatoirement seulement sur la première image
          if (i === 0 && selectedRandomHook) {
            shouldApplyHook = true;
            hookTextToApply = selectedRandomHook.trim();
            console.log(`Will apply selected random hook to first image: "${hookTextToApply}"`);
          }
        } else if (hookMode === 'each' && perImageHooks.has(i)) {
          // Appliquer le hook spécifique à cette image
          shouldApplyHook = true;
          hookTextToApply = perImageHooks.get(i) || '';
          console.log(`Will apply hook to image ${i + 1}: "${hookTextToApply}"`);
        }
        
        // Sauvegarder l'image avec hook appliqué directement via FFmpeg (comme twain-ya-gamila)
        const finalImagePath = path.join(slideshowDir, `part_${i + 1}.png`);
        
        // Sauvegarder l'image temporaire
        const tempImagePath = path.join(slideshowDir, `temp_${i + 1}.png`);
        await fsPromises.writeFile(tempImagePath, Buffer.from(buffer));
        
        // Appliquer le hook et redimensionner en une seule étape
        let hookStyle = style || 1;
        let hookPosition = 'middle';
        let hookOffset = 0;
        
        if (shouldApplyHook && hookTextToApply && hookTextToApply.trim()) {
          // Récupérer la position et l'offset depuis les paramètres selon le style
          const styleKey = style === 1 ? 'style1' : style === 2 ? 'style2' : style === 3 ? 'style3' : 'style4';
          const positionData = positions?.[styleKey] || { position: 'middle', offset: 0 };
          hookPosition = typeof positionData === 'object' ? positionData.position : 'middle';
          hookOffset = typeof positionData === 'object' ? positionData.offset : 0;
        }
        
        // Utiliser la nouvelle fonction qui fait tout en une étape
        const success = await resizeImageWithHook(
          tempImagePath,
          finalImagePath,
          shouldApplyHook ? hookTextToApply : undefined,
          hookStyle,
          hookPosition,
          hookOffset,
          selectedFonts,
          uniqueSeed + i
        );
        
        if (success) {
          console.log(`✅ Image ${i + 1} processed successfully ${shouldApplyHook ? 'with hook' : 'without hook'}`);
        } else {
          console.error(`❌ Failed to process image ${i + 1}`);
        }
        
        // Supprimer l'image temporaire
        try {
          await fsPromises.unlink(tempImagePath);
        } catch (e) {
          console.error('Error cleaning up temp file:', e);
        }
        
        // Ajouter au tableau des images générées
        const imagePath = `/generated-slideshows/slideshow-${timestamp}/part_${i + 1}.png`;
        generatedImages.push(imagePath);
        console.log(`Image ${i + 1} processed and saved`);
        
      } catch (error) {
        console.error(`Failed to process image ${i + 1}:`, error);
        return NextResponse.json({ 
          error: `Failed to process image ${i + 1}`,
          details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
      }
    }
    
    console.log('=== SLIDESHOW GENERATION COMPLETED ===');
    console.log(`All ${imageCount} images processed with FFmpeg drawtext hooks`);
    
    // Sauvegarder le slideshow dans Supabase si l'utilisateur est connecté
    let supabaseUrl = null;
    console.log('About to save slideshow. User ID:', userId);
    if (userId) {
      console.log('Saving slideshow to database for user:', userId);
      try {
        const slideshowPath = path.join(process.cwd(), 'public', 'generated-slideshows', `slideshow-${timestamp}`);
        const fileName = `slideshow-${timestamp}`;

        console.log('📁 Slideshow path to upload:', slideshowPath);
        console.log('📂 Directory exists:', fs.existsSync(slideshowPath));
        if (fs.existsSync(slideshowPath)) {
          const files = fs.readdirSync(slideshowPath);
          console.log('📸 Files in directory:', files);
        }

        // Upload slideshow images to Supabase
        const uploadResult = await uploadAndSaveGeneratedSlideshow(
          userId,
          slideshowPath,
          fileName,
          imageCount,
          style,
          {
            hookMode: hookMode,
            selectedRandomHook: hookMode === 'first' ? selectedRandomHook : undefined,
            perImageHooks: hookMode === 'each' ? Object.fromEntries(perImageHooks) : undefined,
            images: generatedImages,
            uniqueSeed: uniqueSeed
          }
        );

        if (uploadResult) {
          supabaseUrl = uploadResult.file_url;
          console.log('✅ Slideshow saved to Supabase:', supabaseUrl);

          // Replace local paths with Supabase URLs
          generatedImages = [];
          for (let i = 1; i <= imageCount; i++) {
            generatedImages.push(`${supabaseUrl}/part_${i}.png`);
          }
          console.log('✅ Updated image URLs to Supabase paths:', generatedImages);
        } else {
          console.error('❌ Upload result is null - slideshow not saved to Supabase');
        }
      } catch (error) {
        console.error('❌ Failed to save slideshow to Supabase:', error);
        // Ne pas faire échouer la requête si Supabase échoue
      }
    } else {
      console.log('⚠️ No user ID - slideshow will not be saved to Supabase');
    }

    // Retourner les images générées avec les informations de hook
    return NextResponse.json({
      success: true,
      images: generatedImages, // Now contains Supabase URLs if upload succeeded
      slideshowId: `slideshow-${timestamp}`,
      hookMode: hookMode,
      selectedRandomHook: hookMode === 'first' ? selectedRandomHook : undefined,
      perImageHooks: hookMode === 'each' ? Object.fromEntries(perImageHooks) : undefined,
      hookStyle: style,
      uniqueSeed: uniqueSeed,
      supabaseUrl: supabaseUrl,
      message: 'Slideshow created successfully with intelligent randomization'
    });

  } catch (error: any) {
    console.error('Error in create-slideshow:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 });
  }
}