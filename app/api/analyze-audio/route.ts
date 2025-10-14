import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

// Fonction simulée pour vérifier l'authentification
// En production, cette fonction devrait vérifier un token JWT ou une session
function getAuth() {
  // En environnement de développement, autoriser toutes les requêtes
  // En production, on pourrait vérifier un token d'authentification
  return { userId: 'auth-user-id' };
}

// Imports conditionnels pour les modules natifs
let pathModule: any = null;
let fsPromises: any = null;
let osModule: any = null;
let childProcess: any = null;

// Ne charger les modules que côté serveur
if (typeof window === 'undefined') {
  try {
    // Charger les modules natifs de manière conditionnelle
    pathModule = require('path');
    fsPromises = require('fs/promises');
    osModule = require('os');
    childProcess = require('child_process');
  } catch (e) {
    console.warn('Modules natifs non disponibles pendant la compilation', e);
  }
}

// Configuration pour l'environnement Edge
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Forcer l'utilisation du runtime Node.js

// Générer des paramètres statiques vides pour l'export
export function generateStaticParams() {
  return [];
}

export function GET() {
  return NextResponse.json({
    message: "Cette route sera gérée par Netlify Functions en production"
  });
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth();
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Si les modules ne sont pas disponibles (environnement de compilation), retourner une réponse stub
    if (!pathModule || !fsPromises || !osModule || !childProcess) {
      console.warn('Modules natifs requis non disponibles - environnement de compilation');
      return NextResponse.json({
        success: false,
        message: "Cette fonction requiert des modules Node.js qui ne sont disponibles qu'a l'execution",
        duration: 0,
        fileName: "example.mp3",
        fileSize: 0
      });
    }

    const formData = await request.formData();
    const audioFile = formData.get('file') as File;
    
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Créer un répertoire temporaire pour stocker le fichier
    const tempDir = await fsPromises.mkdtemp(pathModule.join(osModule.tmpdir(), 'audio-analyze-'));
    const filePath = pathModule.join(tempDir, audioFile.name);
    
    // Écrire le fichier sur le disque
    const buffer = Buffer.from(await audioFile.arrayBuffer());
    await fsPromises.writeFile(filePath, buffer);
    
    // Utiliser une variable locale pour ffprobe_path que nous chargeons de façon dynamique
    let ffprobePath = '';
    
    // Charger ffprobe uniquement au moment de l'exécution, pas pendant la compilation
    if (process.env.FFPROBE_PATH) {
      ffprobePath = process.env.FFPROBE_PATH;
    } else {
      try {
        // Essayer de charger ffprobe-installer avec eval pour éviter le bundling webpack
        const ffprobeInstaller = eval('require')('@ffprobe-installer/ffprobe');
        if (ffprobeInstaller && ffprobeInstaller.path) {
          ffprobePath = ffprobeInstaller.path;
        }
      } catch (error) {
        console.warn("ffprobe-installer non disponible, essai avec ffprobe système");
        // Essayer d'utiliser ffprobe du système
        ffprobePath = 'ffprobe';
      }
    }
    
    // Vérifier que ffprobePath n'est pas vide
    if (!ffprobePath) {
      ffprobePath = 'ffprobe'; // Fallback vers la commande système
    }
    
    const { execSync } = childProcess;
    
    // Commande pour extraire les métadonnées
    const cmd = `"${ffprobePath}" -v error -show_entries format=duration -of json "${filePath}"`;
    
    try {
      const output = execSync(cmd).toString();
      const data = JSON.parse(output);
      const duration = parseFloat(data.format.duration);
      
      // Nettoyer le fichier temporaire
      await fsPromises.unlink(filePath);
      await fsPromises.rmdir(tempDir);
      
      return NextResponse.json({ 
        success: true, 
        duration: duration,
        fileName: audioFile.name,
        fileSize: audioFile.size
      });
    } catch (error: any) {
      console.error('FFprobe error:', error);
      return NextResponse.json({ 
        success: false, 
        error: `Failed to analyze audio: ${error.message}` 
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error analyzing audio:', error);
    return NextResponse.json({ 
      success: false, 
      error: `Internal server error: ${error.message}` 
    }, { status: 500 });
  }
} 