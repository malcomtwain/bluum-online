// UUID pour générer des identifiants uniques
const { v4: uuidv4 } = require('uuid');

// Fonction simplifiée pour le traitement vidéo
exports.handler = async function(event, context) {
  // Vérifier la méthode
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Parser le corps de la requête
    const body = JSON.parse(event.body);
    const { operation, options } = body;

    console.log(`Opération demandée: ${operation}`);
    console.log(`Options: ${JSON.stringify(options).substring(0, 100)}...`);

    // Générer un ID unique pour cette opération
    const operationId = uuidv4();

    // Retourner une réponse temporaire
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Fonction de traitement vidéo en cours de développement',
        videoPath: `/temp-videos/video_${operationId}.mp4`,
        expiresAt: Date.now() + (15 * 60 * 1000), // 15 minutes
        operationId: operationId,
        part1Duration: 5,
        part2Duration: 5,
        totalDuration: 10
      })
    };
  } catch (error) {
    console.error('Erreur dans la fonction de traitement vidéo:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Erreur de traitement vidéo', 
        message: error.message
      })
    };
  }
};

// Fonction pour générer une vidéo
async function handleGenerateVideo(options) {
  console.log("📽️ Netlify Function: handleGenerateVideo appelée avec options:", JSON.stringify(options).substring(0, 100) + "...");
  
  // Créer un ID unique pour cette opération
  const operationId = uuidv4();
  const tempDir = join(tmpdir(), `video-${operationId}`);
  
  try {
    // Extraire les données
    const { part1, part2, song, hook } = options;
    
    // Vérifier que toutes les entrées requises sont présentes
    if (!part1?.url || !part2?.url || !song?.url) {
      console.error("Données d'entrée manquantes");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "Données d'entrée manquantes"
        })
      };
    }
    
    // Fonction utilitaire pour télécharger et sauvegarder un fichier à partir d'une URL ou data:URL
    async function saveUrlToFile(url, prefix) {
      try {
        let extension = '.mp4';
        let fileData;
        
        // Traiter selon le type d'URL
        if (url.startsWith('data:')) {
          // Data URL
          const matches = url.match(/^data:([A-Za-z-]+\/[A-Za-z-]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const mimeType = matches[1];
            const base64Data = matches[2];
            fileData = Buffer.from(base64Data, 'base64');
            
            // Déterminer l'extension
            if (mimeType.includes('image/jpeg')) extension = '.jpg';
            else if (mimeType.includes('image/png')) extension = '.png';
            else if (mimeType.includes('video/mp4')) extension = '.mp4';
            else if (mimeType.includes('audio/mpeg')) extension = '.mp3';
          } else {
            throw new Error("Format data:URL invalide");
          }
        } else if (url.startsWith('http')) {
          // URL HTTP
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Échec du téléchargement: ${response.statusText}`);
          }
          fileData = Buffer.from(await response.arrayBuffer());
          
          // Déterminer l'extension à partir du Content-Type
          const contentType = response.headers.get('content-type');
          if (contentType) {
            if (contentType.includes('image/jpeg')) extension = '.jpg';
            else if (contentType.includes('image/png')) extension = '.png';
            else if (contentType.includes('video/mp4')) extension = '.mp4';
            else if (contentType.includes('audio/mpeg')) extension = '.mp3';
          }
        } else {
          throw new Error("Format d'URL non pris en charge");
        }
        
        // Sauvegarder le fichier
        const filePath = join(tempDir, `${prefix}${extension}`);
        await writeFile(filePath, fileData);
        console.log(`Fichier sauvegardé: ${filePath}`);
        return { path: filePath, extension };
      } catch (error) {
        console.error(`Erreur lors de la sauvegarde de l'URL pour ${prefix}:`, error);
        throw error;
      }
    }
    
    // Télécharger les fichiers
    console.log("Téléchargement des fichiers d'entrée...");
    const part1File = await saveUrlToFile(part1.url, 'part1');
    const part2File = await saveUrlToFile(part2.url, 'part2');
    const songFile = await saveUrlToFile(song.url, 'song');
    
    // Créer le fichier de sortie
    const outputPath = join(tempDir, `output${operationId}.mp4`);
    console.log(`Fichier de sortie: ${outputPath}`);
    
    // Déterminer les types de médias
    const isPart1Image = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(part1File.extension);
    const isPart2Image = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(part2File.extension);
    
    // Extraire les durées
    const part1Duration = Math.floor(Math.random() * 
      (part1.duration?.max - part1.duration?.min) + part1.duration?.min) || 5;
    const part2Duration = Math.floor(Math.random() * 
      (options.part2Duration?.max - options.part2Duration?.min) + options.part2Duration?.min) || 5;
    
    console.log(`Durées: Part1=${part1Duration}s, Part2=${part2Duration}s`);
    
    // Créer les fichiers intermédiaires
    const part1Scaled = join(tempDir, `part1_scaled.mp4`);
    const part2Scaled = join(tempDir, `part2_scaled.mp4`);
    
    // Fonction pour exécuter une commande FFmpeg
    const runFFmpeg = (inputOptions, outputOptions, inputPath, outputPath) => {
      return new Promise((resolve, reject) => {
        const command = fluentFFmpeg();
        
        // Ajouter les options d'entrée
        if (inputOptions) {
          command.inputOptions(inputOptions);
        }
        
        // Ajouter l'entrée
        command.input(inputPath);
        
        // Ajouter les options de sortie
        if (outputOptions) {
          command.outputOptions(outputOptions);
        }
        
        // Configurer la sortie
        command.output(outputPath);
        
        // Configurer les gestionnaires d'événements
        command
          .on('start', (commandLine) => {
            console.log(`Commande FFmpeg: ${commandLine}`);
          })
          .on('progress', (progress) => {
            console.log(`Progression: ${Math.round(progress.percent || 0)}%`);
          })
          .on('error', (err) => {
            console.error('Erreur FFmpeg:', err);
            reject(err);
          })
          .on('end', () => {
            console.log(`Traitement FFmpeg terminé pour ${outputPath}`);
            resolve();
          });
        
        // Démarrer le traitement
        command.run();
      });
    };
    
    // Préparer Part 1
    console.log("Préparation de Part 1...");
    if (isPart1Image) {
      // Convertir l'image en vidéo
      await runFFmpeg(
        ['-loop', '1', '-t', part1Duration.toString()],
        ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-vf', 
         `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1`],
        part1File.path,
        part1Scaled
      );
    } else {
      // Redimensionner la vidéo
      await runFFmpeg(
        ['-t', part1Duration.toString()],
        ['-c:v', 'libx264', '-an', '-pix_fmt', 'yuv420p', '-vf', 
         `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1`],
        part1File.path,
        part1Scaled
      );
    }
    
    // Préparer Part 2
    console.log("Préparation de Part 2...");
    if (isPart2Image) {
      // Convertir l'image en vidéo
      await runFFmpeg(
        ['-loop', '1', '-t', part2Duration.toString()],
        ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-vf', 
         `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black`],
        part2File.path,
        part2Scaled
      );
    } else {
      // Redimensionner la vidéo
      await runFFmpeg(
        ['-t', part2Duration.toString()],
        ['-c:v', 'libx264', '-an', '-pix_fmt', 'yuv420p', '-vf', 
         `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black`],
        part2File.path,
        part2Scaled
      );
    }
    
    // Concaténer les vidéos avec la musique
    console.log("Concaténation des vidéos...");
    const concatProcess = new Promise((resolve, reject) => {
      const command = fluentFFmpeg();
      
      // Ajouter les entrées
      command.input(part1Scaled);
      command.input(part2Scaled);
      command.input(songFile.path);
      
      // Configurer le filtre complex
      command.complexFilter([
        '[0:v][1:v]concat=n=2:v=1:a=0[outv]',
        '[2:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[outa]'
      ]);
      
      // Mapper les flux de sortie
      command.outputOptions([
        '-map', '[outv]',
        '-map', '[outa]',
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-shortest'
      ]);
      
      // Configurer la sortie
      command.output(outputPath);
      
      // Configurer les gestionnaires d'événements
      command
        .on('start', (commandLine) => {
          console.log(`Commande FFmpeg de concaténation: ${commandLine}`);
        })
        .on('progress', (progress) => {
          console.log(`Progression de la concaténation: ${Math.round(progress.percent || 0)}%`);
        })
        .on('error', (err) => {
          console.error('Erreur FFmpeg lors de la concaténation:', err);
          reject(err);
        })
        .on('end', () => {
          console.log(`Concaténation terminée: ${outputPath}`);
          resolve();
        });
      
      // Démarrer le traitement
      command.run();
    });
    
    // Attendre la fin du traitement
    await concatProcess;
    
    // Si un hook est spécifié, l'ajouter à la vidéo
    let finalOutputPath = outputPath;
    if (hook?.text) {
      console.log("Ajout du hook à la vidéo...");
      // TODO: Implémenter l'ajout du hook
      finalOutputPath = join(tempDir, `with_hook_${operationId}.mp4`);
      await writeFile(finalOutputPath, await readFile(outputPath));
    }
    
    // Lire le fichier généré
    const videoBuffer = await readFile(finalOutputPath);
    const base64Video = videoBuffer.toString('base64');
    
    // Définir une URL temporaire (simulée pour le moment)
    const videoUrl = `/temp-videos/video_${operationId}.mp4`;
    
    // Nettoyer les fichiers temporaires
    try {
      // Supprimer les fichiers temporaires
      await unlink(part1File.path);
      await unlink(part2File.path);
      await unlink(songFile.path);
      await unlink(part1Scaled);
      await unlink(part2Scaled);
      await unlink(outputPath);
      if (finalOutputPath !== outputPath) {
        await unlink(finalOutputPath);
      }
      console.log("Fichiers temporaires nettoyés");
    } catch (cleanupError) {
      console.warn("Erreur lors du nettoyage des fichiers temporaires:", cleanupError);
    }
    
    // Retourner le résultat
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        videoPath: videoUrl,
        expiresAt: Date.now() + (15 * 60 * 1000), // 15 minutes
        part1Duration,
        part2Duration,
        totalDuration: part1Duration + part2Duration,
        operationId
      })
    };
  } catch (error) {
    console.error("Erreur lors de la génération de la vidéo:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: `Erreur lors de la génération de la vidéo: ${error.message}`
      })
    };
  }
}

// Fonction pour générer une prévisualisation de hook
async function handleGenerateHookPreview(options) {
  const { text, style } = options;
  const operationId = uuidv4();

  // Pour l'instant, retournons une réponse simulée pour le test
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      message: 'Fonction de prévisualisation de hook prête à être implémentée',
      operationId,
      text,
      style
    })
  };
} 