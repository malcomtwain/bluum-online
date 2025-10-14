const POSTFAST_API_BASE_URL = 'https://api.postfa.st';

interface PostFastMediaItem {
  key: string;
  type: 'IMAGE' | 'VIDEO';
  sortOrder: number;
  coverTimestamp?: string;
}

interface PostFastPost {
  content: string;
  mediaItems?: PostFastMediaItem[];
  scheduledAt?: string;
  socialMediaId: string;
  status?: 'DRAFT' | 'SCHEDULED';
  approvalStatus?: 'APPROVED' | 'PENDING_APPROVAL';
}

interface TikTokControls {
  tiktokPrivacy?: 'PUBLIC' | 'MUTUAL_FRIENDS' | 'ONLY_ME';
  tiktokIsDraft?: boolean;
  tiktokAllowComments?: boolean;
  tiktokAllowDuet?: boolean;
  tiktokAllowStitch?: boolean;
  tiktokBrandOrganic?: boolean;
  tiktokBrandContent?: boolean;
  tiktokAutoAddMusic?: boolean;
}

interface SocialMediaAccount {
  id: string;
  platform: 'X' | 'FACEBOOK' | 'INSTAGRAM' | 'THREADS' | 'LINKEDIN' | 'TIKTOK' | 'YOUTUBE' | 'BLUESKY';
  platformUsername?: string;
  displayName?: string;
  profileImageUrl?: string;
}

export class PostFastAPI {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 secondes timeout

    try {
      const response = await fetch(`${POSTFAST_API_BASE_URL}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'pf-api-key': this.apiKey,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`PostFast API error: ${response.status} - ${error}`);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('PostFast API request timeout');
      }
      throw error;
    }
  }

  async getSignedUploadUrls(contentType: string, count: number = 1) {
    return this.request('/file/get-signed-upload-urls', {
      method: 'POST',
      body: JSON.stringify({ contentType, count }),
    });
  }

  async uploadToS3(signedUrl: string, file: File | Blob, contentType: string) {
    const response = await fetch(signedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': contentType,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to upload to S3: ${response.status}`);
    }

    return true;
  }

  async getSocialAccounts(): Promise<SocialMediaAccount[]> {
    return this.request('/social-media/my-social-accounts', {
      method: 'GET',
    });
  }

  async createPosts(posts: PostFastPost[], controls?: TikTokControls) {
    const body: any = { posts };
    if (controls) {
      body.controls = controls;
    }

    return this.request('/social-posts', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async deletePost(postId: string) {
    return this.request(`/social-posts/${postId}`, {
      method: 'DELETE',
    });
  }

  async createTikTokDraft(
    videoKey: string,
    caption: string,
    socialMediaId: string,
    coverTimestamp?: string
  ) {
    const posts: PostFastPost[] = [{
      content: caption,
      mediaItems: [{
        key: videoKey,
        type: 'VIDEO',
        sortOrder: 0,
        coverTimestamp,
      }],
      socialMediaId,
      status: 'DRAFT',
    }];

    const controls: TikTokControls = {
      tiktokIsDraft: true,
      tiktokPrivacy: 'PUBLIC',
      tiktokAllowComments: true,
      tiktokAllowDuet: true,
      tiktokAllowStitch: true,
    };

    return this.createPosts(posts, controls);
  }
}

export type { SocialMediaAccount, PostFastPost, TikTokControls };