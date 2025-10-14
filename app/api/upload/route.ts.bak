import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../lib/auth';
import { uploadFile } from '../../lib/s3';
import { v4 as uuidv4 } from 'uuid';

// Fonction simulée pour vérifier l'authentification
function getAuth() {
  return { userId: 'auth-user-id' };
}

// Configuration pour l'environnement Edge
export const dynamic = 'force-dynamic';

// Générer des paramètres statiques vides pour l'export
export function generateStaticParams() {
  return [];
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth();
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new NextResponse('No file provided', { status: 400 });
    }

    // Génération d'une clé unique pour le fichier
    const key = `uploads/${userId}/${uuidv4()}-${file.name}`;
    // Appel correct à uploadFile avec les bons paramètres
    await uploadFile(file, key);
    
    return NextResponse.json({ key });
  } catch (error) {
    console.error('Error uploading file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 