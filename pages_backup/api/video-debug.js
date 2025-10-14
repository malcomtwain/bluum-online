// API de diagnostic pour les problèmes de génération vidéo - version simplifiée
export default async function handler(req, res) {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      env: {
        NODE_ENV: process.env.NODE_ENV || 'non défini',
        NETLIFY: process.env.NETLIFY || 'non défini',
        NETLIFY_DEV: process.env.NETLIFY_DEV || 'non défini'
      }
    },
    modules: {
      status: "diagnostics de base uniquement"
    }
  };

  try {
    // Vérifier si nous sommes côté serveur
    if (typeof window === 'undefined') {
      // Test réseau sécurisé
      try {
        const testUrl = "https://example.com";
        const response = await fetch(testUrl, { method: 'HEAD' });
        
        diagnostics.networkTest = {
          status: "testé",
          success: response.ok,
          statusCode: response.status
        };
      } catch (networkError) {
        diagnostics.networkTest = {
          status: "erreur",
          message: networkError.message
        };
      }
      
      // Informations sur les variables d'environnement liées à FFmpeg
      diagnostics.ffmpegEnv = {
        FFMPEG_PATH: process.env.FFMPEG_PATH || 'non défini',
        FFPROBE_PATH: process.env.FFPROBE_PATH || 'non défini'
      };
    } else {
      diagnostics.error = "Cette API doit être appelée côté serveur";
    }
  } catch (error) {
    diagnostics.error = {
      message: error.message
    };
  }

  res.status(200).json(diagnostics);
} 