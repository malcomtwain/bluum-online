/**
 * Cette fonction envoie une mise à jour de progression au serveur
 * en utilisant l'API POST /api/progress
 */
export async function sendProgressToAPI(newProgress: number) {
  try {
    await fetch('/api/progress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ progress: newProgress }),
    });
  } catch (error) {
    console.error('Failed to update progress:', error);
  }
}

// Fonction simple pour gérer le progrès de génération vidéo
// Compatible avec tous les environnements (local et Netlify)

// État global pour le progrès actuel (0-100)
let currentProgress = 0;
let progressCallbacks: ((progress: number) => void)[] = [];

/**
 * Met à jour la progression de génération de vidéo (0-100)
 */
export function updateProgress(progress: number): void {
  currentProgress = Math.min(100, Math.max(0, progress));
  // Notifier tous les callbacks enregistrés
  progressCallbacks.forEach(callback => {
    try {
      callback(currentProgress);
    } catch (error) {
      console.error('Erreur lors de la notification de progression:', error);
    }
  });
  
  // Envoyer aussi la mise à jour au serveur si disponible
  if (typeof window !== 'undefined') {
    sendProgressToAPI(progress).catch(err => 
      console.error('Échec de l\'envoi de progression au serveur:', err)
    );
  }
} 