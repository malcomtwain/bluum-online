import { createClient } from '@supabase/supabase-js';

// Create Supabase client for client-side usage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types
export interface DBImageCollection {
  id: string;
  user_id: string;
  name: string;
  thumbnail?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DBImageItem {
  id: string;
  collection_id: string;
  file_name: string;
  url: string;
  size: number;
  uploaded_at: string;
}

export interface DBVideoCollection {
  id: string;
  user_id: string;
  name: string;
  thumbnail?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DBVideoItem {
  id: string;
  collection_id: string;
  file_name: string;
  url: string;
  size: number;
  uploaded_at: string;
}

// ========= IMAGE COLLECTIONS =========

export async function getImageCollections(userId: string) {
  
  // Skip ensure_default_collections for now - will be handled by database triggers
  
  const { data: collections, error } = await supabase
    .from('image_collections')
    .select(`
      *,
      items:image_collection_items(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
    
  if (error) {
    console.error('Error fetching image collections:', error);
    return [];
  }
  
  // Transform to match frontend format
  return collections.map(col => ({
    id: col.id,
    name: col.name,
    images: col.items.map((item: any) => ({
      id: item.id,
      fileName: item.file_name,
      url: item.url,
      size: item.size,
      uploadedAt: new Date(item.uploaded_at)
    })),
    thumbnail: col.thumbnail
  }));
}

export async function createImageCollection(userId: string, name: string) {
  
  const { data, error } = await supabase
    .from('image_collections')
    .insert({
      user_id: userId,
      name: name
    })
    .select()
    .single();
    
  if (error) {
    console.error('Error creating image collection:', error);
    throw error;
  }
  
  return data;
}

export async function updateImageCollection(collectionId: string, updates: Partial<DBImageCollection>) {
  
  const { data, error } = await supabase
    .from('image_collections')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', collectionId)
    .select()
    .single();
    
  if (error) {
    console.error('Error updating image collection:', error);
    throw error;
  }
  
  return data;
}

export async function deleteImageCollection(collectionId: string) {
  
  // Don't delete the default collection
  if (collectionId === '00000000-0000-0000-0000-000000000001') {
    throw new Error('Cannot delete default collection');
  }
  
  const { error } = await supabase
    .from('image_collections')
    .delete()
    .eq('id', collectionId);
    
  if (error) {
    console.error('Error deleting image collection:', error);
    throw error;
  }
}

export async function addImageToCollection(collectionId: string, image: {
  fileName: string;
  url: string;
  size: number;
}) {
  
  const { data, error } = await supabase
    .from('image_collection_items')
    .insert({
      collection_id: collectionId,
      file_name: image.fileName,
      url: image.url,
      size: image.size
    })
    .select()
    .single();
    
  if (error) {
    console.error('Error adding image to collection:', error);
    throw error;
  }
  
  // Update collection thumbnail if it's the first image
  const { data: collection } = await supabase
    .from('image_collections')
    .select('thumbnail')
    .eq('id', collectionId)
    .single();
    
  if (collection && !collection.thumbnail) {
    await updateImageCollection(collectionId, { thumbnail: image.url });
  }
  
  return data;
}

export async function removeImagesFromCollection(imageIds: string[]) {
  if (imageIds.length === 0) return;
  
  try {
    // D'abord, récupérer les URLs des images pour pouvoir les supprimer du storage
    const { data: images, error: fetchError } = await supabase
      .from('image_collection_items')
      .select('url')
      .in('id', imageIds);
    
    if (fetchError) {
      console.error('Error fetching images:', fetchError);
      throw fetchError;
    }
    
    // Supprimer de la base de données
    const { error: deleteError } = await supabase
      .from('image_collection_items')
      .delete()
      .in('id', imageIds);
    
    if (deleteError) {
      console.error('Error deleting from database:', deleteError);
      throw deleteError;
    }
    
    // Optionnel: Supprimer du storage (si les URLs pointent vers Supabase storage)
    if (images && images.length > 0) {
      for (const img of images) {
        if (img.url && img.url.includes('storage.supabase')) {
          try {
            // Extraire le path du fichier depuis l'URL
            const urlParts = img.url.split('/storage/v1/object/public/');
            if (urlParts.length > 1) {
              const [bucket, ...pathParts] = urlParts[1].split('/');
              const filePath = pathParts.join('/');
              
              await supabase.storage
                .from(bucket)
                .remove([filePath]);
            }
          } catch (storageError) {
            console.warn('Failed to delete from storage:', storageError);
            // Ne pas bloquer si la suppression du storage échoue
          }
        }
      }
    }
  } catch (error) {
    console.error('Error removing images from collection:', error);
    throw error;
  }
}

// ========= VIDEO COLLECTIONS =========

export async function getVideoCollections(userId: string) {
  
  // Skip ensure_default_collections for now - will be handled by database triggers
  
  const { data: collections, error } = await supabase
    .from('video_collections')
    .select(`
      *,
      items:video_collection_items(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
    
  if (error) {
    console.error('Error fetching video collections:', error);
    return [];
  }
  
  // Transform to match frontend format
  return collections.map(col => ({
    id: col.id,
    name: col.name,
    videos: col.items.map((item: any) => ({
      id: item.id,
      fileName: item.file_name,
      url: item.url,
      size: item.size,
      uploadedAt: new Date(item.uploaded_at)
    })),
    thumbnail: col.thumbnail
  }));
}

export async function createVideoCollection(userId: string, name: string) {
  
  const { data, error } = await supabase
    .from('video_collections')
    .insert({
      user_id: userId,
      name: name
    })
    .select()
    .single();
    
  if (error) {
    console.error('Error creating video collection:', error);
    throw error;
  }
  
  return data;
}

export async function updateVideoCollection(collectionId: string, updates: Partial<DBVideoCollection>) {
  
  const { data, error } = await supabase
    .from('video_collections')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', collectionId)
    .select()
    .single();
    
  if (error) {
    console.error('Error updating video collection:', error);
    throw error;
  }
  
  return data;
}

export async function deleteVideoCollection(collectionId: string) {
  
  // Don't delete the default collection
  if (collectionId === '00000000-0000-0000-0000-000000000001') {
    throw new Error('Cannot delete default collection');
  }
  
  const { error } = await supabase
    .from('video_collections')
    .delete()
    .eq('id', collectionId);
    
  if (error) {
    console.error('Error deleting video collection:', error);
    throw error;
  }
}

export async function addVideoToCollection(collectionId: string, video: {
  fileName: string;
  url: string;
  size: number;
}) {
  
  const { data, error } = await supabase
    .from('video_collection_items')
    .insert({
      collection_id: collectionId,
      file_name: video.fileName,
      url: video.url,
      size: video.size
    })
    .select()
    .single();
    
  if (error) {
    console.error('Error adding video to collection:', error);
    throw error;
  }
  
  // Update collection thumbnail if it's the first video
  const { data: collection } = await supabase
    .from('video_collections')
    .select('thumbnail')
    .eq('id', collectionId)
    .single();
    
  if (collection && !collection.thumbnail) {
    await updateVideoCollection(collectionId, { thumbnail: video.url });
  }
  
  return data;
}

export async function removeVideosFromCollection(videoIds: string[]) {
  if (videoIds.length === 0) return;
  
  try {
    // D'abord, récupérer les URLs des vidéos pour pouvoir les supprimer du storage
    const { data: videos, error: fetchError } = await supabase
      .from('video_collection_items')
      .select('url')
      .in('id', videoIds);
    
    if (fetchError) {
      console.error('Error fetching videos:', fetchError);
      throw fetchError;
    }
    
    // Supprimer de la base de données
    const { error: deleteError } = await supabase
      .from('video_collection_items')
      .delete()
      .in('id', videoIds);
    
    if (deleteError) {
      console.error('Error deleting from database:', deleteError);
      throw deleteError;
    }
    
    // Optionnel: Supprimer du storage (si les URLs pointent vers Supabase storage)
    if (videos && videos.length > 0) {
      for (const vid of videos) {
        if (vid.url && vid.url.includes('storage.supabase')) {
          try {
            // Extraire le path du fichier depuis l'URL
            const urlParts = vid.url.split('/storage/v1/object/public/');
            if (urlParts.length > 1) {
              const [bucket, ...pathParts] = urlParts[1].split('/');
              const filePath = pathParts.join('/');
              
              await supabase.storage
                .from(bucket)
                .remove([filePath]);
            }
          } catch (storageError) {
            console.warn('Failed to delete from storage:', storageError);
            // Ne pas bloquer si la suppression du storage échoue
          }
        }
      }
    }
  } catch (error) {
    console.error('Error removing videos from collection:', error);
    throw error;
  }
}