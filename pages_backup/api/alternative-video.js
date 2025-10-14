// API alternative temporaire pour la génération de vidéos
export default async function handler(req, res) {
  // Cette API est une solution de contournement temporaire pour tester
  // sans toucher à la logique principale de génération de vidéos

  try {
    // Simuler un délai pour un processus de génération
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Retourner une réponse simulée avec des informations de débogage
    res.status(200).json({
      success: true,
      message: "Cette version de l'API est une solution temporaire",
      mode: "alternative",
      debug: {
        serverInfo: process.version,
        netlifyEnvironment: process.env.NETLIFY ? "Oui" : "Non",
        dateGenerated: new Date().toISOString()
      },
      // URL vers une vidéo d'exemple (à remplacer par une vraie vidéo le cas échéant)
      videoUrl: "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4",
      thumbnailUrl: "https://via.placeholder.com/300x200.png?text=Aperçu+vidéo"
    });
  } catch (error) {
    console.error("Erreur dans l'API alternative:", error);
    res.status(500).json({ 
      error: "Erreur dans l'API alternative", 
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
} 