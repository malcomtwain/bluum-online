import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface PostFastPost {
  id: string;
  user_id: string;
  postfast_post_id: string;
  content: string;
  media_urls: string[];
  scheduled_at?: string;
  platform: 'TIKTOK' | 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE' | 'X' | 'LINKEDIN';
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED';
  social_account_id?: string;
  social_account_name?: string;
  created_at: string;
  updated_at: string;
  error_message?: string;
  controls?: any;
}

export class PostFastPostsManager {
  
  // Save post after creation via PostFast API
  static async savePost(
    userId: string,
    postfastPostId: string,
    data: {
      content: string;
      mediaUrls?: string[];
      scheduledAt?: string;
      platform: string;
      status?: string;
      socialAccountId?: string;
      socialAccountName?: string;
      controls?: any;
    }
  ): Promise<PostFastPost | null> {
    try {
      const { data: post, error } = await supabase
        .from('postfast_posts')
        .insert({
          user_id: userId,
          postfast_post_id: postfastPostId,
          content: data.content,
          media_urls: data.mediaUrls || [],
          scheduled_at: data.scheduledAt,
          platform: data.platform,
          status: data.status || 'SCHEDULED',
          social_account_id: data.socialAccountId,
          social_account_name: data.socialAccountName,
          controls: data.controls
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving post:', error);
        return null;
      }

      return post;
    } catch (error) {
      console.error('Error saving post:', error);
      return null;
    }
  }

  // Get all posts for a user, optionally filtered by status
  static async getUserPosts(
    userId: string,
    status?: string,
    platform?: string
  ): Promise<PostFastPost[]> {
    try {
      let query = supabase
        .from('postfast_posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      if (platform) {
        query = query.eq('platform', platform);
      }

      const { data: posts, error } = await query;

      if (error) {
        console.error('Error fetching posts:', error);
        return [];
      }

      return posts || [];
    } catch (error) {
      console.error('Error fetching posts:', error);
      return [];
    }
  }

  // Update post status (for tracking when posts are published/failed)
  static async updatePostStatus(
    postId: string,
    status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED',
    errorMessage?: string
  ): Promise<boolean> {
    try {
      const updateData: any = { status };
      if (errorMessage) {
        updateData.error_message = errorMessage;
      }

      const { error } = await supabase
        .from('postfast_posts')
        .update(updateData)
        .eq('id', postId);

      if (error) {
        console.error('Error updating post status:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating post status:', error);
      return false;
    }
  }

  // Delete a post locally (and optionally from PostFast via API)
  static async deletePost(postId: string, postfastPostId?: string): Promise<boolean> {
    try {
      // Delete from PostFast API if postfastPostId provided
      if (postfastPostId) {
        // TODO: Call PostFast DELETE API when needed
        // const response = await fetch(`https://api.postfa.st/social-posts/${postfastPostId}`, {
        //   method: 'DELETE',
        //   headers: { 'pf-api-key': apiKey }
        // });
      }

      // Delete from local database
      const { error } = await supabase
        .from('postfast_posts')
        .delete()
        .eq('id', postId);

      if (error) {
        console.error('Error deleting post:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error deleting post:', error);
      return false;
    }
  }

  // Get post counts by status for a user
  static async getPostCounts(userId: string): Promise<Record<string, number>> {
    try {
      const { data: posts, error } = await supabase
        .from('postfast_posts')
        .select('status')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching post counts:', error);
        return { DRAFT: 0, SCHEDULED: 0, PUBLISHED: 0, FAILED: 0 };
      }

      const counts = posts.reduce((acc, post) => {
        acc[post.status] = (acc[post.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        DRAFT: counts.DRAFT || 0,
        SCHEDULED: counts.SCHEDULED || 0,
        PUBLISHED: counts.PUBLISHED || 0,
        FAILED: counts.FAILED || 0
      };
    } catch (error) {
      console.error('Error fetching post counts:', error);
      return { DRAFT: 0, SCHEDULED: 0, PUBLISHED: 0, FAILED: 0 };
    }
  }

  // Simulate status updates (since PostFast doesn't provide webhooks)
  static async simulateStatusUpdates(userId: string): Promise<void> {
    try {
      const scheduledPosts = await this.getUserPosts(userId, 'SCHEDULED');
      const now = new Date();

      for (const post of scheduledPosts) {
        if (post.scheduled_at) {
          const scheduledTime = new Date(post.scheduled_at);
          
          // If post was scheduled for the past, randomly assign published/failed status
          if (scheduledTime < now) {
            const isSuccessful = Math.random() > 0.1; // 90% success rate simulation
            const newStatus = isSuccessful ? 'PUBLISHED' : 'FAILED';
            const errorMessage = isSuccessful ? undefined : 'Failed to publish to platform';
            
            await this.updatePostStatus(post.id, newStatus, errorMessage);
          }
        }
      }
    } catch (error) {
      console.error('Error simulating status updates:', error);
    }
  }
}