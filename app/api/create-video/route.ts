import { NextResponse } from 'next/server';
import { updateProgress, sendProgressToAPI } from '@/lib/progress';
import { uploadAndSaveGeneratedVideo } from '@/lib/upload-generated-media';
import { createClient } from '@supabase/supabase-js';

// CONDITIONNEMENT DES IMPORTS NATIFS
// Ces imports ne seront utilisés que côté serveur, pas pendant la compilation
let pathModule: any = null;
let fsPromises: any = null;
let fs: any = null;
let childProcess: any = null;
let util: any = null;
let nodeFetch: any = null;
let url: any = null;

// Imports conditionnels pour éviter les erreurs pendant la compilation
if (typeof window === 'undefined') {
  try {
    // Import des modules côté serveur seulement
    pathModule = require('path');
    fsPromises = require('fs/promises');
    fs = require('fs');
    childProcess = require('child_process');
    util = require('util');
    url = require('url');
    // Utiliser import() dynamique pour node-fetch
    import('node-fetch').then(module => {
      nodeFetch = module.default;
    });
  } catch (error) {
    console.error('Erreur lors de l\'import des modules natifs:', error);
  }
}

// Des variables de compatibilité pour eviter de modifier tout le code
const join = (...args: any[]) => pathModule ? pathModule.join(...args) : '';
const basename = (path: string) => pathModule ? pathModule.basename(path) : path;
const mkdir = async (path: string, options?: any) => fsPromises ? fsPromises.mkdir(path, options) : null;
const writeFile = async (path: string, data: any) => fsPromises ? fsPromises.writeFile(path, data) : null;
const readFile = async (path: string) => fsPromises ? fsPromises.readFile(path) : Buffer.from('');
const existsSync = (path: string) => fs ? fs.existsSync(path) : false;
const statSync = (path: string) => fs ? fs.statSync(path) : { size: 0 };
const readdirSync = (path: string) => fs ? fs.readdirSync(path) : [];
const readFileSync = (path: string) => fs ? fs.readFileSync(path) : Buffer.from('');
const writeFileSync = (path: string, data: any) => fs ? fs.writeFileSync(path, data) : null;
const unlinkSync = (path: string) => fs ? fs.unlinkSync(path) : null;
const exec = childProcess ? childProcess.exec : () => {};
const execPromise = util ? util.promisify(exec) : async () => ({ stdout: '', stderr: '' });
const fileURLToPath = (path: string) => url ? url.fileURLToPath(path) : path;

// Importer les helpers pour l'export statique
import { dynamic, generateStaticParams } from '../generateStaticParamsHelper';
// Re-exporter pour cette route
export { dynamic, generateStaticParams };

export const runtime = 'nodejs'; // Forcer l'utilisation du runtime Node.js

// Initialize Supabase client - only if credentials are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseAdmin = (supabaseUrl && supabaseServiceKey) ? createClient(supabaseUrl, supabaseServiceKey) : null;

// Fonction pour créer un dossier s'il n'existe pas
async function ensureDirectoryExists(path: string) {
  if (!existsSync(path)) {
    await mkdir(path, { recursive: true });
  }
}

// Fonction pour générer une durée aléatoire
function getRandomDuration(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10; // Arrondi à 1 décimale
}

// Fonction pour déterminer si un fichier est une image
function isImageFile(filePath: string): boolean {
  const ext = pathModule ? pathModule.extname(filePath).toLowerCase() : '';
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext);
}

