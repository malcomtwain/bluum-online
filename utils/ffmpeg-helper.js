// Utilitaire pour initialiser FFmpeg de manière robuste
// et gérer les erreurs sans bloquer le rendu

let ffmpegInitialized = false;
let ffmpeg = null;

function initializeFFmpeg() {
  if (ffmpegInitialized) return ffmpeg;
  
  try {
    // Vérifier si l'initialisation est explicitement désactivée pour l'environnement Vercel
    if (process.env.FFMPEG_DISABLE_INITIALIZATION === 'true' || process.env.NEXT_PUBLIC_FFMPEG_ENV === 'vercel') {
      console.log('FFmpeg initialization explicitly disabled for Vercel environment');
      ffmpegInitialized = true;
      return null;
    }
    
    if (typeof window !== 'undefined') {
      // Côté client, ne pas tenter d'initialiser FFmpeg
      console.log('FFmpeg non initialisé (environnement client)');
      ffmpegInitialized = true;
      return null;
    }

    // Vérifier si nous sommes dans l'environnement Netlify
    const isNetlify = process.env.NEXT_PUBLIC_NETLIFY_DEPLOYMENT === 'true' || 
                      process.env.NETLIFY === 'true';
    
    // Adapter les chemins FFmpeg selon l'environnement
    let ffmpegPath = process.env.FFMPEG_PATH;
    let ffprobePath = process.env.FFPROBE_PATH;
    
    if (!ffmpegPath || !ffprobePath) {
      console.warn('Chemins FFmpeg ou FFprobe non configurés');
      
      // Si nous sommes sur Netlify, utiliser les chemins spécifiques à Netlify
      if (isNetlify) {
        try {
          // Utiliser eval pour éviter l'analyse statique de webpack
          ffmpegPath = eval("require('@ffmpeg-installer/ffmpeg').path");
          ffprobePath = eval("require('@ffprobe-installer/ffprobe').path");
          
          console.log('Utilisation des chemins FFmpeg de Netlify:', {
            ffmpeg: ffmpegPath,
            ffprobe: ffprobePath
          });
        } catch (error) {
          console.error('Erreur lors de la récupération des chemins FFmpeg pour Netlify:', error.message);
          ffmpegInitialized = true;
          return null;
        }
      } else {
        ffmpegInitialized = true;
        return null;
      }
    }
    
    // Importer fluent-ffmpeg uniquement côté serveur
    let fluentFFmpeg;
    
    try {
      fluentFFmpeg = require('fluent-ffmpeg');
    } catch (importError) {
      console.error('Impossible de charger le module fluent-ffmpeg:', importError.message);
      ffmpegInitialized = true;
      return null;
    }
    
    // Utiliser les chemins configurés ou les chemins obtenus dynamiquement
    try {
      fluentFFmpeg.setFfmpegPath(ffmpegPath);
      fluentFFmpeg.setFfprobePath(ffprobePath);
      
      console.log('FFmpeg initialisé avec succès:', {
        ffmpeg: ffmpegPath,
        ffprobe: ffprobePath
      });
      
      ffmpeg = fluentFFmpeg;
    } catch (configError) {
      console.error('Erreur lors de la configuration des chemins FFmpeg:', configError.message);
      ffmpeg = null;
    }
    
    ffmpegInitialized = true;
    return ffmpeg;
  } catch (error) {
    console.error('Erreur lors de l\'initialisation FFmpeg:', error.message);
    ffmpegInitialized = true;
    return null;
  }
}

// Si nous sommes sur Netlify, nous pouvons aussi vérifier si nous sommes dans une fonction Netlify
// et utiliser la fonction dédiée pour le traitement vidéo
const callNetlifyFunction = async (operation, options) => {
  if (typeof window === 'undefined') return null; // Seulement côté client
  
  try {
    const response = await fetch('/.netlify/functions/video-processing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ operation, options }),
    });
    
    if (!response.ok) {
      throw new Error(`Erreur lors de l'appel à la fonction Netlify: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Erreur lors de l\'appel à la fonction Netlify:', error);
    throw error;
  }
};

// Exportation qui gère gracieusement les erreurs
module.exports = {
  get ffmpeg() {
    return initializeFFmpeg();
  },
  initializeFFmpeg,
  callNetlifyFunction
}; 