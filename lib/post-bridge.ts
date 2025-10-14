/**
 * Post-bridge API client
 * Documentation: https://api.post-bridge.com/docs
 */

const POST_BRIDGE_BASE_URL = 'https://api.post-bridge.com/v1';

export interface PostBridgeMedia {
  id: string;
  mime_type: string | null;
  object: {
    isDeleted: boolean;
    url: string | null;
    size_bytes: number | null;
    name: string | null;
  };
}

export interface PostBridgeSocialAccount {
  id: number;
  platform: string;
  username: string;
}

export interface PostBridgePost {
  id: string;
  caption: string;
  status: 'posted' | 'scheduled' | 'processing';
  scheduled_at: string | null;
  platform_configurations: any;
  social_accounts: number[];
  account_configurations: any;
  media: any;
  created_at: string;
  updated_at: string;
  is_draft: boolean;
}

export interface PostBridgePostResult {
  id: string;
  post_id: string;
  success: boolean;
  social_account_id: number;
  error: any;
  platform_data: {
    id?: string;
    url?: string;
    username?: string;
  };
}

export interface CreateUploadUrlResponse {
  media_id: string;
  upload_url: string;
  name: string;
}

export interface CreatePostRequest {
  caption: string;
  scheduled_at?: string | null;
  platform_configurations?: {
    tiktok?: {
      caption?: string;
      media?: string[];
      title?: string;
      video_cover_timestamp_ms?: number;
      draft?: boolean;
      is_aigc?: boolean;
    };
    instagram?: {
      caption?: string;
      media?: string[];
      video_cover_timestamp_ms?: number;
      placement?: string;
    };
    facebook?: {
      caption?: string;
      media?: string[];
      placement?: string;
    };
    twitter?: {
      caption?: string;
      media?: string[];
    };
    [key: string]: any;
  };
  account_configurations?: any[];
  media?: string[];
  media_urls?: string[];
  social_accounts: number[];
  is_draft?: boolean;
  processing_enabled?: boolean;
}

export class PostBridgeAPI {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${POST_BRIDGE_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Post-bridge API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  // Social Accounts
  async getSocialAccounts(params?: {
    offset?: number;
    limit?: number;
    platform?: string[];
    username?: string[];
  }): Promise<{ data: PostBridgeSocialAccount[]; meta: any }> {
    const searchParams = new URLSearchParams();
    
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.platform) {
      params.platform.forEach(p => searchParams.append('platform', p));
    }
    if (params?.username) {
      params.username.forEach(u => searchParams.append('username', u));
    }

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/social-accounts?${queryString}` : '/social-accounts';
    
    return this.request<{ data: PostBridgeSocialAccount[]; meta: any }>(endpoint);
  }

  async getSocialAccountById(id: number): Promise<PostBridgeSocialAccount> {
    return this.request<PostBridgeSocialAccount>(`/social-accounts/${id}`);
  }

  // Media Upload
  async createUploadUrl(params: {
    mime_type: 'image/png' | 'image/jpeg' | 'video/mp4' | 'video/quicktime';
    size_bytes: number;
    name: string;
  }): Promise<CreateUploadUrlResponse> {
    return this.request<CreateUploadUrlResponse>('/media/create-upload-url', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async uploadMedia(file: File): Promise<string> {
    // Step 1: Create upload URL
    const uploadResponse = await this.createUploadUrl({
      mime_type: file.type as any,
      size_bytes: file.size,
      name: file.name,
    });

    // Step 2: Upload file to signed URL
    const uploadResult = await fetch(uploadResponse.upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!uploadResult.ok) {
      throw new Error(`Failed to upload media: ${uploadResult.status}`);
    }

    return uploadResponse.media_id;
  }

  async getMedia(params?: {
    offset?: number;
    limit?: number;
    post_id?: string[];
    type?: ('image' | 'video')[];
  }): Promise<{ data: PostBridgeMedia[]; meta: any }> {
    const searchParams = new URLSearchParams();
    
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.post_id) {
      params.post_id.forEach(id => searchParams.append('post_id', id));
    }
    if (params?.type) {
      params.type.forEach(t => searchParams.append('type', t));
    }

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/media?${queryString}` : '/media';
    
    return this.request<{ data: PostBridgeMedia[]; meta: any }>(endpoint);
  }

  async getMediaById(id: string): Promise<PostBridgeMedia> {
    return this.request<PostBridgeMedia>(`/media/${id}`);
  }

  async deleteMedia(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/media/${id}`, {
      method: 'DELETE',
    });
  }

  // Posts
  async createPost(data: CreatePostRequest): Promise<PostBridgePost> {
    return this.request<PostBridgePost>('/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPosts(params?: {
    offset?: number;
    limit?: number;
    platform?: string[];
    status?: ('posted' | 'scheduled' | 'processing')[];
  }): Promise<{ data: PostBridgePost[]; meta: any }> {
    const searchParams = new URLSearchParams();
    
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.platform) {
      params.platform.forEach(p => searchParams.append('platform', p));
    }
    if (params?.status) {
      params.status.forEach(s => searchParams.append('status', s));
    }

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/posts?${queryString}` : '/posts';
    
    return this.request<{ data: PostBridgePost[]; meta: any }>(endpoint);
  }

  async getPostById(id: string): Promise<PostBridgePost> {
    return this.request<PostBridgePost>(`/posts/${id}`);
  }

  async updatePost(id: string, data: Partial<CreatePostRequest>): Promise<PostBridgePost> {
    return this.request<PostBridgePost>(`/posts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deletePost(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/posts/${id}`, {
      method: 'DELETE',
    });
  }

  // Post Results
  async getPostResults(params?: {
    offset?: number;
    limit?: number;
    post_id?: string[];
    platform?: string[];
  }): Promise<{ data: PostBridgePostResult[]; meta: any }> {
    const searchParams = new URLSearchParams();
    
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.post_id) {
      params.post_id.forEach(id => searchParams.append('post_id', id));
    }
    if (params?.platform) {
      params.platform.forEach(p => searchParams.append('platform', p));
    }

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/post-results?${queryString}` : '/post-results';
    
    return this.request<{ data: PostBridgePostResult[]; meta: any }>(endpoint);
  }

  async getPostResultById(id: string): Promise<PostBridgePostResult> {
    return this.request<PostBridgePostResult>(`/post-results/${id}`);
  }
}