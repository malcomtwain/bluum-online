import { useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, uploadFile, getFileUrl, deleteFile, uploadFileWithFallback, getFileUrlWithFallback } from '@/lib/supabase';

// Import conditionnel pour éviter le problème pendant la compilation
let ffmpegModule: any = null;
if (typeof window !== 'undefined') {
  // Seulement import côté client
  import('@/lib/ffmpeg').then(module => {
    ffmpegModule = module;
  }).catch(err => {
    console.warn('Erreur lors du chargement du module ffmpeg:', err);
  });
}

export function useSupabase() {
  // Vérifier si nous sommes dans un contexte SSR/Prérendu statique
  const isStaticRendering = typeof window === 'undefined' && process.env.NODE_ENV === 'production';
  
  // Utiliser notre système d'authentification
  const { user } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fonction pour synchroniser les données utilisateur avec Supabase
  const syncUser = useCallback(async (userData: { 
    id: string; 
    email?: string; 
    username?: string;
    fullName?: string;
    avatarUrl?: string; 
  }) => {
    if (!userData.id) return;
    
    try {
      // First check if user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('user_id', userData.id)
        .single();
      
      if (existingUser) {
        // Update existing user
        await supabase
          .from('users')
          .update({
            email: userData.email || '',
            username: userData.username || '',
            last_login: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userData.id);
      } else {
        // Insert new user
        await supabase
          .from('users')
          .insert({
            user_id: userData.id,
            email: userData.email || '',
            username: userData.username || '',
          });
      }
    } catch (error) {
      console.error('Error syncing user data:', error);
    }
  }, []);

  const createProject = useCallback(async (name: string) => {
    if (!user) throw new Error('User not authenticated');
    
    setIsLoading(true);
    setError(null);
    
    try {
      // First, ensure user exists in our database
      let userData;
      let userError;
      
      // Check if user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', user.id)
        .single();
        
      if (existingUser) {
        userData = existingUser;
      } else {
        // Create user if doesn't exist
        const { data, error } = await supabase
          .from('users')
          .insert({
            user_id: user.id,
            email: user.email || '',
          })
          .select()
          .single();
        userData = data;
        userError = error;
      }

      if (userError) throw userError;

      // Then create the project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          user_id: userData.user_id || user.id,
          name,
        })
        .select()
        .single();

      if (projectError) throw projectError;
      return project;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const uploadTemplate = useCallback(async (file: File, projectId: string, position: { x: number; y: number; scale: number }, duration: number) => {
    if (!user) throw new Error('User not authenticated');
    
    setIsLoading(true);
    setError(null);
    
    try {
      const path = `${user.id}/${projectId}/templates/${Date.now()}-${file.name}`;
      
      // Use the enhanced upload function with local storage fallback
      const uploadResult = await uploadFileWithFallback(file, 'templates', path);
      
      // Create a record in the database if using Supabase storage
      let templateData;
      
      if (uploadResult.storage === 'supabase') {
        // If using Supabase, create a record in the database
        const { data, error } = await supabase
          .from('templates')
          .insert({
            project_id: projectId,
            storage_path: path,
            position_x: position.x,
            position_y: position.y,
            scale: position.scale,
            duration,
          })
          .select()
          .single();

        if (error) {
          console.warn('Failed to insert template record in database:', error);
          // Continue with local fallback even if database insert fails
        } else {
          templateData = data;
        }
      }
      
      // If no template data from database, create a local version
      if (!templateData) {
        const timestamp = new Date().toISOString();
        templateData = {
          id: `local_${Date.now()}`,
          project_id: projectId,
          storage_path: uploadResult.path,
          position_x: position.x,
          position_y: position.y,
          scale: position.scale,
          duration,
          created_at: timestamp,
          storage_type: uploadResult.storage
        };
        
        // Store template metadata in localStorage for persistence
        try {
          const localTemplates = JSON.parse(localStorage.getItem('local_templates') || '[]');
          localTemplates.push(templateData);
          localStorage.setItem('local_templates', JSON.stringify(localTemplates));
        } catch (e) {
          console.warn('Failed to store template metadata in localStorage:', e);
        }
      } else {
        // Add storage type to the template data
        templateData.storage_type = uploadResult.storage;
      }
      
      return templateData;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const uploadMedia = useCallback(async (file: File, projectId: string, type: 'image' | 'video', duration: number, orderIndex: number) => {
    if (!user) throw new Error('User not authenticated');
    
    setIsLoading(true);
    setError(null);
    
    try {
      const path = `${user.id}/${projectId}/media/${Date.now()}-${file.name}`;
      await uploadFile(file, 'media', path);

      const { data, error } = await supabase
        .from('media')
        .insert({
          project_id: projectId,
          storage_path: path,
          type,
          duration,
          order_index: orderIndex,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const uploadMusic = useCallback(async (file: File, projectId: string, orderIndex: number) => {
    if (!user) throw new Error('User not authenticated');
    
    setIsLoading(true);
    setError(null);
    
    try {
      const path = `${user.id}/${projectId}/music/${Date.now()}-${file.name}`;
      await uploadFile(file, 'music', path);

      const { data, error } = await supabase
        .from('music')
        .insert({
          project_id: projectId,
          storage_path: path,
          order_index: orderIndex,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const addHook = useCallback(async (projectId: string, text: string, position: { x: number; y: number }) => {
    if (!user) throw new Error('User not authenticated');
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('hooks')
        .insert({
          project_id: projectId,
          text,
          position_x: position.x,
          position_y: position.y,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const generateImages = useCallback(async (projectId: string, templateId: string, hookId: string, fontType: 'withBackground' | 'normal' | 'withBackgroundBlack') => {
    if (!user) throw new Error('User not authenticated');
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Get the template and hook data
      const { data: template, error: templateError } = await supabase
        .from('templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (templateError) throw templateError;

      const { data: hook, error: hookError } = await supabase
        .from('hooks')
        .select('*')
        .eq('id', hookId)
        .single();

      if (hookError) throw hookError;

      // Get the template image URL
      const templateUrl = await getFileUrl('templates', template.storage_path);

      // Generate the image with FFmpeg
      const imageBlob = await ffmpegModule.generateImageWithHook(
        templateUrl,
        hook.text,
        {
          type: fontType === 'withBackgroundBlack' ? 3 : fontType === 'withBackground' ? 2 : 1,
          position: 'middle',
          offset: 0
        }
      );

      // Convert Blob to File
      const filename = `${Date.now()}-image.png`;
      const imageFile = new File([imageBlob], filename, { type: 'image/png' });

      // Upload the generated image
      const path = `${user.id}/${projectId}/generated/${filename}`;
      await uploadFile(imageFile, 'generated', path);

      // Save the generated image to the database
      const { data, error } = await supabase
        .from('generated_images')
        .insert({
          project_id: projectId,
          template_id: templateId,
          hook_id: hookId,
          storage_path: path,
          font_type: fontType,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const generateVideo = useCallback(async (
    projectId: string,
    generatedImageId: string,
    mediaId: string,
    musicId: string | null
  ) => {
    if (!user) throw new Error('User not authenticated');
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Get all the necessary data
      const { data: generatedImage, error: imageError } = await supabase
        .from('generated_images')
        .select(`
          *,
          template:templates(*),
          hook:hooks(*)
        `)
        .eq('id', generatedImageId)
        .single();

      if (imageError) throw imageError;

      const { data: media, error: mediaError } = await supabase
        .from('media')
        .select('*')
        .eq('id', mediaId)
        .single();

      if (mediaError) throw mediaError;

      const { data: music, error: musicError } = musicId ? await supabase
        .from('music')
        .select('*')
        .eq('id', musicId)
        .single() : { data: null, error: null };

      if (musicError) throw musicError;

      // Get all the file URLs
      const imageUrl = await getFileUrl('generated', generatedImage.storage_path);
      const mediaUrl = await getFileUrl('media', media.storage_path);
      const musicUrl = music ? await getFileUrl('music', music.storage_path) : null;

      // Generate the video with FFmpeg
      const videoBlob = await ffmpegModule.generateVideoWithFFmpeg({
        templateImage: imageUrl,
        mediaFile: mediaUrl,
        hookText: generatedImage.hook.text,
        hookStyle: {
          type: generatedImage.font_type === 'withBackgroundBlack' ? 3 : generatedImage.font_type === 'withBackground' ? 2 : 1,
          position: 'middle',
          offset: 0
        },
        musicFile: musicUrl || undefined
      });

      // Convert Blob to File
      const filename = `${Date.now()}-video.mp4`;
      const videoFile = new File([videoBlob], filename, { type: 'video/mp4' });

      // Upload the generated video
      const path = `${user.id}/${projectId}/generated/${filename}`;
      await uploadFile(videoFile, 'generated', path);

      // Save the generated video to the database
      const { data, error } = await supabase
        .from('generated_videos')
        .insert({
          project_id: projectId,
          generated_image_id: generatedImageId,
          media_id: mediaId,
          music_id: musicId,
          storage_path: path,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return {
    syncUser,
    createProject,
    uploadTemplate,
    uploadMedia,
    uploadMusic,
    addHook,
    generateImages,
    generateVideo,
    isLoading,
    error,
  };
} 