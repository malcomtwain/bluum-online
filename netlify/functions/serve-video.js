// Fonction simplifiée pour servir les vidéos générées
exports.handler = async function(event, context) {
  // Extraire le chemin de la vidéo à partir des paramètres de l'URL
  const videoId = event.path.split('/').pop();
  
  if (!videoId || !videoId.includes('video_')) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'ID vidéo invalide' })
    };
  }
  
  try {
    // Solution temporaire : renvoyer une réponse indiquant que la vidéo est en cours de traitement
    // Cela permet au site de fonctionner en attendant une implémentation complète du stockage
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({
        message: 'Le service de vidéo est en cours de développement',
        videoId: videoId,
        status: 'pending'
      })
    };
  } catch (error) {
    console.error('Erreur lors de la récupération de la vidéo:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Erreur lors de la récupération de la vidéo',
        details: error.message
      })
    };
  }
}; 