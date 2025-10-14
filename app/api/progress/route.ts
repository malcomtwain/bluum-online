import { NextRequest, NextResponse } from 'next/server';
import { progress, clients, updateProgressInternal } from '@/lib/progress-store';

// Configurations pour l'export statique
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Générer des paramètres vides pour les routes statiques
export function generateStaticParams() {
  return [];
}

// Fonction GET pour l'export statique - en production, cette route sera gérée par une fonction Netlify
export async function GET(request: NextRequest) {
  // Si c'est une requête SSE (en développement)
  if (process.env.NODE_ENV === 'development') {
    const encoder = new TextEncoder();
    let streamController: ReadableStreamDefaultController;
    
    try {
      const stream = new ReadableStream({
        start(controller) {
          streamController = controller;
          clients.add(controller);
          
          // Send initial progress with proper SSE format
          const initialData = `data: ${JSON.stringify({ progress })}\n\n`;
          controller.enqueue(encoder.encode(initialData));
          console.log('Initial progress sent:', progress);
        },
        cancel() {
          if (streamController) {
            clients.delete(streamController);
            console.log('Client disconnected, remaining clients:', clients.size);
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'X-Accel-Buffering': 'no' // Disable buffering for Nginx
        },
      });
    } catch (error) {
      console.error('Error in SSE setup:', error);
      return new Response('Error setting up SSE connection', { status: 500 });
    }
  }
  
  // Version simplifiée pour l'export statique
  return new Response(
    JSON.stringify({ 
      message: 'This route is handled by Netlify functions in production',
      progress: 0
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      }
    }
  );
}

// Stub pour l'export statique - en production, cette route sera gérée par une fonction Netlify
export async function POST() {
  return new Response(
    JSON.stringify({
      success: true,
      message: 'Progress update is handled by Netlify functions in production'
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      }
    }
  );
} 