import { NextResponse } from 'next/server';
import { compressVideo } from '@/lib/video-compression';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('video') as File;
    const quality = (formData.get('quality') as string) || 'medium';
    
    if (!file) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
    }

    // Créer un fichier temporaire
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'video-'));
    const inputPath = path.join(tempDir, 'input.mp4');
    const outputPath = path.join(tempDir, 'compressed.mp4');
    
    // Sauvegarder le fichier uploadé
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(inputPath, buffer);
    
    // Compresser la vidéo
    const { videoPath, thumbnailPath } = await compressVideo(inputPath, outputPath, {
      quality: quality as 'low' | 'medium' | 'high',
      generateThumbnail: true
    });
    
    // Lire les fichiers compressés
    const compressedVideo = await fs.readFile(videoPath);
    const thumbnail = thumbnailPath ? await fs.readFile(thumbnailPath) : null;
    
    // Nettoyer les fichiers temporaires
    await fs.rm(tempDir, { recursive: true, force: true });
    
    // Retourner les données
    return new NextResponse(compressedVideo as unknown as BodyInit, {
      headers: {
        'Content-Type': 'video/mp4',
        'X-Thumbnail': thumbnail ? Buffer.from(thumbnail).toString('base64') : ''
      }
    });
    
  } catch (error) {
    console.error('Error compressing video:', error);
    return NextResponse.json(
      { error: 'Failed to compress video' },
      { status: 500 }
    );
  }
}