export async function POST(req: Request) {
  try {
    // Get the Authorization header to identify the user
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    
    if (supabaseAdmin && authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
      }
    }
    
    const data = await req.json();
    console.log("🔴 DÉMARRAGE DE LA CRÉATION DE VIDÉO - Timestamp:", Date.now());
    console.log("🔍 DÉTAILS DES MEDIAS REÇUS:");
    console.log("🔸 Part1 (média uploadé) type:", data.part1?.type);
    console.log("🔸 Part2 type:", data.part2?.type);
    console.log("🔸 Part1 URL (premiers 50 car.):", data.part1?.url?.substring(0, 50) + "...");
    console.log("🔸 Part2 URL (premiers 50 car.):", data.part2?.url?.substring(0, 50) + "...")

    // Vérifier si nous sommes dans l'environnement Netlify
    const isNetlify = process.env.NETLIFY === 'true' || process.env.NEXT_PUBLIC_NETLIFY_DEPLOYMENT === 'true';
    console.log("Environnement Netlify détecté:", isNetlify);

    // Si nous sommes sur Netlify, rediriger vers la fonction Netlify
    if (isNetlify) {
      console.log("Redirection vers la fonction Netlify video-processing");
      try {
        const netlifyResponse = await fetch('/.netlify/functions/video-processing', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            operation: 'generateVideo', 
            options: data 
          }),
        });

        if (!netlifyResponse.ok) {
          const errorText = await netlifyResponse.text();
          console.error("Erreur de la fonction Netlify:", errorText);
          return NextResponse.json({ 
            success: false, 
            error: `Erreur du service Netlify: ${errorText || netlifyResponse.statusText}` 
          }, { status: netlifyResponse.status });
        }

        const result = await netlifyResponse.json();
        console.log("Réponse de la fonction Netlify:", result);
        return NextResponse.json(result);
      } catch (error) {
        console.error("Erreur lors de l'appel à la fonction Netlify:", error);
        return NextResponse.json({ 
          success: false, 
          error: `Erreur de communication avec le service Netlify: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
        }, { status: 500 });
      }
    }

    // Continuer avec le traitement local si nous ne sommes pas sur Netlify
    // Vérifier si les URLs contiennent des mots clés spécifiques
    const part1IsDataUrl = data.part1?.url?.startsWith('data:') || false;
    const part1IsImageUrl = part1IsDataUrl && data.part1?.url?.includes('data:image');
    const part1IsVideoUrl = part1IsDataUrl && data.part1?.url?.includes('data:video');
    const part1IsLocalStorage = data.part1?.url?.includes('local_storage') || false;
    
    console.log("🔍 ANALYSE URL PART 1:");
    console.log("Est data:URL?", part1IsDataUrl);
    console.log("Est image?", part1IsImageUrl);
    console.log("Est vidéo?", part1IsVideoUrl);
    console.log("Est local_storage?", part1IsLocalStorage);
    
    // Extraire les données avec des valeurs par défaut
    const hook = data.hook || {};
    
    // Assignation directe des variables (sans inversion)
    const part1 = data.part1 || { url: '', type: 'image', duration: { min: 4, max: 6 } };  // Part 1
    const part2Array = Array.isArray(data.part2) ? data.part2 : [data.part2 || { url: '', type: 'image', duration: { min: 3, max: 6 } }];  // Part 2 (array)
    const song = data.song || { url: '' };
    
    // Vérifier et limiter le nombre de médias Part 2
    if (part2Array.length > 50) {
        console.warn("Plus de 50 médias détectés pour Part 2. Limitation aux 50 premiers.");
        part2Array.length = 50;
    }
    
    // Extraire les durées depuis les données
    const part1MinDuration = parseFloat(data.part1?.duration?.min || '4');
    const part1MaxDuration = parseFloat(data.part1?.duration?.max || '6');
    const part2MinDuration = parseFloat(data.part2Duration?.min || '3');
    const part2MaxDuration = parseFloat(data.part2Duration?.max || '6');
    
    console.log("IMPORTANT - Durées configurées:");
    console.log(`Part 1: ${part1MinDuration}s - ${part1MaxDuration}s`);
    console.log(`Part 2: ${part2MinDuration}s - ${part2MaxDuration}s`);
    console.log(`Nombre de médias Part 2: ${part2Array.length}`);
    
    // Générer une durée aléatoire pour Part 1
    const part1Duration = getRandomDuration(part1MinDuration, part1MaxDuration);
    
    // Générer des durées aléatoires pour chaque média de Part 2
    const part2Durations = part2Array.map(() => getRandomDuration(part2MinDuration, part2MaxDuration));
    
    console.log("Durées générées:");
    console.log(`Part 1: ${part1Duration}s`);
    console.log("Part 2 (durées individuelles):", part2Durations);
    
    // Sélectionner aléatoirement un média de Part 2 et sa durée
    const randomIndex = Math.floor(Math.random() * part2Array.length);
    const selectedPart2 = part2Array[randomIndex];
    const selectedPart2Duration = part2Durations[randomIndex];
    
    console.log(`Média Part 2 sélectionné: index ${randomIndex}, durée ${selectedPart2Duration}s`);
    
    console.log("IMPORTANT - Variables alignées avec l'interface:");
    console.log("part1:", part1.type);
    console.log("part2:", selectedPart2.type);
    console.log("song:", song);

    // Vérifier si les URLs sont définies et valides
    if (!part1.url || part1.url === '') {
      console.error("Aucun média uploadé pour Part 1");
      return NextResponse.json({ 
        success: false, 
        error: "No media uploaded. Upload videos or images to continue." 
      }, { status: 400 });
    }
    
    if (!selectedPart2.url || selectedPart2.url === '') {
      console.error("Aucun média uploadé pour Part 2");
      return NextResponse.json({ 
        success: false, 
        error: "No media uploaded. Upload videos or images to continue." 
      }, { status: 400 });
    }
    
    // Check if no-music option is selected
    const isNoMusicSelected = song.id === 'no-music' || (!song.url || song.url === '');
    
    if (!isNoMusicSelected && (!song.url || song.url === '')) {
      console.error("Aucune musique uploadée");
      return NextResponse.json({ 
        success: false, 
        error: "No music uploaded. Upload a music file or select 'Without music' to continue." 
      }, { status: 400 });
    }

    // Créer le dossier de sortie s'il n'existe pas
    // Nous utilisons un dossier public temporaire qui sera accessible
    // depuis le navigateur mais nettoyé régulièrement
    const tempOutputDir = join(process.cwd(), 'public', 'temp-videos');
    await ensureDirectoryExists(tempOutputDir);

    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const outputFileName = `video_${timestamp}.mp4`;
    const outputPath = join(tempOutputDir, outputFileName);

    // Sauvegarder les fichiers temporaires si ce sont des URLs de données
    const tempDir = join(process.cwd(), 'temp');
    await ensureDirectoryExists(tempDir);

    // Fonction pour sauvegarder une URL en fichier temporaire
    async function saveUrlToFile(url: string, prefix: string): Promise<string> {
      try {
        console.log(`---DÉBUT TRAITEMENT URL [${prefix}]---`);
        
        // Vérifier que url est une chaîne de caractères
        if (typeof url !== 'string') {
          console.error(`URL is not a string for ${prefix}:`, typeof url, url);
          throw new Error(`Invalid URL type for ${prefix}: expected string, got ${typeof url}`);
        }
        
        console.log(`URL reçue pour ${prefix}:`, url.substring(0, 50) + (url.length > 50 ? '...' : ''));
        
        // Vérifier si c'est une data URL d'image
        if (url.startsWith('data:image')) {
          console.log(`Data URL d'image détectée pour ${prefix}`);
          // Le reste du code pour traiter les data URLs...
          try {
            const parts = url.split('base64,');
            if (parts.length >= 2) {
              const base64Data = parts[1];
              const mimeType = parts[0].split(':')[1]?.split(';')[0] || '';
              
              // Déterminer l'extension
              let extension = '.jpg';
              if (mimeType.includes('png')) extension = '.png';
              else if (mimeType.includes('webp')) extension = '.webp';
              
              // Créer le fichier
              const buffer = Buffer.from(base64Data, 'base64');
              const tempPath = join(tempDir, `${prefix}_${timestamp}${extension}`);
              writeFileSync(tempPath, buffer);
              console.log(`✅ Image sauvegardée à: ${tempPath}`);
              return tempPath;
            }
          } catch (error) {
            console.error(`Erreur lors du traitement de l'image uploadée:`, error);
            throw error;
          }
        }
        
        // NOUVEAU: Chemin direct pour Part 2 en tant qu'image
        if (prefix === 'part2' && url.startsWith('data:image')) {
          console.log(`⭐ Traitement direct d'une image pour Part 2`);
          try {
            // Extraire le type MIME et les données
            let base64Data = '';
            let mimeType = '';
            
            // Essayer différents formats de data URL
            if (url.includes('base64,')) {
              // Format standard: data:image/jpeg;base64,/9j/4AAQSkZJRg...
              const parts = url.split('base64,');
              if (parts.length >= 2) {
                base64Data = parts[1];
                const mimeParts = parts[0].split(':')[1]?.split(';')[0];
                mimeType = mimeParts || '';
                console.log(`Type MIME détecté pour ${prefix}: ${mimeType}`);
              }
            }
            
            if (!base64Data) {
              throw new Error('Format data URL invalide: impossible d\'extraire les données');
            }
            
            // Déterminer l'extension à partir du type MIME
            let extension = '.jpg'; // Par défaut
            if (mimeType.includes('jpeg')) {
              extension = '.jpg';
            } else if (mimeType.includes('png')) {
              extension = '.png';
            } else if (mimeType.includes('webp')) {
              extension = '.webp';
            }
            
            // Créer un buffer à partir des données base64
            const buffer = Buffer.from(base64Data, 'base64');
            console.log(`Taille des données pour ${prefix}: ${buffer.length} octets`);
            
            // Créer un nom unique pour Part 2
            const tempPath = join(tempDir, `${prefix}_image_${timestamp}${extension}`);
            
            // Écrire le fichier
            writeFileSync(tempPath, buffer);
            console.log(`⭐ Image Part 2 sauvegardée à: ${tempPath}`);
            
            return tempPath;
          } catch (error) {
            console.error(`Erreur lors du traitement direct de l'image Part 2:`, error);
            throw error;
          }
        }
        
        // Si c'est une URL de données (data:)
        if (url.startsWith('data:')) {
          console.log(`URL data: détectée pour ${prefix}, conversion en fichier`);
          
          try {
            // Extraire le type MIME et les données
            let base64Data = '';
            let mimeType = '';
            
            // Essayer différents formats de data URL
            if (url.includes('base64,')) {
              // Format standard: data:image/jpeg;base64,/9j/4AAQSkZJRg...
              const parts = url.split('base64,');
              if (parts.length >= 2) {
                base64Data = parts[1];
                const mimeParts = parts[0].split(':')[1]?.split(';')[0];
                mimeType = mimeParts || '';
                console.log(`Type MIME détecté pour ${prefix}: ${mimeType}`);
              }
            }
            
            if (!base64Data) {
              throw new Error('Format data URL invalide: impossible d\'extraire les données');
            }
            
            // Déterminer l'extension à partir du type MIME
            let extension = '.jpg'; // Par défaut
            if (mimeType.includes('jpeg')) {
              extension = '.jpg';
            } else if (mimeType.includes('png')) {
              extension = '.png';
            } else if (mimeType.includes('webp')) {
              extension = '.webp';
            } else if (mimeType.includes('video')) {
              extension = '.mp4';
            }
            
            // Créer un buffer à partir des données base64
            const buffer = Buffer.from(base64Data, 'base64');
            console.log(`Taille des données pour ${prefix}: ${buffer.length} octets`);
            
            // Créer un nom unique pour le fichier
            const tempPath = join(tempDir, `${prefix}_${timestamp}${extension}`);
            
            // Écrire le fichier
            writeFileSync(tempPath, buffer);
            console.log(`✅ Fichier sauvegardé à: ${tempPath}`);
            
            return tempPath;
          } catch (error) {
            console.error(`Erreur lors du traitement de la data URL pour ${prefix}:`, error);
            throw error;
          }
        }
        
        // Si c'est une URL blob ou une URL locale avec local_storage
        else if (typeof url === 'string' && (url.startsWith('blob:') || url.includes('local_storage'))) {
          console.log(`URL ${url.substring(0, 30)}... détectée pour ${prefix}`);
          
          // Si c'est une URL local_storage
          if (url.includes('local_storage')) {
            try {
              // Log tous les fichiers du dossier temporaire pour débugger
              console.log('⚠️ DÉPANNAGE: Listage de tous les fichiers du dossier temporaire');
              const allTempFiles = readdirSync(tempDir);
              console.log(`Fichiers dans ${tempDir}:`, allTempFiles);
              
              // Extraire le nom du fichier de l'URL
              console.log(`URL complète: ${url}`);
              
              // Vérifier que url est une chaîne de caractères
              if (typeof url !== 'string') {
                console.error('URL is not a string:', typeof url, url);
                throw new Error(`Invalid URL type: expected string, got ${typeof url}`);
              }
              
              // Extraire le nom du fichier
              let fileName = '';
              if (url.includes('_IMG_')) {
                const imgIndex = url.indexOf('_IMG_');
                if (imgIndex > 0) {
                  fileName = 'IMG_' + url.substring(imgIndex + 5);
                  console.log(`Nom du fichier extrait: ${fileName}`);
                }
              } else {
                fileName = url.split('/').pop() || '';
                console.log(`Nom du fichier extrait: ${fileName}`);
              }
              
              // Si le nom du fichier est vide, utiliser l'URL complète
              if (!fileName) {
                fileName = url.split('/').pop() || '';
                console.log(`Fallback: utilisation de l'URL complète comme nom de fichier: ${fileName}`);
              }
              
              // Chercher dans différents dossiers possibles
              const possiblePaths = [
                join(process.cwd(), 'public', 'uploads', fileName || ''),
                join(process.cwd(), 'temp', fileName || ''),
                join(tempDir, fileName || ''),
                join(process.cwd(), 'public', fileName || '')
              ];
              
              console.log('Recherche dans les dossiers suivants:');
              for (const path of possiblePaths) {
                console.log(`- ${path}`);
              }
              
              // Essayer chaque chemin possible
              for (const possiblePath of possiblePaths) {
                console.log(`Vérification du chemin: ${possiblePath}`);
                if (existsSync(possiblePath)) {
                  console.log(`Fichier trouvé à ${possiblePath}`);
                  const fileData = await readFile(possiblePath);
                  
                  // Déterminer l'extension
                  const extension = pathModule ? pathModule.extname(possiblePath).toLowerCase() || '.jpg' : '';
                  const tempPath = join(tempDir, `${prefix}_${timestamp}${extension}`);
                  
                  await writeFile(tempPath, fileData);
                  console.log(`Fichier local sauvegardé pour ${prefix} à ${tempPath}`);
                  
                  // Si c'est un fichier vidéo, supprimer l'audio
                  if (extension.match(/\.(mp4|mov|avi|webm)$/i)) {
                    console.log(`Suppression de l'audio pour la vidéo ${prefix}`);
                    const noAudioPath = join(tempDir, `${prefix}_noaudio_${timestamp}${extension}`);
                    try {
                      await execPromise(`ffmpeg -i "${tempPath}" -c:v copy -an "${noAudioPath}"`);
                      console.log(`Audio supprimé pour ${prefix}, nouveau fichier: ${noAudioPath}`);
                      return noAudioPath;
                    } catch (error) {
                      console.error(`Erreur lors de la suppression de l'audio pour ${prefix}:`, error);
                      return tempPath;
                    }
                  }
                  
                  return tempPath;
                }
              }
              
              // Si aucun fichier n'est trouvé, lever une erreur
              console.log(`⚠️ Aucun fichier trouvé pour ${prefix}`);
              throw new Error(`Fichier non trouvé pour ${prefix}. Veuillez vous assurer que le média est correctement uploadé.`);
              
            } catch (error) {
              console.error(`Erreur lors de la recherche du fichier local ${url}:`, error);
              throw error;
            }
          }
          
          // Si c'est une URL blob, lever une erreur car nous ne pouvons pas la traiter côté serveur
          throw new Error(`Les URLs blob ne peuvent pas être traitées côté serveur pour ${prefix}`);
        }
        
        // Si c'est une URL locale (commence par /)
        else if (url.startsWith('/')) {
          console.log(`URL locale détectée pour ${prefix}: ${url}`);
          // Convertir en chemin absolu
          const absolutePath = join(process.cwd(), 'public', url.slice(1));
          console.log(`Chemin absolu pour ${prefix}: ${absolutePath}`);
          
          // Vérifier si le fichier existe
          if (!existsSync(absolutePath)) {
            console.error(`Fichier local non trouvé: ${absolutePath}`);
            throw new Error(`Fichier local non trouvé: ${absolutePath}`);
          }
          
          // Si c'est un fichier vidéo (part1 ou part2), supprimer l'audio
          if ((prefix === 'part1' || prefix === 'part2') && absolutePath.match(/\.(mp4|mov|avi|webm)$/i)) {
            console.log(`Suppression de l'audio pour la vidéo ${prefix}`);
            const noAudioPath = join(tempDir, `${prefix}_noaudio_${timestamp}${pathModule ? pathModule.extname(absolutePath) : '.jpg'}`);
            try {
              await execPromise(`ffmpeg -i "${absolutePath}" -c:v copy -an "${noAudioPath}"`);
              console.log(`Audio supprimé pour ${prefix}, nouveau fichier: ${noAudioPath}`);
              return noAudioPath;
            } catch (error) {
              console.error(`Erreur lors de la suppression de l'audio pour ${prefix}:`, error);
              // En cas d'erreur, utiliser le fichier original
              return absolutePath;
            }
          }
          
          return absolutePath;
        }
        
        // Si c'est une URL HTTP(S)
        else if (url.startsWith('http')) {
          console.log(`URL HTTP détectée pour ${prefix}: ${url.substring(0, 30)}...`);
          const response = await nodeFetch(url);
          const buffer = await response.buffer();
          
          // Déterminer l'extension à partir du type de contenu
          let extension = '.mp4';
          const contentType = response.headers.get('content-type');
          if (contentType) {
            if (contentType.includes('image/jpeg')) {
              extension = '.jpg';
            } else if (contentType.includes('image/png')) {
              extension = '.png';
            } else if (contentType.includes('image/gif')) {
              extension = '.gif';
            } else if (contentType.includes('image/webp')) {
              extension = '.webp';
            } else if (contentType.includes('video')) {
              extension = '.mp4';
            } else if (contentType.includes('audio')) {
              extension = '.mp3';
            }
          }
          
          const tempPath = join(tempDir, `${prefix}_${timestamp}${extension}`);
          await writeFile(tempPath, buffer);
          console.log(`Fichier HTTP sauvegardé pour ${prefix} à ${tempPath}`);
          
          // Si c'est un fichier vidéo (part1 ou part2), supprimer l'audio
          if ((prefix === 'part1' || prefix === 'part2') && extension === '.mp4') {
            console.log(`Suppression de l'audio pour la vidéo ${prefix}`);
            const noAudioPath = join(tempDir, `${prefix}_noaudio_${timestamp}${extension}`);
            try {
              await execPromise(`ffmpeg -i "${tempPath}" -c:v copy -an "${noAudioPath}"`);
              console.log(`Audio supprimé pour ${prefix}, nouveau fichier: ${noAudioPath}`);
              return noAudioPath;
            } catch (error) {
              console.error(`Erreur lors de la suppression de l'audio pour ${prefix}:`, error);
              // En cas d'erreur, utiliser le fichier original
              return tempPath;
            }
          }
          
          return tempPath;
        }
        
        // Sinon, on suppose que c'est un chemin de fichier
        console.log(`URL inconnue pour ${prefix}, supposée être un chemin de fichier: ${url}`);
        
        // Si c'est un fichier vidéo (part1 ou part2), supprimer l'audio
        if ((prefix === 'part1' || prefix === 'part2') && url.match(/\.(mp4|mov|avi|webm)$/i)) {
          console.log(`Suppression de l'audio pour la vidéo ${prefix}`);
          const noAudioPath = join(tempDir, `${prefix}_noaudio_${timestamp}${pathModule ? pathModule.extname(url) : '.jpg'}`);
          try {
            await execPromise(`ffmpeg -i "${url}" -c:v copy -an "${noAudioPath}"`);
            console.log(`Audio supprimé pour ${prefix}, nouveau fichier: ${noAudioPath}`);
            return noAudioPath;
          } catch (error) {
            console.error(`Erreur lors de la suppression de l'audio pour ${prefix}:`, error);
            // En cas d'erreur, utiliser le fichier original
            return url;
          }
        }
        
        return url;
      } catch (error) {
        console.error(`Erreur lors de la sauvegarde de l'URL ${url} pour ${prefix}:`, error);
        throw error; // Propager l'erreur au lieu de créer un fichier par défaut
      }
    }

    // Sauvegarder les fichiers si nécessaire
    console.log("Sauvegarde des fichiers d'entrée...");
    
    // VÉRIFICATION POUR PART 1
    console.log("🔍 VÉRIFICATION POUR PART 1:");
    console.log("Part1 URL (30 premiers car.):", part1.url.substring(0, 30));
    console.log("Part1 type:", part1.type);
    
    const part1Path = await saveUrlToFile(part1.url, 'part1');
    
    // VÉRIFICATION POUR PART 2
    console.log("🔍 VÉRIFICATION POUR PART 2:");
    console.log("Part2 URL (30 premiers car.):", selectedPart2.url.substring(0, 30));
    console.log("Part2 type:", selectedPart2.type);
    
    // Forcer l'utilisation de l'URL correcte pour Part2
    let part2SafeUrl = selectedPart2.url;
    // Si Part2 est une URL locale mais pas un data:URL, vérifier qu'elle est valide
    if (!part2SafeUrl.startsWith('data:') && !part2SafeUrl.startsWith('http')) {
      console.log("⚠️ URL Part2 non standard détectée, vérification supplémentaire requise");
    }
    
    const part2Path = await saveUrlToFile(part2SafeUrl, 'part2');
    const songPath = isNoMusicSelected ? null : await saveUrlToFile(song.url, 'song');
    
    // Fonction pour vérifier si un fichier existe et créer un fichier par défaut si nécessaire
    const checkFile = async (filePath: string, name: string) => {
      try {
        console.log(`-------- VÉRIFICATION FICHIER ${name}: ${filePath} --------`);
        
        // Vérifier si le fichier existe et a une taille correcte
        if (existsSync(filePath) && statSync(filePath).size > 0) {
          console.log(`Fichier ${name} existe et est valide: ${filePath}`);
          return filePath;
        }
        
        console.error(`Fichier ${name} invalide ou introuvable: ${filePath}`);
        throw new Error(`Fichier ${name} invalide ou introuvable: ${filePath}`);
        
      } catch (error) {
        console.error(`Erreur lors de la vérification du fichier ${name}:`, error);
        throw error;
      }
    };
    
    // Vérifier et corriger les chemins de fichiers
    const checkedPart1Path = await checkFile(part1Path, 'part1');
    const checkedPart2Path = await checkFile(part2Path, 'part2');
    const checkedSongPath = isNoMusicSelected ? null : await checkFile(songPath!, 'song');
    
    // Nettoyer les chemins de fichiers (supprimer les espaces supplémentaires)
    const cleanPath = (path: string) => path.replace(/\s+/g, ' ').trim();
    
    const cleanPart1Path = cleanPath(checkedPart1Path);
    const cleanPart2Path = cleanPath(checkedPart2Path);
    const cleanSongPath = checkedSongPath ? cleanPath(checkedSongPath) : null;
    
    console.log("Chemins des fichiers nettoyés:");
    console.log("Part 1:", cleanPart1Path);
    console.log("Part 2:", cleanPart2Path);
    console.log("Song:", cleanSongPath || "No music selected");
    
    // Vérifier si les fichiers entrée sont des images ou des vidéos
    const isPart1Image = isImageFile(cleanPart1Path);
    const isPart2Image = isImageFile(cleanPart2Path);
    
    // Vérifier si le fichier audio contient réellement un flux audio
    let hasSongAudio = false;
    if (!isNoMusicSelected && cleanSongPath) {
      try {
        // Utiliser ffprobe pour vérifier si le fichier contient un flux audio
        const { stdout } = await execPromise(`ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "${cleanSongPath}"`);
        hasSongAudio = stdout.trim().includes('audio');
        console.log(`Le fichier song contient-il de l'audio ? ${hasSongAudio ? 'Oui' : 'Non'}`);
      } catch (error) {
        console.error("Erreur lors de la vérification du flux audio:", error);
        hasSongAudio = false;
      }
    } else {
      console.log("Pas de musique sélectionnée - création vidéo sans audio");
    }
    
    // Définir une taille cible uniforme pour toutes les vidéos/images
    const targetWidth = 1080;
    const targetHeight = 1920; // Format 9:16 pour TikTok/Instagram
    
    console.log(`Dimensions cibles pour la vidéo: ${targetWidth}x${targetHeight}`);
    console.log(`Durées des parties - Part 1: ${part1Duration}s, Part 2: ${selectedPart2Duration}s, Total: ${part1Duration + selectedPart2Duration}s`);

    // Vérification détaillée des fichiers d'entrée
    console.log("Vérification des fichiers d'entrée:");
    console.log(`Part 1 (${isPart1Image ? 'Image' : 'Vidéo'}): ${cleanPart1Path}`);
    console.log(`Part 2 (${isPart2Image ? 'Image' : 'Vidéo'}): ${cleanPart2Path}`);
    console.log(`Song: ${cleanSongPath || "No music selected"}`);
    
    // Créer des fichiers intermédiaires pour chaque partie
    const part1Scaled = join(tempDir, `part1_scaled_${timestamp}.mp4`);
    const part2Scaled = join(tempDir, `part2_scaled_${timestamp}.mp4`);
    
    // Commandes pour redimensionner et préparer chaque partie
    let part1Cmd = '';
    let part2Cmd = '';
    
    if (isPart1Image) {
      console.log(`Conversion de l'image Part 1 en vidéo de ${part1Duration}s`);
      part1Cmd = `ffmpeg -loop 1 -i "${cleanPart1Path}" -t ${part1Duration} -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920:0:${part1.position === 'top' ? '0' : part1.position === 'bottom' ? 'ih-1920' : '(ih-1920)/2'},setsar=1" -metadata:s:v:0 rotate=0 -c:v libx264 -pix_fmt yuv420p -r 30 "${part1Scaled}"`;
    } else {
      // Si Part 1 est une vidéo, la redimensionner et limiter sa durée
      console.log(`Redimensionnement de la vidéo Part 1 et limitation à ${part1Duration}s`);
      part1Cmd = `ffmpeg -noautorotate -i "${cleanPart1Path}" -t ${part1Duration} -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920:0:${part1.position === 'top' ? '0' : part1.position === 'bottom' ? 'ih-1920' : '(ih-1920)/2'},setsar=1" -metadata:s:v:0 rotate=0 -c:v libx264 -pix_fmt yuv420p -r 30 "${part1Scaled}"`;
    }
    
    if (isPart2Image) {
      // Si Part 2 est une image, la convertir en vidéo avec la durée spécifiée
      console.log(`Conversion de l'image Part 2 en vidéo de ${selectedPart2Duration}s`);
      part2Cmd = `ffmpeg -loop 1 -i "${cleanPart2Path}" -t ${selectedPart2Duration} -vf "scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight}" -metadata:s:v:0 rotate=0 -c:v libx264 -pix_fmt yuv420p -r 30 "${part2Scaled}"`;
    } else {
      // Si Part 2 est une vidéo, la redimensionner et limiter sa durée
      console.log(`Redimensionnement de la vidéo Part 2 à ${selectedPart2Duration}s`);
      part2Cmd = `ffmpeg -noautorotate -i "${cleanPart2Path}" -t ${selectedPart2Duration} -vf "scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight}" -metadata:s:v:0 rotate=0 -c:v libx264 -pix_fmt yuv420p -r 30 "${part2Scaled}"`;
    }
    
    // Exécuter les commandes pour préparer les parties
    console.log('Préparation de Part 1...');
    console.log('Executing FFmpeg command:', part1Cmd);
    await execPromise(part1Cmd);
    
    console.log('Préparation de Part 2...');
    console.log('Executing FFmpeg command:', part2Cmd);
    await execPromise(part2Cmd);
    
    // APPROCHE DIRECTE: Utiliser directement les fichiers préparés
    console.log('APPROCHE DIRECTE: Concaténation directe dans l\'ordre NORMAL');
    
    // Commande finale utilisant directement les fichiers dans l'ordre NORMAL
    let finalCommand = '';
    
    if (hasSongAudio) {
      // Ordre normal: part1 d'abord (input 0), puis part2 (input 1)
      finalCommand = `ffmpeg -i "${part1Scaled}" -i "${part2Scaled}" -i "${cleanSongPath}" ` +
        `-filter_complex "[0:v][1:v]concat=n=2:v=1:a=0[outv];[2:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[outa]" ` +
        `-map "[outv]" -map "[outa]" -c:v libx264 -c:a aac -shortest "${outputPath}"`;
      
      console.log('ORDRE DE CONCATÉNATION:');
      console.log(`1er (Input 0): ${part1Scaled} (Part 1)`);
      console.log(`2nd (Input 1): ${part2Scaled} (Part 2)`);
    } else {
      finalCommand = `ffmpeg -i "${part1Scaled}" -i "${part2Scaled}" ` +
        `-filter_complex "[0:v][1:v]concat=n=2:v=1:a=0[outv]" ` +
        `-map "[outv]" -c:v libx264 "${outputPath}"`;
      
      console.log('ORDRE DE CONCATÉNATION:');
      console.log(`1er (Input 0): ${part1Scaled} (Part 1)`);
      console.log(`2nd (Input 1): ${part2Scaled} (Part 2)`);
    }
    
    console.log('Executing final FFmpeg command:', finalCommand);

    // Exécuter la commande FFmpeg
    try {
      // Mettre à jour la progression à 0%
      updateProgress(0);
      
      // Exécuter la commande
      const { stdout, stderr } = await execPromise(finalCommand);
      
      console.log('FFmpeg stdout:', stdout);
      console.log('FFmpeg stderr:', stderr);
      
      // Si le hook est défini, générer l'image du hook et l'appliquer à la vidéo
      if (hook && hook.text) {
        console.log('Ajout du hook à la vidéo...');
        
        // Générer l'image du hook avec Puppeteer
        const hookImagePath = join(tempDir, `hook_${timestamp}.png`);
        
        // Utiliser Puppeteer pour générer l'image du hook avec fond transparent
        const puppeteer = eval('require')('puppeteer');
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        
        // Configurer la taille de la page pour correspondre à la taille de la vidéo
        await page.setViewport({
          width: 1080,
          height: 1920,
          deviceScaleFactor: 1 // Réduire le deviceScaleFactor pour éviter les problèmes de résolution
        });
        
        // Calculer une taille de police adaptée à la largeur de la vidéo
        console.log('[Hook] Processing hook with style:', hook.style, 'position:', hook.position, 'offset:', hook.offset);
        const fontSize = hook.style === 1 ? 60 : hook.style === 4 ? 50 : 75; // Style 1 (Normal) et 4 (Normal New) plus petits que Style 2/3 (Background)

        // Définir les styles spécifiques pour chaque type
        const normalStyle = `
          font-size: 60px;
          line-height: 1.2;
          display: inline-block;
          width: 100%;
          max-width: 80%;
          margin: 0 auto;
          text-align: center;
          color: #fff;
          font-weight: normal;
          text-shadow: -2.8px -2.8px 0 #000, 2.8px -2.8px 0 #000, -2.8px 2.8px 0 #000, 2.8px 2.8px 0 #000;
          padding: 0.8rem 1.5rem 1rem 1.5rem;
          background: transparent;
          filter: none;
        `;

        const backgroundWhiteStyle = `
          font-size: 65px;
          line-height: 1.2;
          display: inline;
          box-decoration-break: clone;
          background: #fff;
          padding: 0.1rem 1.5rem 0.75rem 1.5rem;
          filter: url('#goo');
          max-width: 80%;
          text-align: center;
          color: #000;
          font-weight: normal;
        `;
        
        const backgroundBlackStyle = `
          font-size: 65px;
          line-height: 1.2;
          display: inline;
          box-decoration-break: clone;
          background: #000;
          padding: 0.1rem 1.5rem 0.75rem 1.5rem;
          filter: url('#goo');
          max-width: 80%;
          text-align: center;
          color: #fff;
          font-weight: normal;
        `;

        const normalNewStyle = `
          font-size: 50px;
          line-height: 1.2;
          display: inline-block;
          width: 100%;
          max-width: 80%;
          margin: 0 auto;
          text-align: center;
          color: #fff;
          font-weight: normal;
          text-shadow: -2.8px -2.8px 0 #000, 2.8px -2.8px 0 #000, -2.8px 2.8px 0 #000, 2.8px 2.8px 0 #000;
          padding: 0.8rem 1.5rem 1rem 1.5rem;
          background: transparent;
          filter: none;
        `;

        // Créer le HTML avec le hook
        const hookHtml = `
          <html>
            <head>
              <style>
                :root {
                  --color-bg: transparent;
                  --font: 'TikTok Display Medium', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
                }
                
                @font-face {
                  font-family: 'TikTok Display Medium';
                  src: url('${join(process.cwd(), 'public/fonts/TikTokDisplayMedium.otf')}');
                  font-weight: normal;
                  font-style: normal;
                }

                body {
                  margin: 0;
                  width: 1080px;
                  height: 1920px;
                  display: flex;
                  align-items: ${hook.position === 'top' ? 'flex-start' : hook.position === 'middle' ? 'center' : 'flex-end'};
                  justify-content: center;
                  padding: ${hook.position === 'top' ? '250px' : hook.position === 'bottom' ? '600px' : '0px'} 0;
                  background: var(--color-bg);
                  font-family: var(--font);
                }

                h1 {
                  width: 85%;
                  text-align: center;
                  margin: 0;
                  padding: 0;
                }

                .goo {
                  ${hook.style === 1 ? normalStyle : hook.style === 2 ? backgroundWhiteStyle : hook.style === 4 ? normalNewStyle : backgroundBlackStyle}
                  transform: translateY(${hook.offset}px);
                }

                .goo:focus {
                  outline: 0;
                }
              </style>
            </head>
            <body>
              <h1>
                <div class="goo">${hook.text}</div>
              </h1>

              <svg style="visibility: hidden; position: absolute;" width="0" height="0" xmlns="http://www.w3.org/2000/svg" version="1.1">
                <defs>
                  <filter id="goo">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />    
                    <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
                    <feComposite in="SourceGraphic" in2="goo" operator="atop"/>
                  </filter>
                </defs>
              </svg>
            </body>
          </html>
        `;
        
        // Générer l'image
        await page.setContent(hookHtml);
        await page.screenshot({
          path: hookImagePath,
          omitBackground: true,
          type: 'png'
        });
        
        await browser.close();
        
        console.log(`Image du hook générée: ${hookImagePath}`);
        
        // Appliquer l'image du hook à la vidéo avec FFmpeg
        const videoWithHookPath = join(process.cwd(), 'public', 'generated', `video_with_hook_${timestamp}.mp4`);
        
        // Déterminer la position Y en fonction de la position demandée
        let yPosition = "200"; // Position top avec marge de 200px
        if (hook.position === 'middle') {
          yPosition = "(H-h)/2"; // Centré verticalement
        } else if (hook.position === 'bottom') {
          yPosition = "H-h-600"; // Position bottom avec marge de 600px du bas
        }
        
        // Appliquer le décalage vertical (offset)
        // L'offset est normalisé entre -50 et 50, on le convertit en pixels (-200 à +200)
        const offsetFactor = 8; // Augmenté pour un effet plus prononcé
        const offsetPixels = hook.offset * offsetFactor;
        yPosition = `${yPosition}+${offsetPixels}`;
        
        // Pour les Styles 1 et 4 (texte sans fond), on n'a pas besoin de réduire l'image autant
        const scaleFactor = (hook.style === 1 || hook.style === 4) ? "1.15" : "1";
        
        // Commande pour superposer l'image du hook sur la vidéo avec position et redimensionnement
        const overlayCommand = `ffmpeg -i "${outputPath}" -i "${hookImagePath}" -filter_complex ` +
          `"[1:v]scale=iw*${scaleFactor}:-1[overlay];[0:v][overlay]overlay=(W-w)/2:${yPosition}:format=auto,format=yuv420p[outv]" ` +
          `-map "[outv]" -map 0:a -c:v libx264 -c:a copy "${videoWithHookPath}"`;
        
        console.log('Executing overlay command:', overlayCommand);
        const { stdout: overlayStdout, stderr: overlayStderr } = await execPromise(overlayCommand);
        
        console.log('FFmpeg overlay stdout:', overlayStdout);
        console.log('FFmpeg overlay stderr:', overlayStderr);
        
        // Remplacer la vidéo originale par la vidéo avec hook
        await execPromise(`mv "${videoWithHookPath}" "${outputPath}"`);
        console.log('Vidéo avec hook remplacée');
      }
      
      // Mettre à jour la progression à 100%
      updateProgress(100);
      
      // Après la génération de la vidéo
      let videoPath = `/temp-videos/${outputFileName}`;
      let videoId: string | undefined;
      const expirationTime = Date.now() + (15 * 60 * 1000); // 15 minutes
      
      // Si l'utilisateur est authentifié, uploader vers Supabase
      if (userId) {
        try {
          console.log('Uploading video to Supabase for user:', userId);
          const result = await uploadAndSaveGeneratedVideo(
            userId,
            outputPath,
            outputFileName,
            'standard-model',
            {
              part1Duration,
              part2Duration: selectedPart2Duration,
              totalDuration: part1Duration + selectedPart2Duration,
              hook: hook
            }
          );
          
          if (result) {
            videoPath = result.url;
            videoId = result.id;
            console.log('Video uploaded to Supabase:', videoId);
            
            // Supprimer le fichier local après un upload réussi
            try {
              await fsPromises.unlink(outputPath);
              console.log('Local file deleted after successful upload');
            } catch (deleteError) {
              console.warn('Could not delete local file:', deleteError);
            }
          }
        } catch (uploadError) {
          console.error('Failed to upload to Supabase:', uploadError);
          // Continuer avec l'URL locale si l'upload échoue
        }
      } else {
        // Si pas authentifié, stocker les métadonnées pour le nettoyage
        try {
          const metaFilePath = join(tempOutputDir, `${outputFileName}.meta.json`);
          await writeFile(
            metaFilePath,
            JSON.stringify({
              expires: expirationTime,
              created: Date.now()
            })
          );
          console.log(`Metadata stored for ${outputFileName}, expires in 15 minutes`);
        } catch (error) {
          console.warn('Could not write video metadata file:', error);
        }
      }
      
      return NextResponse.json({ 
        success: true,
        videoPath,
        videoId,
        expiresAt: userId ? undefined : expirationTime,
        part1Duration,
        part2Duration: selectedPart2Duration,
        totalDuration: part1Duration + selectedPart2Duration
      });
    } catch (error) {
      console.error('Error executing FFmpeg command:', error);
      return NextResponse.json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in create-video route:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}