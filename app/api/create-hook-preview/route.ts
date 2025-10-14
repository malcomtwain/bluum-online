import { NextResponse } from 'next/server';
import { drawHookText } from '@/lib/utils';

// Imports conditionnels pour les modules natifs
let canvasModule: any = null;
let pathModule: any = null;

// Ne charger les modules que côté serveur
if (typeof window === 'undefined') {
  try {
    // Charger les modules natifs de manière conditionnelle
    canvasModule = require('canvas');
    pathModule = require('path');
  } catch (e) {
    console.warn('Modules natifs non disponibles pendant la compilation', e);
  }
}

// Configuration pour l'environnement Edge
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Forcer l'utilisation du runtime Node.js

export async function POST(request: Request) {
  try {
    // Si les modules ne sont pas disponibles (environnement de compilation), retourner une réponse stub
    if (!canvasModule || !pathModule) {
      console.warn('Modules natifs requis non disponibles - environnement de compilation');
      return NextResponse.json({
        success: false,
        message: 'This function requires Node.js modules which are only available at runtime',
      }, { status: 503 });
    }
    
    const { text, style, position, offset } = await request.json();

    // Register TikTok Display Medium font
    const { createCanvas, registerFont } = canvasModule;
    registerFont(pathModule.join(process.cwd(), 'fonts/TikTokDisplayMedium.otf'), {
      family: 'TikTok Display Medium'
    });

    // Create canvas
    const canvas = createCanvas(1080, 1920);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw hook text using the same function as preview and montage
    drawHookText(ctx, text, {
      type: style,
      position: position,
      offset: offset
    }, canvas.width, canvas.height);

    // Convert canvas to PNG buffer
    const screenshot = canvas.toBuffer('image/png');

    // Return the image
    return new NextResponse(screenshot, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'inline; filename="hook-preview.png"'
      }
    });
  } catch (error) {
    console.error('Error generating hook preview:', error);
    return NextResponse.json({ error: 'Failed to generate hook preview' }, { status: 500 });
  }
} 