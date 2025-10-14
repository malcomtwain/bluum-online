import { getSupabaseServiceClient } from './supabase-singleton';
import { saveGeneratedVideo, saveGeneratedSlideshow } from './generated-media-db';
import path from 'path';
import fs from 'fs/promises';

/**
 * Upload a generated video to Supabase storage and save metadata to database
 */
export async function uploadAndSaveGeneratedVideo(
  userId: string,
  localFilePath: string,
  fileName: string,
  modelType?: string,
  metadata?: any
): Promise<{ url: string; id: string } | null> {
  try {
    console.log('🚀 Starting video upload to Supabase...');
    console.log('User ID:', userId);
    console.log('File path:', localFilePath);
    console.log('File name:', fileName);
    
    const supabase = getSupabaseServiceClient();
    if (!supabase) {
      console.error('❌ Supabase client not initialized - missing service key');
      console.error('SUPABASE_SERVICE_KEY exists:', !!process.env.SUPABASE_SERVICE_KEY);
      console.error('NEXT_PUBLIC_SUPABASE_URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
      return null;
    }
    
    // Check if file exists
    try {
      await fs.access(localFilePath);
      console.log('✅ Local file exists');
    } catch {
      console.error('❌ Local file does not exist:', localFilePath);
      return null;
    }
    
    // Read the file
    const fileBuffer = await fs.readFile(localFilePath);
    console.log('📦 File buffer size:', fileBuffer.length, 'bytes');
    const fileBlob = new Blob([fileBuffer], { type: 'video/mp4' });
    
    // Create unique path in storage
    const timestamp = Date.now();
    const storagePath = `${userId}/videos/${timestamp}_${fileName}`;
    console.log('📁 Storage path:', storagePath);
    
    // Upload to Supabase storage
    console.log('⬆️ Uploading to Supabase storage...');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('generated-media')
      .upload(storagePath, fileBlob, {
        contentType: 'video/mp4',
        cacheControl: '3600',
        upsert: false
      });
    
    if (uploadError) {
      console.error('❌ Error uploading video to storage:', uploadError);
      console.error('Upload error details:', JSON.stringify(uploadError, null, 2));
      return null;
    }
    
    console.log('✅ Upload successful:', uploadData);
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('generated-media')
      .getPublicUrl(storagePath);
    
    console.log('🔗 Public URL:', publicUrl);
    
    // Save metadata to database
    console.log('💾 Saving metadata to database...');
    const savedVideo = await saveGeneratedVideo(
      userId,
      fileName,
      storagePath,
      publicUrl,
      modelType,
      metadata
    );
    
    if (!savedVideo) {
      console.error('❌ Failed to save video metadata to database');
      // If saving to DB failed, clean up the uploaded file
      await supabase.storage
        .from('generated-media')
        .remove([storagePath]);
      return null;
    }
    
    console.log('✅ Video saved successfully with ID:', savedVideo.id);
    
    return {
      url: publicUrl,
      id: savedVideo.id
    };
  } catch (error) {
    console.error('Error uploading and saving video:', error);
    return null;
  }
}

/**
 * Upload a generated slideshow to Supabase storage and save metadata to database
 */
export async function uploadAndSaveGeneratedSlideshow(
  userId: string,
  localFilePath: string,
  fileName: string,
  imageCount?: number,
  styleType?: number,
  metadata?: any
): Promise<{ url: string; id: string; file_url: string } | null> {
  try {
    console.log('🎬 Starting slideshow save process...');
    console.log('User ID:', userId);
    console.log('File name:', fileName);
    console.log('Local path:', localFilePath);
    
    // For slideshows, we save the folder path - images will be accessed individually
    const publicUrl = `/generated-slideshows/${fileName}`;
    console.log('Public URL:', publicUrl);
    
    const savedSlideshow = await saveGeneratedSlideshow(
      userId,
      fileName,
      localFilePath,
      publicUrl,
      imageCount,
      styleType,
      metadata
    );
    
    if (savedSlideshow) {
      console.log('✅ Slideshow saved to database with ID:', savedSlideshow.id);
      return {
        url: publicUrl,
        id: savedSlideshow.id,
        file_url: publicUrl
      };
    } else {
      console.error('❌ Failed to save slideshow to database');
      return null;
    }
  } catch (error) {
    console.error('Error uploading and saving slideshow:', error);
    return null;
  }
}

/**
 * Migrate existing local files to Supabase (for existing generated content)
 */
export async function migrateLocalMediaToSupabase(
  userId: string,
  localPath: string,
  mediaType: 'video' | 'slideshow',
  modelType?: string
): Promise<{ url: string; id: string } | null> {
  try {
    const fileName = path.basename(localPath);
    
    if (mediaType === 'video') {
      return await uploadAndSaveGeneratedVideo(userId, localPath, fileName, modelType);
    } else {
      return await uploadAndSaveGeneratedSlideshow(userId, localPath, fileName);
    }
  } catch (error) {
    console.error('Error migrating media:', error);
    return null;
  }
}