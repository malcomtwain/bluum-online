import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface VideoData {
  path: string;
  fileName: string;
}

/**
 * Télécharge un ensemble de vidéos sous forme de fichier ZIP
 * @param videos Liste des vidéos à télécharger
 * @param zipName Nom du fichier ZIP (par défaut: 'bluum_videos.zip')
 */
export async function downloadVideosAsZip(videos: VideoData[], zipName: string = 'bluum_videos.zip'): Promise<void> {
  if (!videos || videos.length === 0) {
    console.error('Aucune vidéo à télécharger');
    return;
  }

  console.log(`Début du processus de téléchargement pour ${videos.length} vidéos`);
  console.log('Vidéos à télécharger:', videos);

  try {
    // Vérifier que JSZip est correctement importé
    if (!JSZip) {
      throw new Error('JSZip n\'est pas disponible');
    }

    // Vérifier que saveAs est correctement importé
    if (!saveAs) {
      throw new Error('saveAs n\'est pas disponible');
    }

    // Créer une nouvelle instance de JSZip
    const zip = new JSZip();
    console.log('Instance JSZip créée');
    
    // Pour suivre la progression du téléchargement
    let downloadedCount = 0;
    const totalCount = videos.length;
    
    // Créer un dossier dans le zip pour les vidéos
    const videosFolder = zip.folder('videos');
    
    if (!videosFolder) {
      throw new Error('Impossible de créer le dossier dans le ZIP');
    }
    
    console.log('Dossier "videos" créé dans le ZIP');
    
    // Télécharger chaque vidéo et l'ajouter au ZIP
    const downloadPromises = videos.map(async (video, index) => {
      try {
        console.log(`Téléchargement de la vidéo ${index + 1}/${totalCount}: ${video.fileName} depuis ${video.path}`);
        
        // Récupérer la vidéo
        const response = await fetch(video.path);
        if (!response.ok) {
          throw new Error(`Échec du téléchargement de la vidéo ${video.fileName}: ${response.status} ${response.statusText}`);
        }
        
        console.log(`Vidéo ${index + 1} récupérée avec succès, conversion en blob...`);
        
        // Convertir la réponse en blob
        const blob = await response.blob();
        console.log(`Taille du blob pour ${video.fileName}: ${blob.size} octets`);
        
        // Créer un nom de fichier unique pour éviter les collisions
        const safeFileName = ensureUniqueFileName(video.fileName, index);
        
        // Ajouter le blob au ZIP
        videosFolder.file(safeFileName, blob);
        
        // Mettre à jour le compteur
        downloadedCount++;
        console.log(`Téléchargement ${downloadedCount}/${totalCount}: ${video.fileName} ajouté au ZIP`);
        
      } catch (error) {
        console.error(`Erreur lors du téléchargement de ${video.fileName}:`, error);
        // Continuer avec les autres vidéos même en cas d'erreur
      }
    });
    
    // Attendre que tous les téléchargements soient terminés
    console.log('Attente de tous les téléchargements...');
    await Promise.all(downloadPromises);
    
    // Vérifier si des vidéos ont été téléchargées
    if (downloadedCount === 0) {
      throw new Error('Aucune vidéo n\'a pu être téléchargée');
    }
    
    // Générer le fichier ZIP
    console.log('Génération du fichier ZIP...');
    const zipBlob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 5 }
    });
    
    console.log(`ZIP généré avec succès, taille: ${zipBlob.size} octets. Téléchargement...`);
    
    // Télécharger le fichier ZIP
    saveAs(zipBlob, zipName);
    console.log('Téléchargement du ZIP lancé');
    
  } catch (error) {
    console.error('Erreur détaillée lors de la création du ZIP:', error);
    throw error;
  }
}

/**
 * S'assure que le nom de fichier est unique en ajoutant un index si nécessaire
 */
function ensureUniqueFileName(fileName: string, index: number): string {
  // Séparer le nom et l'extension
  const lastDotIndex = fileName.lastIndexOf('.');
  const name = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
  const extension = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';
  
  // Ajouter l'index pour éviter les collisions
  return `${name}_${index + 1}${extension}`;
} 