import { getSupabaseClient } from './supabase-singleton';

export const supabase = getSupabaseClient();

export type UserSong = {
  id: string;
  user_id: string;
  title: string;
  artist: string | null;
  duration: number;
  url: string;
  cover_url: string | null;
  created_at: string;
};

export type Template = {
  id: string;
  project_id: string;
  storage_path: string;
  position_x: number;
  position_y: number;
  scale: number;
  duration: number;
  created_at: string;
};

// Videos Library types
export type UserFolder = {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
};

export type UserClip = {
  id: string;
  user_id: string;
  title: string | null;
  file_name: string;
  path: string; // data URL or public URL
  storage_provider: string | null;
  is_temporary: boolean | null;
  expires_at: string | null;
  folder_id: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Upload file to Supabase Storage
export const uploadSongToStorage = async (file: File, userId: string): Promise<string> => {
  try {
    if (!supabase) {
      throw new Error('Database connection not available');
    }
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    
    console.log('Uploading to storage:', fileName, 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    
    const { data, error } = await supabase.storage
      .from('songs')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Storage upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('songs')
      .getPublicUrl(fileName);

    console.log('File uploaded successfully to storage:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadSongToStorage:', error);
    throw error;
  }
};

export const saveSong = async (song: Omit<UserSong, 'id' | 'created_at'>, retryCount = 0): Promise<any> => {
  try {
    if (!supabase) {
      throw new Error('Database connection not available');
    }
    
    console.log('Attempting to save song:', { ...song, url: 'REDACTED' });
    
    // Ensure user_id is a string
    const userId = String(song.user_id);
    
    // Convert base64 data URL to blob
    let storageUrl = song.url;
    if (song.url && song.url.startsWith('data:')) {
      // Extract base64 data from data URL
      const base64Data = song.url.split(',')[1];
      const mimeType = song.url.match(/data:([^;]+)/)?.[1] || 'audio/mpeg';
      
      // Convert base64 to blob
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      
      // Check file size
      const fileSizeMB = blob.size / (1024 * 1024);
      console.log('Song file size:', fileSizeMB.toFixed(2), 'MB');
      
      if (fileSizeMB > 50) {
        throw new Error('Song file is too large. Please use a smaller file (max 50MB).');
      }
      
      // Upload to Supabase Storage
      const fileName = `${userId}/${Date.now()}_${song.title?.replace(/[^a-z0-9]/gi, '_') || 'song'}.mp3`;
      console.log('Uploading to Storage:', fileName);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('music')
        .upload(fileName, blob, {
          contentType: mimeType,
          upsert: false
        });
      
      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('music')
        .getPublicUrl(fileName);
      
      storageUrl = urlData.publicUrl;
      console.log('File uploaded to Storage:', storageUrl);
    }
    
    // Save song metadata to database with Storage URL
    const songData = {
      ...song,
      user_id: userId,
      url: storageUrl
    };
    
    const { data, error } = await supabase
      .from('songs')
      .insert([songData])
      .select()
      .single();

    if (error) {
      console.error('Supabase error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      
      // Gestion spécifique des timeouts avec retry
      if (error.code === '57014' && retryCount < 2) {
        console.log(`Timeout occurred, retrying... (attempt ${retryCount + 1}/3)`);
        await sleep(2000 * (retryCount + 1)); // Attendre plus longtemps à chaque retry
        return saveSong(song, retryCount + 1);
      }
      
      if (error.code === '57014') {
        throw new Error('Song upload timed out after multiple attempts. Please try with a smaller file (recommended: under 15MB).');
      }
      
      throw new Error(`Failed to save song: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned from insert operation');
    }

    console.log('Song saved successfully:', { id: data.id, title: data.title });
    return data;
  } catch (error) {
    console.error('Error in saveSong:', error);
    throw error;
  }
};

// Combined function: upload file to storage + save metadata to database
export const uploadAndSaveSong = async (
  file: File,
  songMetadata: Omit<UserSong, 'id' | 'created_at' | 'url'>
): Promise<any> => {
  try {
    console.log('Starting song upload process...');
    
    // 1. Upload file to Supabase Storage
    const storageUrl = await uploadSongToStorage(file, songMetadata.user_id);
    
    // 2. Save metadata with storage URL to database
    const songWithUrl = {
      ...songMetadata,
      url: storageUrl
    };
    
    const savedSong = await saveSong(songWithUrl);
    
    console.log('Song upload process completed successfully!');
    return savedSong;
  } catch (error) {
    console.error('Error in uploadAndSaveSong:', error);
    throw error;
  }
};

// -------- Videos Library (folders) --------
export async function getUserFolders(userId: string): Promise<UserFolder[]> {
  const { data, error } = await supabase
    .from('user_folders')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createUserFolder(userId: string, name: string, parentId: string | null = null): Promise<UserFolder> {
  const { data, error } = await supabase
    .from('user_folders')
    .insert([{ user_id: userId, name, parent_id: parentId }])
    .select('*')
    .single();
  if (error) throw error;
  return data as UserFolder;
}

export async function renameUserFolder(folderId: string, name: string): Promise<UserFolder> {
  const { data, error } = await supabase
    .from('user_folders')
    .update({ name })
    .eq('id', folderId)
    .select('*')
    .single();
  if (error) throw error;
  return data as UserFolder;
}

export async function deleteUserFolder(folderId: string): Promise<void> {
  const { error } = await supabase
    .from('user_folders')
    .delete()
    .eq('id', folderId);
  if (error) throw error;
}

// -------- Videos Library (clips) --------
export async function saveClip(clip: Omit<UserClip, 'id' | 'created_at' | 'updated_at'>): Promise<UserClip> {
  const { data, error } = await supabase
    .from('user_clips')
    .insert([clip])
    .select('*')
    .single();
  if (error) throw error;
  return data as UserClip;
}

export async function getUserClips(userId: string, folderId: string | null): Promise<UserClip[]> {
  let query = supabase
    .from('user_clips')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (folderId === null) {
    query = query.is('folder_id', null);
  } else {
    query = query.eq('folder_id', folderId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function moveClipToFolder(clipId: string, folderId: string | null): Promise<UserClip> {
  const { data, error } = await supabase
    .from('user_clips')
    .update({ folder_id: folderId })
    .eq('id', clipId)
    .select('*')
    .single();
  if (error) throw error;
  return data as UserClip;
}

export async function deleteClip(clipId: string): Promise<void> {
  const { error } = await supabase
    .from('user_clips')
    .delete()
    .eq('id', clipId);
  if (error) throw error;
}

export async function getUserSongs(userId: string): Promise<UserSong[]> {
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export const deleteSong = async (songId: string) => {
  const { error } = await supabase
    .from('songs')
    .delete()
    .eq('id', songId);

  if (error) throw error;
};

export const updateSongDetails = async (songId: string, updates: Partial<UserSong>) => {
  try {
    console.log('Attempting to update song:', { songId, updates });
    
    const { data, error } = await supabase
      .from('songs')
      .update(updates)
      .eq('id', songId)
      .select()
      .single();

    if (error) {
      console.error('Supabase error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw new Error(`Failed to update song: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned from update operation');
    }

    console.log('Song updated successfully:', { id: data.id, title: data.title });
    return data;
  } catch (error) {
    console.error('Error in updateSongDetails:', error);
    throw error;
  }
};

// List of all required buckets for the application
export const REQUIRED_BUCKETS = ['templates', 'media', 'music', 'generated-media', 'clips'];

// Function to create a public bucket with RLS disabled
export async function createPublicBucket(bucketName: string) {
  try {
    console.log(`Creating public bucket '${bucketName}'...`);
    
    // Create the bucket with public access
    const { error } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['image/*', 'video/*', 'audio/*']
    });
    
    if (error) {
      console.warn(`Error creating bucket '${bucketName}': ${error.message}`);
      return false;
    }
    
    console.log(`Successfully created bucket '${bucketName}'`);
    return true;
  } catch (error) {
    console.warn(`Exception creating bucket '${bucketName}':`, error);
    return false;
  }
}

export async function uploadFile(file: File, bucket: string, path: string) {
  try {
    // Try to ensure the bucket exists, but continue even if this fails
    try {
      await ensureBucketExists(bucket);
    } catch (bucketError) {
      console.warn(`Could not verify bucket '${bucket}', but will try upload anyway:`, bucketError);
    }
    
    // Attempt the upload
    let uploadResult = await attemptUpload(bucket, path, file);
    
    // If upload fails with bucket not found, try to create the bucket and retry
    if (!uploadResult.success && uploadResult.error?.message?.includes('bucket')) {
      console.log(`Bucket '${bucket}' not found, attempting to create it...`);
      const created = await createPublicBucket(bucket);
      
      if (created) {
        // Retry upload after bucket creation
        uploadResult = await attemptUpload(bucket, path, file);
      }
    }
    
    // If still failing, throw a user-friendly error
    if (!uploadResult.success) {
      if (uploadResult.error?.message?.includes('bucket') || uploadResult.error?.message?.includes('Bucket')) {
        throw new Error(`The storage bucket '${bucket}' does not exist or you don't have access to it. Please contact your administrator.`);
      } else if (uploadResult.error?.message?.includes('permission') || uploadResult.error?.message?.includes('access') || uploadResult.error?.message?.includes('policy')) {
        throw new Error(`You don't have permission to upload to '${bucket}'. This may be due to Row-Level Security (RLS) policies.`);
      } else {
        throw uploadResult.error || new Error('Unknown upload error');
      }
    }
    
    return uploadResult.data;
  } catch (error) {
    console.error(`Error uploading file to bucket '${bucket}':`, error);
    throw error;
  }
}

// Helper function to attempt an upload and return a structured result
async function attemptUpload(bucket: string, path: string, file: File) {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true // Overwrite if exists
      });
      
    return {
      success: !error,
      data,
      error
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

// Function to ensure a bucket exists
export async function ensureBucketExists(bucketName: string) {
  try {
    // First check if we can list buckets (admin access)
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.warn(`Cannot list buckets (RLS policy issue): ${listError.message}`);
      console.log(`Using local storage fallback for bucket '${bucketName}'`);
      return; // Exit early but don't throw
    }
    
    // Check if our bucket exists
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);
    
  // If bucket doesn't exist, we cannot create it from the client (anon key). Inform the user and return.
  if (!bucketExists) {
    console.warn(`Bucket '${bucketName}' does not exist and cannot be created from the client. Please create it via SQL migration or the Supabase dashboard. Falling back to local storage when needed.`);
  } else {
      console.log(`Bucket '${bucketName}' already exists`);
    }
  } catch (error) {
    // Log the error but don't throw - allow the app to continue
    console.warn(`Error checking bucket '${bucketName}':`, error);
    console.log(`Using local storage fallback for bucket '${bucketName}'`);
  }
}

