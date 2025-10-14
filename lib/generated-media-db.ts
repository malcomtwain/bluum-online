import { getSupabaseClient } from './supabase-singleton';
import { createClient } from '@supabase/supabase-js';

// Fallback Supabase client with hardcoded values for debugging
const SUPABASE_URL = 'https://wjtguiusxvxaabutfxls.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqdGd1aXVzeHZ4YWFidXRmeGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNTkxMDksImV4cCI6MjA2ODkzNTEwOX0.4sIdI3m2QF_KP3EdmSR7N92pnET4ApLt_FNpuoR-234';

function getWorkingSupabaseClient() {
  const client = getSupabaseClient();
  if (client) return client;
  
  // Fallback: create client directly
  console.log('Creating fallback Supabase client...');
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Types
export interface GeneratedVideo {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_url: string;
  file_size?: number;
  duration?: number;
  model_type?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface GeneratedSlideshow {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_url: string;
  file_size?: number;
  duration?: number;
  image_count?: number;
  style_type?: number;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

// ========== VIDÉOS GÉNÉRÉES ==========

export async function getUserGeneratedVideos(userId: string, showOnlyWithoutCollection: boolean = true): Promise<GeneratedVideo[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('Supabase client not initialized');
    return [];
  }

  let query = supabase
    .from('generated_videos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  // Par défaut, on ne montre que les vidéos qui ne sont pas dans une collection
  if (showOnlyWithoutCollection) {
    query = query.is('collection_id', null);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching generated videos:', error);
    return [];
  }

  return data || [];
}

export async function saveGeneratedVideo(
  userId: string,
  fileName: string,
  filePath: string,
  fileUrl: string,
  modelType?: string,
  metadata?: any
): Promise<GeneratedVideo | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('Supabase client not initialized');
    return null;
  }

  console.log('💾 Attempting to save video to database...');
  console.log('Data to insert:', {
    user_id: userId,
    file_name: fileName,
    file_path: filePath,
    file_url: fileUrl,
    model_type: modelType,
    metadata: metadata || {}
  });
  
  const { data, error } = await supabase
    .from('generated_videos')
    .insert({
      user_id: userId,
      file_name: fileName,
      file_path: filePath,
      file_url: fileUrl,
      model_type: modelType,
      metadata: metadata || {}
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Error saving generated video to database:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return null;
  }

  console.log('✅ Video saved to database:', data);
  return data;
}

export async function deleteGeneratedVideo(videoId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('Supabase client not initialized');
    return false;
  }

  const { error } = await supabase
    .from('generated_videos')
    .delete()
    .eq('id', videoId);

  if (error) {
    console.error('Error deleting generated video:', error);
    return false;
  }

  return true;
}

export async function deleteGeneratedVideos(videoIds: string[]): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('Supabase client not initialized');
    return false;
  }

  const { error } = await supabase
    .from('generated_videos')
    .delete()
    .in('id', videoIds);

  if (error) {
    console.error('Error deleting generated videos:', error);
    return false;
  }

  return true;
}

// ========== SLIDESHOWS GÉNÉRÉS ==========

export async function getUserGeneratedSlideshows(userId: string, showOnlyWithoutCollection: boolean = true): Promise<GeneratedSlideshow[]> {
  const supabase = getWorkingSupabaseClient();
  if (!supabase) {
    console.error('Supabase client not initialized');
    return [];
  }

  let query = supabase
    .from('generated_slideshows')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  // Par défaut, on ne montre que les slideshows qui ne sont pas dans une collection
  if (showOnlyWithoutCollection) {
    query = query.is('collection_id', null);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching generated slideshows:', error);
    return [];
  }

  return data || [];
}

export async function saveGeneratedSlideshow(
  userId: string,
  fileName: string,
  filePath: string,
  fileUrl: string,
  imageCount?: number,
  styleType?: number,
  metadata?: any
): Promise<GeneratedSlideshow | null> {
  console.log('💾 Attempting to save slideshow to database...');
  console.log('Data:', { userId, fileName, filePath, fileUrl, imageCount, styleType });
  
  const supabase = getWorkingSupabaseClient();
  if (!supabase) {
    console.error('Supabase client not initialized');
    return null;
  }

  const { data, error } = await supabase
    .from('generated_slideshows')
    .insert({
      user_id: userId,
      file_name: fileName,
      file_path: filePath,
      file_url: fileUrl,
      image_count: imageCount,
      style_type: styleType,
      metadata: metadata || {}
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving generated slideshow:', error);
    return null;
  }

  return data;
}

export async function deleteGeneratedSlideshow(slideshowId: string): Promise<boolean> {
  const supabase = getWorkingSupabaseClient();
  if (!supabase) {
    console.error('Supabase client not initialized');
    return false;
  }

  const { error } = await supabase
    .from('generated_slideshows')
    .delete()
    .eq('id', slideshowId);

  if (error) {
    console.error('Error deleting generated slideshow:', error);
    return false;
  }

  return true;
}

export async function deleteGeneratedSlideshows(slideshowIds: string[]): Promise<boolean> {
  const supabase = getWorkingSupabaseClient();
  if (!supabase) {
    console.error('Supabase client not initialized');
    return false;
  }

  const { error } = await supabase
    .from('generated_slideshows')
    .delete()
    .in('id', slideshowIds);

  if (error) {
    console.error('Error deleting generated slideshows:', error);
    return false;
  }

  return true;
}

// ========== STATISTIQUES ==========

export async function getUserGeneratedMediaStats(userId: string) {
  const [videos, slideshows] = await Promise.all([
    getUserGeneratedVideos(userId),
    getUserGeneratedSlideshows(userId)
  ]);

  return {
    totalVideos: videos.length,
    totalSlideshows: slideshows.length,
    totalMedia: videos.length + slideshows.length,
    videos,
    slideshows
  };
}