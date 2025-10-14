import { PostBridgeAPI } from './post-bridge';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface ScheduledPost {
  id: string;
  user_id: string;
  content: string;
  media_urls: string[];
  media_ids: string[];
  scheduled_for: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  platform: string;
  social_account_id: number;
  social_account_name?: string;
  controls?: any;
  created_at?: string;
  updated_at?: string;
  error_message?: string;
  post_bridge_post_id?: string;
}

export class PostBridgeScheduler {
  private apiKey: string;
  private postBridgeApi: PostBridgeAPI;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.postBridgeApi = new PostBridgeAPI(apiKey);
  }
  
  // Upload media files to Post-bridge
  async uploadMediaToPostBridge(files: File[]): Promise<{ ids: string[], urls: string[] }> {
    const ids: string[] = [];
    const urls: string[] = [];
    
    for (const file of files) {
      try {
        const mediaId = await this.postBridgeApi.uploadMedia(file);
        ids.push(mediaId);
        
        // Get the media object to retrieve the URL
        const media = await this.postBridgeApi.getMediaById(mediaId);
        if (media.object.url) {
          urls.push(media.object.url);
        }
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        throw error;
      }
    }
    
    return { ids, urls };
  }
  
  // Create a draft post in Supabase
  async createDraftPost(
    userId: string,
    content: string,
    scheduledFor: Date,
    platform: string,
    socialAccountId: number,
    socialAccountName: string,
    mediaFiles?: File[],
    controls?: any
  ): Promise<ScheduledPost> {
    let mediaIds: string[] = [];
    let mediaUrls: string[] = [];
    
    // Upload media if provided
    if (mediaFiles && mediaFiles.length > 0) {
      const uploadResult = await this.uploadMediaToPostBridge(mediaFiles);
      mediaIds = uploadResult.ids;
      mediaUrls = uploadResult.urls;
    }
    
    // Save to Supabase with new structure for post-bridge
    const { data, error } = await supabase
      .from('scheduled_posts')
      .insert({
        user_id: userId,
        content,
        media_urls: mediaUrls,
        media_ids: mediaIds, // New field for post-bridge media IDs
        scheduled_for: scheduledFor.toISOString(),
        status: 'draft',
        platform,
        social_account_id: socialAccountId,
        social_account_name: socialAccountName,
        controls: controls || {}
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  // Schedule a post with Post-bridge
  async schedulePost(postId: string): Promise<void> {
    // Get post from database
    const { data: post, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('id', postId)
      .single();
    
    if (error || !post) {
      throw new Error('Post not found');
    }
    
    try {
      // Prepare platform configurations
      const platformConfigurations: any = {};
      
      // Handle TikTok specific settings
      if (post.platform.toLowerCase() === 'tiktok' && post.controls) {
        platformConfigurations.tiktok = {
          caption: post.content,
          draft: post.controls.tiktokIsDraft || false,
          is_aigc: post.controls.tiktokIsAigc || false,
        };
        
        // Add media if available
        if (post.media_ids && post.media_ids.length > 0) {
          platformConfigurations.tiktok.media = post.media_ids;
        }
      }
      
      // Handle Instagram specific settings
      if (post.platform.toLowerCase() === 'instagram' && post.controls) {
        platformConfigurations.instagram = {
          caption: post.content,
        };
        
        if (post.media_ids && post.media_ids.length > 0) {
          platformConfigurations.instagram.media = post.media_ids;
        }
      }
      
      // Create post with Post-bridge API
      const postBridgePost = await this.postBridgeApi.createPost({
        caption: post.content,
        scheduled_at: post.scheduled_for,
        social_accounts: [post.social_account_id],
        media: post.media_ids.length > 0 ? post.media_ids : undefined,
        platform_configurations: Object.keys(platformConfigurations).length > 0 ? platformConfigurations : undefined,
        is_draft: post.controls?.tiktokIsDraft || false,
        processing_enabled: true
      });
      
      // Update post status in database
      await supabase
        .from('scheduled_posts')
        .update({
          status: 'scheduled',
          post_bridge_post_id: postBridgePost.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', postId);
        
    } catch (error: any) {
      // Update post with error
      await supabase
        .from('scheduled_posts')
        .update({
          status: 'failed',
          error_message: error.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', postId);
        
      throw error;
    }
  }
  
  // Get all scheduled posts for a user
  async getScheduledPosts(userId: string): Promise<ScheduledPost[]> {
    const { data, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_for', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }
  
  // Update a post
  async updatePost(postId: string, updates: Partial<ScheduledPost>): Promise<void> {
    const { error } = await supabase
      .from('scheduled_posts')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', postId);
    
    if (error) throw error;
  }
  
  // Delete a post
  async deletePost(postId: string): Promise<void> {
    // Get post to check if it has a Post-bridge ID
    const { data: post } = await supabase
      .from('scheduled_posts')
      .select('post_bridge_post_id, media_ids')
      .eq('id', postId)
      .single();
    
    // Delete from Post-bridge if scheduled
    if (post?.post_bridge_post_id) {
      try {
        await this.postBridgeApi.deletePost(post.post_bridge_post_id);
      } catch (error) {
        console.error('Failed to delete from Post-bridge:', error);
      }
    }
    
    // Clean up media files
    if (post?.media_ids && post.media_ids.length > 0) {
      for (const mediaId of post.media_ids) {
        try {
          await this.postBridgeApi.deleteMedia(mediaId);
        } catch (error) {
          console.error(`Failed to delete media ${mediaId}:`, error);
        }
      }
    }
    
    // Delete from database
    const { error } = await supabase
      .from('scheduled_posts')
      .delete()
      .eq('id', postId);
    
    if (error) throw error;
  }
  
  // Get social accounts from Post-bridge
  async getSocialAccounts(): Promise<any[]> {
    const response = await this.postBridgeApi.getSocialAccounts({ limit: 100 });
    return response.data;
  }
  
  // Get post results for monitoring
  async getPostResults(postIds?: string[]): Promise<any[]> {
    const response = await this.postBridgeApi.getPostResults({
      post_id: postIds,
      limit: 100
    });
    return response.data;
  }
}