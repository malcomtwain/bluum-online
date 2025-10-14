"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Plus, Search, Filter, MoreHorizontal, Play, Image, Calendar, Eye, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { PostFastPostsManager, PostFastPost } from '@/lib/postfast-posts';

interface Post {
  id: string;
  content: string;
  mediaUrls: string[];
  scheduledAt?: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED';
  platform: 'TIKTOK' | 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE' | 'X' | 'LINKEDIN';
  createdAt: string;
  socialAccountName?: string;
  postfastPostId?: string;
  errorMessage?: string;
}

export default function PostsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('SCHEDULED');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [postCounts, setPostCounts] = useState<Record<string, number>>({
    DRAFT: 0,
    SCHEDULED: 0,
    PUBLISHED: 0,
    FAILED: 0
  });

  const statusColors = {
    DRAFT: 'bg-gray-100 text-gray-700',
    SCHEDULED: 'bg-blue-100 text-blue-700',
    PUBLISHED: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700'
  };

  const platformIcons = {
    TIKTOK: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
      </svg>
    ),
    INSTAGRAM: (
      <svg className="w-4 h-4 text-pink-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z"/>
      </svg>
    ),
    FACEBOOK: (
      <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    YOUTUBE: (
      <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
    X: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    LINKEDIN: (
      <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    )
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = post.status === statusFilter;
    const matchesPlatform = platformFilter === 'all' || post.platform === platformFilter;
    return matchesSearch && matchesStatus && matchesPlatform;
  });

  const handleSelectPost = (postId: string) => {
    setSelectedPosts(prev =>
      prev.includes(postId)
        ? prev.filter(id => id !== postId)
        : [...prev, postId]
    );
  };

  const handleSelectAll = () => {
    if (selectedPosts.length === filteredPosts.length) {
      setSelectedPosts([]);
    } else {
      setSelectedPosts(filteredPosts.map(post => post.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPosts.length === 0) return;

    try {
      const deletePromises = selectedPosts.map(postId => {
        const post = posts.find(p => p.id === postId);
        return PostFastPostsManager.deletePost(postId, post?.postfastPostId);
      });

      await Promise.all(deletePromises);
      
      setPosts(prev => prev.filter(post => !selectedPosts.includes(post.id)));
      setSelectedPosts([]);
      toast.success(`${selectedPosts.length} posts deleted successfully`);
      
      // Reload counts
      loadPostCounts();
    } catch (error) {
      toast.error('Failed to delete posts');
    }
  };

  const handleDeletePost = async (postId: string, postfastPostId?: string) => {
    try {
      await PostFastPostsManager.deletePost(postId, postfastPostId);
      setPosts(prev => prev.filter(post => post.id !== postId));
      toast.success('Post deleted successfully');
      loadPostCounts();
    } catch (error) {
      toast.error('Failed to delete post');
    }
  };

  const handleRefresh = async () => {
    if (!user) return;
    
    setIsRefreshing(true);
    try {
      // Simulate status updates first
      await PostFastPostsManager.simulateStatusUpdates(user.id);
      
      // Then reload posts
      await loadPosts(true);
      await loadPostCounts();
      
      toast.success('Posts refreshed');
    } catch (error) {
      console.error('Error refreshing:', error);
      toast.error('Failed to refresh posts');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadPosts(true); // Show loader only on initial load
      loadPostCounts();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadPosts(); // No loader for filter changes
    }
  }, [statusFilter, platformFilter]);

  const loadPosts = async (showLoader = false) => {
    if (!user) return;

    try {
      if (showLoader) {
        setIsLoading(true);
      }
      
      const postfastPosts = await PostFastPostsManager.getUserPosts(
        user.id,
        statusFilter !== 'all' ? statusFilter : undefined,
        platformFilter !== 'all' ? platformFilter : undefined
      );

      // Convert to our interface format
      const convertedPosts: Post[] = postfastPosts.map((post: PostFastPost) => ({
        id: post.id,
        content: post.content,
        mediaUrls: post.media_urls || [],
        scheduledAt: post.scheduled_at,
        platform: post.platform,
        status: post.status,
        createdAt: post.created_at,
        socialAccountName: post.social_account_name,
        postfastPostId: post.postfast_post_id,
        errorMessage: post.error_message
      }));

      setPosts(convertedPosts);
    } catch (error) {
      console.error('Error loading posts:', error);
      setPosts([]);
    } finally {
      if (showLoader) {
        setIsLoading(false);
      }
    }
  };

  const loadPostCounts = async () => {
    if (!user) return;

    try {
      const counts = await PostFastPostsManager.getPostCounts(user.id);
      setPostCounts(counts);
    } catch (error) {
      console.error('Error loading post counts:', error);
    }
  };


  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg">
              <Plus className="w-4 h-4" />
              <button onClick={() => router.push('/schedule')}>New Post</button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">Filters</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">Compact view</span>
            </div>
            <span className="text-sm text-gray-600">{filteredPosts.length} total</span>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex px-6">
            {[
              { key: 'SCHEDULED', label: 'Scheduled', count: postCounts.SCHEDULED },
              { key: 'PUBLISHED', label: 'Published', count: postCounts.PUBLISHED },
              { key: 'DRAFT', label: 'Drafts', count: postCounts.DRAFT },
              { key: 'FAILED', label: 'Failed', count: postCounts.FAILED }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  statusFilter === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                    statusFilter === tab.key
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Posts Content */}
        <div className="flex-1 overflow-auto">

          {filteredPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96">
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">No posts found</h3>
                <p className="text-gray-500 mb-6">
                  {statusFilter !== 'all'
                    ? `No ${statusFilter.toLowerCase()} posts found`
                    : 'No scheduled posts found'}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredPosts.map(post => (
                <div key={post.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    {/* Media Preview */}
                    <div className="w-12 h-12 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                      {post.mediaUrls.length > 0 ? (
                        <div className="relative w-full h-full">
                          {post.mediaUrls[0].includes('video') || post.mediaUrls[0].includes('.mp4') ? (
                            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                              <Play className="w-4 h-4 text-white" />
                            </div>
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                              <Image className="w-4 h-4 text-gray-600" />
                            </div>
                          )}
                          {post.mediaUrls.length > 1 && (
                            <div className="absolute top-0.5 right-0.5 bg-black bg-opacity-70 text-white text-xs px-1 rounded">
                              +{post.mediaUrls.length - 1}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                          <Image className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Post Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2 pr-2">
                          {post.content}
                        </p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleDeletePost(post.id, post.postfastPostId)}
                            className="p-1 hover:bg-red-100 hover:text-red-600 rounded transition-colors"
                            title="Delete post"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button className="p-1 hover:bg-gray-100 rounded">
                            <MoreHorizontal className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                        <div className="flex items-center gap-1">
                          {platformIcons[post.platform]}
                          <span>{post.platform.toLowerCase()}</span>
                        </div>

                        {post.socialAccountName && (
                          <span>• {post.socialAccountName}</span>
                        )}

                        {post.scheduledAt && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {new Date(post.scheduledAt).toLocaleDateString()} at{' '}
                              {new Date(post.scheduledAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[post.status]}`}>
                            {post.status.toLowerCase()}
                          </span>
                          {post.status === 'FAILED' && post.errorMessage && (
                            <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded" title={post.errorMessage}>
                              Error
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(post.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}