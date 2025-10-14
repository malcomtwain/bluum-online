import { WebSocketServer } from 'ws';

let wss: WebSocketServer | null = null;

// Initialize WebSocket server
if (typeof window === 'undefined') {
  try {
    wss = new WebSocketServer({ port: 3002 });
    console.log('WebSocket server initialized on port 3002');
  } catch (error) {
    console.error('Failed to initialize WebSocket server:', error);
  }
}

export function getWebSocketServer() {
  return wss;
}

export function broadcastProgress(progress: number) {
  if (!wss) return;
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ progress }));
    }
  });
} 