export async function getTemplates(): Promise<Template[]> {
  try {
    // Get templates from Supabase
    let templates: Template[] = [];
    try {
      // Récupérer tous les templates
      const { data, error } = await supabase
        .from('templates')
        .select('*');

      if (error) {
        console.warn('Error fetching templates from Supabase:', error);
      } else if (data) {
        templates = data;
      }
    } catch (error) {
      console.warn('Failed to fetch templates from Supabase:', error);
    }
    
    // Get templates from local storage if available
    if (LocalStorageFallback.isAvailable()) {
      try {
        const localTemplatesStr = localStorage.getItem('local_templates');
        if (localTemplatesStr) {
          const localTemplates = JSON.parse(localTemplatesStr);
          if (Array.isArray(localTemplates)) {
            // Combine with Supabase templates
            templates = [...templates, ...localTemplates];
          }
        }
      } catch (error) {
        console.warn('Error fetching templates from local storage:', error);
      }
    }
    
    return templates;
  } catch (error) {
    console.error('Error in getTemplates:', error);
    return [];
  }
}

export async function getFileUrl(bucket: string, path: string) {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return data.publicUrl;
}

export async function deleteFile(bucket: string, path: string) {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) throw error;
}

// Function to initialize all required buckets
export async function initializeStorage() {
  console.log('Initializing Supabase storage buckets...');
  
  // Track which buckets were successfully initialized
  const results = {
    success: [] as string[],
    failed: [] as string[],
    rlsBlocked: [] as string[]
  };
  
  // First check if user has admin access to list buckets
  let hasAdminAccess = false;
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    hasAdminAccess = !error && Array.isArray(buckets);
    
    if (hasAdminAccess) {
      console.log('User has admin access to storage buckets');
    } else {
      console.warn('User does not have admin access to list buckets:', error?.message);
      if (error?.message.includes('row-level security') || error?.message.includes('permission')) {
        console.warn('RLS policies are blocking bucket access. Please run the SQL migration to create buckets manually.');
        console.warn('SQL to run in Supabase dashboard:');
        console.warn(`
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('templates', 'templates', true, 10485760, ARRAY['image/*', 'video/*']),
  ('media', 'media', true, 10485760, ARRAY['image/*', 'video/*']),
  ('music', 'music', true, 10485760, ARRAY['audio/*']),
  ('generated-media', 'generated-media', true, 10485760, ARRAY['video/*']),
  ('clips', 'clips', true, 10485760, ARRAY['video/*'])
ON CONFLICT (id) DO NOTHING;
        `);
      }
    }
  } catch (error) {
    console.warn('Error checking admin access:', error);
  }
  
  // Initialize each required bucket
  for (const bucket of REQUIRED_BUCKETS) {
    try {
      let success = false;
      
      if (hasAdminAccess) {
        // If we have admin access, use ensureBucketExists
        await ensureBucketExists(bucket);
        success = true;
      } else {
        // Otherwise try direct creation
        success = await createPublicBucket(bucket);
      }
      
      if (success) {
        results.success.push(bucket);
      } else {
        // Even if creation failed, the bucket might still exist and be usable
        // Try a test upload to verify
        try {
          const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
          const testPath = `test-${Date.now()}.txt`;
          const uploadResult = await attemptUpload(bucket, testPath, testFile);
          
          if (uploadResult.success) {
            console.log(`Bucket '${bucket}' exists and is usable`);
            results.success.push(bucket);
            
            // Clean up test file
            try {
              await supabase.storage.from(bucket).remove([testPath]);
            } catch (e) {
              // Ignore cleanup errors
            }
          } else {
            console.warn(`Bucket '${bucket}' is not usable:`, uploadResult.error);
            if (uploadResult.error && (uploadResult.error.message?.includes('row-level security') || uploadResult.error.message?.includes('permission'))) {
              results.rlsBlocked.push(bucket);
            } else {
              results.failed.push(bucket);
            }
          }
        } catch (testError) {
          console.warn(`Could not verify bucket '${bucket}' usability:`, testError);
          if (testError instanceof Error && (testError.message.includes('row-level security') || testError.message.includes('permission'))) {
            results.rlsBlocked.push(bucket);
          } else {
            results.failed.push(bucket);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to initialize bucket '${bucket}':`, error);
      if (error instanceof Error && (error.message.includes('row-level security') || error.message.includes('permission'))) {
        results.rlsBlocked.push(bucket);
      } else {
        results.failed.push(bucket);
      }
    }
  }
  
  // Log summary
  if (results.success.length > 0) {
    console.log(`Successfully initialized buckets: ${results.success.join(', ')}`);
  }
  
  if (results.rlsBlocked.length > 0) {
    console.warn(`Buckets blocked by RLS policies: ${results.rlsBlocked.join(', ')}`);
    console.warn('These buckets need to be created manually in Supabase dashboard or via SQL migration.');
    console.warn('The app will use local storage fallback for these buckets.');
  }
  
  if (results.failed.length > 0) {
    console.warn(`Failed to initialize buckets: ${results.failed.join(', ')}`);
  }
  
  // Return true if at least some buckets were initialized
  return results.success.length > 0;
}

// Fallback storage system when Supabase buckets are not accessible
export class LocalStorageFallback {
  static isAvailable() {
    try {
      return typeof window !== 'undefined' && window.localStorage && window.indexedDB;
    } catch (e) {
      return false;
    }
  }

  static async storeFile(file: File, bucket: string, path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Create a unique key for the file
        const key = `local_storage_${bucket}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Read the file as data URL
        const reader = new FileReader();
        reader.onload = () => {
          try {
            // Store the file data in localStorage
            localStorage.setItem(key, reader.result as string);
            console.log(`File stored locally with key: ${key}`);
            resolve(key);
          } catch (error) {
            console.error('Error storing file in localStorage:', error);
            reject(error);
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      } catch (error) {
        reject(error);
      }
    });
  }

  static getFileUrl(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.error('Error retrieving file from localStorage:', e);
      return null;
    }
  }
}

// Enhanced upload function with local storage fallback
export async function uploadFileWithFallback(file: File, bucket: string, path: string) {
  try {
    // First try to upload to Supabase
    console.log(`Attempting to upload to Supabase bucket '${bucket}'...`);
    try {
      const result = await uploadFile(file, bucket, path);
      console.log('Successfully uploaded to Supabase');
      return {
        storage: 'supabase',
        path,
        bucket,
        data: result
      };
    } catch (supabaseError) {
      console.warn('Supabase upload failed, trying local storage fallback:', supabaseError);
      
      // If Supabase fails, try local storage
      if (LocalStorageFallback.isAvailable()) {
        const localKey = await LocalStorageFallback.storeFile(file, bucket, path);
        console.log('Successfully stored in local storage');
        return {
          storage: 'local',
          path: localKey,
          bucket: 'local',
          data: { path: localKey }
        };
      } else {
        throw new Error('Local storage fallback is not available');
      }
    }
  } catch (error) {
    console.error('All storage methods failed:', error);
    throw error;
  }
}

// Enhanced function to get file URL with fallback
export async function getFileUrlWithFallback(storage: 'supabase' | 'local', bucket: string, path: string) {
  if (storage === 'local') {
    const url = LocalStorageFallback.getFileUrl(path);
    if (!url) {
      throw new Error('File not found in local storage');
    }
    return url;
  } else {
    return getFileUrl(bucket, path);
  }
}

// -------- Video/Media Upload Functions (Cloudinary replacement) --------

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      // Limiter la taille max à 1920x1920 tout en gardant le ratio
      const maxSize = 1920;
      let width = img.width;
      let height = img.height;
      
      if (width > height && width > maxSize) {
        height = (height * maxSize) / width;
        width = maxSize;
      } else if (height > maxSize) {
        width = (width * maxSize) / height;
        height = maxSize;
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            console.log(`Image compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/jpeg',
        0.85 // Qualité 85%
      );
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export const uploadToSupabase = async (
  file: File, 
  resourceType: 'video' | 'image', 
  userId?: string
): Promise<string> => {
  try {
    // Determine bucket based on resource type
    const bucket = resourceType === 'video' ? 'clips' : 'media';
    
    // Compresser l'image si elle est trop grosse (> 5MB)
    let uploadFile: File | Blob = file;
    if (resourceType === 'image' && file.size > 5 * 1024 * 1024) {
      console.log('Image too large, compressing...');
      uploadFile = await compressImage(file);
    }
    
    // Generate unique file path
    const fileExt = file.name.split('.').pop() || (resourceType === 'video' ? 'mp4' : 'jpg');
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const fileName = userId 
      ? `${userId}/${timestamp}_${randomStr}.${fileExt}`
      : `${timestamp}_${randomStr}.${fileExt}`;
    
    console.log(`Uploading ${resourceType} to Supabase:`, {
      bucket,
      fileName,
      size: `${(uploadFile.size / 1024 / 1024).toFixed(2)}MB`
    });
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, uploadFile, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error(`Supabase ${resourceType} upload error:`, error);
      throw new Error(`Failed to upload ${resourceType}: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    console.log(`${resourceType} uploaded successfully:`, urlData.publicUrl);
    return urlData.publicUrl;
    
  } catch (error) {
    console.error(`Error uploading ${resourceType} to Supabase:`, error);
    throw error;
  }
};

// Specific functions for different use cases
export const uploadVideoToSupabase = (file: File, userId?: string) => 
  uploadToSupabase(file, 'video', userId);

export const uploadImageToSupabase = (file: File, userId?: string) => 
  uploadToSupabase(file, 'image', userId);

// Function to save generated videos with metadata
export const saveGeneratedVideo = async (
  videoUrl: string,
  metadata: {
    user_id?: string;
    title?: string;
    model_type?: string;
    hook_text?: string;
    duration?: number;
    expires_at?: string;
  }
): Promise<any> => {
  try {
    const videoData = {
      path: videoUrl,
      user_id: metadata.user_id || 'anonymous',
      title: metadata.title || `Video ${Date.now()}`,
      file_name: videoUrl.split('/').pop() || 'video.mp4',
      storage_provider: 'supabase',
      is_temporary: true,
      expires_at: metadata.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      folder_id: null,
      metadata: {
        model_type: metadata.model_type,
        hook_text: metadata.hook_text,
        duration: metadata.duration,
        created_with: 'bluum_ai'
      }
    };

    const { data, error } = await supabase
      .from('user_clips')
      .insert([videoData])
      .select()
      .single();

    if (error) {
      console.error('Error saving generated video metadata:', error);
      throw new Error(`Failed to save video metadata: ${error.message}`);
    }

    console.log('Generated video metadata saved:', data.id);
    return data;
    
  } catch (error) {
    console.error('Error in saveGeneratedVideo:', error);
    throw error;
  }
};