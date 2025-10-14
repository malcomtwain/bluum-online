const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '500mb' }));

// Créer le dossier temp s'il n'existe pas
const TEMP_DIR = '/tmp/videos';
(async () => {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating temp directory:', error);
  }
})();

// Fonction pour télécharger un fichier depuis une URL
async function downloadFile(url, outputPath) {
  try {
    const response = await axios.get(url, { responseType: 'stream' });
    const writer = require('fs').createWriteStream(outputPath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}

// Fonction pour créer une image à partir du texte (placeholder)
async function createTextImage(text, outputPath) {
  return new Promise((resolve, reject) => {
    // Créer une image noire avec le texte en blanc
    ffmpeg()
      .input('color=black:s=1080x1920:d=1')
      .inputOptions(['-f', 'lavfi'])
      .complexFilter([
        {
          filter: 'drawtext',
          options: {
            text: text || '',
            fontsize: 60,
            fontcolor: 'white',
            x: '(w-text_w)/2',
            y: '(h-text_h)/2',
            font: 'Arial'
          }
        }
      ])
      .outputOptions(['-frames:v', '1'])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

// Route principale de traitement vidéo
app.post('/process-video', async (req, res) => {
  const sessionId = crypto.randomUUID();
  const sessionDir = path.join(TEMP_DIR, sessionId);
  
  try {
    await fs.mkdir(sessionDir, { recursive: true });
    
    const { parts, music, hook, style, duration } = req.body;
    
    console.log(`Processing video session ${sessionId}`);
    console.log('Number of parts:', parts.length);
    
    // Télécharger tous les fichiers
    const localPaths = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const ext = part.type === 'image' ? '.jpg' : '.mp4';
      const localPath = path.join(sessionDir, `part_${i}${ext}`);
      
      if (part.url.startsWith('data:')) {
        // Data URL - décoder et sauvegarder
        const base64Data = part.url.split(',')[1];
        await fs.writeFile(localPath, Buffer.from(base64Data, 'base64'));
      } else {
        // URL normale - télécharger
        await downloadFile(part.url, localPath);
      }
      
      localPaths.push(localPath);
    }
    
    // Créer le fichier concat pour FFmpeg
    const concatListPath = path.join(sessionDir, 'concat.txt');
    let concatContent = '';
    
    for (let i = 0; i < localPaths.length; i++) {
      const inputPath = localPaths[i];
      const part = parts[i];
      
      if (part.type === 'image') {
        // Convertir l'image en vidéo
        const videoPath = path.join(sessionDir, `video_${i}.mp4`);
        
        await new Promise((resolve, reject) => {
          ffmpeg(inputPath)
            .loop(part.duration || 3)
            .fps(30)
            .size('1080x1920')
            .videoCodec('libx264')
            .outputOptions([
              '-pix_fmt', 'yuv420p',
              '-t', String(part.duration || 3)
            ])
            .output(videoPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
        
        concatContent += `file '${videoPath}'\n`;
      } else {
        concatContent += `file '${inputPath}'\n`;
      }
    }
    
    await fs.writeFile(concatListPath, concatContent);
    
    // Télécharger la musique si fournie
    let musicPath = null;
    if (music && music.url) {
      musicPath = path.join(sessionDir, 'music.mp3');
      await downloadFile(music.url, musicPath);
    }
    
    // Créer la vidéo finale
    const outputPath = path.join(sessionDir, 'output.mp4');
    
    await new Promise((resolve, reject) => {
      let command = ffmpeg()
        .input(concatListPath)
        .inputOptions(['-f', 'concat', '-safe', '0']);
      
      // Ajouter la musique si elle a été téléchargée
      if (musicPath) {
        command = command
          .input(musicPath)
          .outputOptions([
            '-map', '0:v',
            '-map', '1:a',
            '-shortest'
          ]);
      }
      
      // Ajouter le texte du hook si fourni
      if (hook && hook.text) {
        command = command.complexFilter([
          {
            filter: 'drawtext',
            options: {
              text: hook.text,
              fontsize: hook.fontSize || 60,
              fontcolor: hook.color || 'white',
              x: hook.x || '(w-text_w)/2',
              y: hook.y || 100,
              shadowcolor: 'black',
              shadowx: 2,
              shadowy: 2
            }
          }
        ]);
      }
      
      command
        .videoCodec('libx264')
        .outputOptions([
          '-preset', 'ultrafast',
          '-pix_fmt', 'yuv420p'
        ])
        .output(outputPath)
        .on('progress', (progress) => {
          console.log(`Processing: ${progress.percent}% done`);
        })
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    
    // Lire le fichier de sortie
    const videoBuffer = await fs.readFile(outputPath);
    const base64Video = videoBuffer.toString('base64');
    
    // Nettoyer les fichiers temporaires
    await fs.rm(sessionDir, { recursive: true, force: true });
    
    // Retourner la vidéo en base64
    res.json({
      success: true,
      video: `data:video/mp4;base64,${base64Video}`,
      sessionId
    });
    
  } catch (error) {
    console.error('Error processing video:', error);
    
    // Nettoyer en cas d'erreur
    try {
      await fs.rm(sessionDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error('Error cleaning up:', cleanupError);
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route de santé
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Video processor service running on port ${PORT}`);
});