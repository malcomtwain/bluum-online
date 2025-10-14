import { getSupabaseClient } from './supabase-singleton';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wjtguiusxvxaabutfxls.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqdGd1aXVzeHZ4YWFidXRmeGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNTkxMDksImV4cCI6MjA2ODkzNTEwOX0.4sIdI3m2QF_KP3EdmSR7N92pnET4ApLt_FNpuoR-234';

function getWorkingSupabaseClient() {
  const client = getSupabaseClient();
  if (client) return client;
  
  console.log('Creating fallback Supabase client...');
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Types
export interface MediaCollection {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  parent_id?: string;
  collection_type: 'videos' | 'slideshows' | 'mixed';
  color: string;
  icon: string;
  sort_order: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  stats?: {
    videos: number;
    slideshows: number;
    subcollections: number;
    total_items: number;
  };
}

// ========== Collections Management ==========

export async function getUserCollections(userId: string, parentId?: string): Promise<MediaCollection[]> {
  const supabase = getWorkingSupabaseClient();
  if (!supabase) {
    console.error('Supabase client not initialized');
    return [];
  }

  const query = supabase
    .from('generated_media_collections')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  // Filter by parent_id
  if (parentId) {
    query.eq('parent_id', parentId);
  } else {
    query.is('parent_id', null);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching collections:', error);
    return [];
  }

  // Get stats for each collection
  const collectionsWithStats = await Promise.all(
    (data || []).map(async (collection) => {
      const stats = await getCollectionStats(collection.id);
      return { ...collection, stats };
    })
  );

  return collectionsWithStats;
}

export async function getCollectionStats(collectionId: string) {
  const supabase = getWorkingSupabaseClient();
  if (!supabase) {
    return { videos: 0, slideshows: 0, subcollections: 0, total_items: 0 };
  }

  const [videos, slideshows, subcollections] = await Promise.all([
    supabase.from('generated_videos').select('id', { count: 'exact' }).eq('collection_id', collectionId),
    supabase.from('generated_slideshows').select('id', { count: 'exact' }).eq('collection_id', collectionId),
    supabase.from('generated_media_collections').select('id', { count: 'exact' }).eq('parent_id', collectionId)
  ]);

  return {
    videos: videos.count || 0,
    slideshows: slideshows.count || 0,
    subcollections: subcollections.count || 0,
    total_items: (videos.count || 0) + (slideshows.count || 0)
  };
}

export async function createCollection(
  userId: string,
  name: string,
  description?: string,
  parentId?: string,
  collectionType: 'videos' | 'slideshows' | 'mixed' = 'mixed',
  color: string = '#3B82F6',
  icon: string = 'folder'
): Promise<MediaCollection | null> {
  const supabase = getWorkingSupabaseClient();
  if (!supabase) {
    console.error('Supabase client not initialized');
    return null;
  }

  const { data, error } = await supabase
    .from('generated_media_collections')
    .insert({
      user_id: userId,
      name,
      description,
      parent_id: parentId,
      collection_type: collectionType,
      color,
      icon
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating collection:', error);
    return null;
  }

  return data;
}

export async function updateCollection(
  collectionId: string,
  updates: Partial<MediaCollection>
): Promise<boolean> {
  const supabase = getWorkingSupabaseClient();
  if (!supabase) {
    console.error('Supabase client not initialized');
    return false;
  }

  const { error } = await supabase
    .from('generated_media_collections')
    .update(updates)
    .eq('id', collectionId);

  if (error) {
    console.error('Error updating collection:', error);
    return false;
  }

  return true;
}

export async function deleteCollection(collectionId: string): Promise<boolean> {
  const supabase = getWorkingSupabaseClient();
  if (!supabase) {
    console.error('Supabase client not initialized');
    return false;
  }

  const { error } = await supabase
    .from('generated_media_collections')
    .delete()
    .eq('id', collectionId);

  if (error) {
    console.error('Error deleting collection:', error);
    return false;
  }

  return true;
}

// ========== Media Movement ==========

export async function moveVideoToCollection(
  videoId: string,
  collectionId: string | null
): Promise<boolean> {
  const supabase = getWorkingSupabaseClient();
  if (!supabase) {
    console.error('Supabase client not initialized');
    return false;
  }

  const { error } = await supabase
    .from('generated_videos')
    .update({ collection_id: collectionId })
    .eq('id', videoId);

  if (error) {
    console.error('Error moving video to collection:', error);
    return false;
  }

  return true;
}

export async function moveSlideshowToCollection(
  slideshowId: string,
  collectionId: string | null
): Promise<boolean> {
  const supabase = getWorkingSupabaseClient();
  if (!supabase) {
    console.error('Supabase client not initialized');
    return false;
  }

  const { error } = await supabase
    .from('generated_slideshows')
    .update({ collection_id: collectionId })
    .eq('id', slideshowId);

  if (error) {
    console.error('Error moving slideshow to collection:', error);
    return false;
  }

  return true;
}

export async function moveMultipleItemsToCollection(
  items: { type: 'video' | 'slideshow'; id: string }[],
  collectionId: string | null
): Promise<boolean> {
  const videoIds = items.filter(item => item.type === 'video').map(item => item.id);
  const slideshowIds = items.filter(item => item.type === 'slideshow').map(item => item.id);

  const promises = [];

  if (videoIds.length > 0) {
    promises.push(
      ...videoIds.map(id => moveVideoToCollection(id, collectionId))
    );
  }

  if (slideshowIds.length > 0) {
    promises.push(
      ...slideshowIds.map(id => moveSlideshowToCollection(id, collectionId))
    );
  }

  const results = await Promise.all(promises);
  return results.every(result => result === true);
}

// ========== Collection Path ==========

export async function getCollectionPath(collectionId: string): Promise<MediaCollection[]> {
  const supabase = getWorkingSupabaseClient();
  if (!supabase) {
    console.error('Supabase client not initialized');
    return [];
  }

  // Get the collection and all its parents
  const path: MediaCollection[] = [];
  let currentId: string | null = collectionId;

  while (currentId) {
    const { data, error } = await supabase
      .from('generated_media_collections')
      .select('*')
      .eq('id', currentId)
      .single();

    if (error || !data) break;

    path.unshift(data);
    currentId = data.parent_id;
  }

  return path;
}

// ========== Collection Content ==========

export async function getCollectionWithMedia(
  collectionId: string
): Promise<MediaCollection & { videos?: any[]; slideshows?: any[] } | null> {
  const supabase = getWorkingSupabaseClient();
  if (!supabase) {
    console.error('Supabase client not initialized');
    return null;
  }

  // Get collection details
  const { data: collection, error: collectionError } = await supabase
    .from('generated_media_collections')
    .select('*')
    .eq('id', collectionId)
    .single();

  if (collectionError || !collection) {
    console.error('Error fetching collection:', collectionError);
    return null;
  }

  // Get videos in this collection
  const { data: videos, error: videosError } = await supabase
    .from('generated_videos')
    .select('*')
    .eq('collection_id', collectionId)
    .order('created_at', { ascending: false });

  if (videosError) {
    console.error('Error fetching videos:', videosError);
  }

  // Get slideshows in this collection
  const { data: slideshows, error: slideshowsError } = await supabase
    .from('generated_slideshows')
    .select('*')
    .eq('collection_id', collectionId)
    .order('created_at', { ascending: false });

  if (slideshowsError) {
    console.error('Error fetching slideshows:', slideshowsError);
  }

  return {
    ...collection,
    videos: videos || [],
    slideshows: slideshows || []
  };
}

export async function removeVideoFromCollection(videoId: string): Promise<boolean> {
  return moveVideoToCollection(videoId, null);
}

export async function removeSlideshowFromCollection(slideshowId: string): Promise<boolean> {
  return moveSlideshowToCollection(slideshowId, null);
}

export async function getCollectionContent(
  collectionId: string | null,
  userId: string
): Promise<{
  subcollections: MediaCollection[];
  videos: any[];
  slideshows: any[];
}> {
  const supabase = getWorkingSupabaseClient();
  if (!supabase) {
    return { subcollections: [], videos: [], slideshows: [] };
  }

  // Get subcollections
  const subcollections = await getUserCollections(userId, collectionId || undefined);

  // Get videos and slideshows
  const videoQuery = supabase
    .from('generated_videos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const slideshowQuery = supabase
    .from('generated_slideshows')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  // Filter by collection
  if (collectionId) {
    videoQuery.eq('collection_id', collectionId);
    slideshowQuery.eq('collection_id', collectionId);
  } else {
    videoQuery.is('collection_id', null);
    slideshowQuery.is('collection_id', null);
  }

  const [videosResult, slideshowsResult] = await Promise.all([
    videoQuery,
    slideshowQuery
  ]);

  return {
    subcollections,
    videos: videosResult.data || [],
    slideshows: slideshowsResult.data || []
  };
}