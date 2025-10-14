/**
 * Store pour les données de progression
 * Séparé du fichier route.ts pour éviter les problèmes d'exportation
 */

// Variables pour le suivi de la progression
export let progress = 0;
export let clients = new Set<ReadableStreamDefaultController>();

/**
 * Met à jour la progression et notifie tous les clients connectés
 */
export function updateProgressInternal(newProgress: number): void {
  progress = newProgress;
  const data = `data: ${JSON.stringify({ progress })}\n\n`;
  const encoder = new TextEncoder();
  console.log('Sending progress update to', clients.size, 'clients:', newProgress);
  
  const deadClients = new Set<ReadableStreamDefaultController>();
  
  clients.forEach(client => {
    try {
      client.enqueue(encoder.encode(data));
    } catch (error) {
      console.error('Error sending progress update:', error);
      deadClients.add(client);
    }
  });
  
  // Clean up dead clients
  deadClients.forEach(client => {
    clients.delete(client);
  });
  
  console.log('Progress update complete, remaining clients:', clients.size);
} 