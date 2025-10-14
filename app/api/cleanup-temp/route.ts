import { NextResponse } from 'next/server';
import { join } from 'path';
import { readdir, unlink, readFile } from 'fs/promises';
import { existsSync } from 'fs';

// Importer les helpers pour l'export statique
import { dynamic, generateStaticParams } from '../generateStaticParamsHelper';
// Re-exporter pour cette route
export { dynamic, generateStaticParams };

// On conserve uniquement le runtime nodejs
export const runtime = 'nodejs';

// Cette API nettoie les fichiers vidéo temporaires expirés
export async function GET(req: Request) {
  try {
    // Répertoire des vidéos temporaires
    const tempDir = join(process.cwd(), 'public', 'temp-videos');
    
    // Vérifier si le répertoire existe
    if (!existsSync(tempDir)) {
      return NextResponse.json({ 
        success: true,
        message: "Le répertoire temporaire n'existe pas encore",
        deleted: 0 
      });
    }
    
    // Liste tous les fichiers
    const files = await readdir(tempDir);
    
    // Fichiers à supprimer
    const videoFiles = files.filter(file => file.endsWith('.mp4'));
    const metaFiles = files.filter(file => file.endsWith('.meta.json'));
    
    let deletedCount = 0;
    const now = Date.now();
    
    // Parcourir tous les fichiers meta pour vérifier s'ils sont expirés
    for (const metaFile of metaFiles) {
      try {
        const metaPath = join(tempDir, metaFile);
        const metaContent = await readFile(metaPath, 'utf-8');
        const meta = JSON.parse(metaContent);
        
        // Vérifier si le fichier est expiré
        if (meta.expires && meta.expires < now) {
          // Supprimer le fichier vidéo associé
          const videoFileName = metaFile.replace('.meta.json', '');
          const videoPath = join(tempDir, videoFileName);
          
          if (existsSync(videoPath)) {
            await unlink(videoPath);
            console.log(`Vidéo expirée supprimée: ${videoFileName}`);
          }
          
          // Supprimer le fichier meta
          await unlink(metaPath);
          console.log(`Fichier meta supprimé: ${metaFile}`);
          
          deletedCount++;
        }
      } catch (error) {
        console.error(`Erreur lors du traitement du fichier meta ${metaFile}:`, error);
      }
    }
    
    // Nettoyer également les vidéos orphelines (sans fichier meta)
    for (const videoFile of videoFiles) {
      const metaFileName = `${videoFile}.meta.json`;
      if (!metaFiles.includes(metaFileName)) {
        try {
          // Vérifier si le fichier vidéo a plus de 30 minutes
          const videoPath = join(tempDir, videoFile);
          const stats = await readFile(videoPath).then(() => ({ orphaned: true })).catch(() => ({ orphaned: false }));
          
          if (stats.orphaned) {
            await unlink(videoPath);
            console.log(`Vidéo orpheline supprimée: ${videoFile}`);
            deletedCount++;
          }
        } catch (error) {
          console.error(`Erreur lors de la suppression de la vidéo orpheline ${videoFile}:`, error);
        }
      }
    }
    
    return NextResponse.json({ 
      success: true,
      message: `${deletedCount} fichiers temporaires expirés ont été supprimés`,
      deleted: deletedCount
    });
  } catch (error) {
    console.error('Erreur lors du nettoyage des fichiers temporaires:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erreur inconnue' 
    }, { status: 500 });
  }
} 