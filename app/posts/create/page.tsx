"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, X, Calendar, Settings, Eye, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface MediaItem {
  id: string;
  file: File;
  preview: string;
  type: 'image' | 'video';
}

interface SocialAccount {
  id: string;
  platform: 'TIKTOK' | 'INSTAGRAM' | 'FACEBOOK';
  username: string;
  displayName: string;
  avatar?: string;
}

interface PlatformSettings {
  tiktok: {
    privacy: 'PUBLIC' | 'MUTUAL_FRIENDS' | 'ONLY_ME';
    allowComments: boolean;
    allowDuet: boolean;
    allowStitch: boolean;
    publishAsDraft: boolean;
  };
  instagram: {
    publishType: 'TIMELINE' | 'STORY' | 'REEL';
    postToGrid: boolean;
  };
  facebook: {
    contentType: 'POST' | 'REEL' | 'STORY';
  };
}

export default function CreatePostPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [content, setContent] = useState('');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'preview' | 'schedule' | 'settings'>('preview');
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({
    tiktok: {
      privacy: 'PUBLIC',
      allowComments: true,
      allowDuet: true,
      allowStitch: true,
      publishAsDraft: false
    },
    instagram: {
      publishType: 'TIMELINE',
      postToGrid: true
    },
    facebook: {
      contentType: 'POST'
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    files.forEach(file => {
      if (file.size > 250 * 1024 * 1024) { // 250MB limit
        toast.error(`${file.name} is too large. Maximum size is 250MB.`);
        return;
      }

      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (!isVideo && !isImage) {
        toast.error(`${file.name} is not a valid media file.`);
        return;
      }

      if (isImage && file.size > 10 * 1024 * 1024) { // 10MB limit for images
        toast.error(`${file.name} is too large. Maximum size for images is 10MB.`);
        return;
      }

      const mediaItem: MediaItem = {
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview: URL.createObjectURL(file),
        type: isVideo ? 'video' : 'image'
      };

      setMediaItems(prev => [...prev, mediaItem]);
    });
  };

  const removeMediaItem = (id: string) => {
    setMediaItems(prev => {
      const item = prev.find(item => item.id === id);
      if (item) {
        URL.revokeObjectURL(item.preview);
      }
      return prev.filter(item => item.id !== id);
    });
  };

  const handleAccountToggle = (accountId: string) => {
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error('Please add some content to your post');
      return;
    }

    if (selectedAccounts.length === 0) {
      toast.error('Please select at least one account');
      return;
    }

    setIsSubmitting(true);

    try {
      // TODO: Implement post creation API call
      await new Promise(resolve => setTimeout(resolve, 2000)); // Mock delay

      toast.success('Post created successfully!');
      router.push('/posts');
    } catch (error) {
      toast.error('Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    // Mock data - replace with actual API call
    const mockAccounts: SocialAccount[] = [
      {
        id: '1',
        platform: 'TIKTOK',
        username: 'outfitinspo',
        displayName: 'Outfit Inspo',
        avatar: 'https://via.placeholder.com/40'
      },
      {
        id: '2',
        platform: 'INSTAGRAM',
        username: 'style_daily',
        displayName: 'Style Daily',
        avatar: 'https://via.placeholder.com/40'
      }
    ];
    setAccounts(mockAccounts);
  }, []);

  const selectedAccountsData = accounts.filter(acc => selectedAccounts.includes(acc.id));

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f3f4f0' }}>
      <div className="p-6 xl:p-8">
        <div className="pt-8 xl:pt-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-white rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-3xl font-bold text-gray-900">Create post</h1>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/posts')}
                className="px-6 py-3 text-gray-700 hover:text-gray-900 hover:bg-white rounded-lg transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-lg transition-all font-medium"
              >
                {scheduledAt ? <Clock className="w-5 h-5" /> : null}
                {isSubmitting ? 'Creating...' : scheduledAt ? 'Schedule' : 'Post now'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Base Content */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Base content</h3>

                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">Post content</label>
                    <span className="text-sm text-gray-500">{content.length}/2200</span>
                  </div>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write your post content here..."
                    rows={6}
                    maxLength={2200}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    This is the content that will be used if no platform specific content is provided.
                  </p>
                </div>

                {/* Media Upload */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-700">Image/Video</label>
                    <span className="text-sm text-gray-500">{mediaItems.length}/10 Media Items</span>
                  </div>

                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={handleMediaUpload}
                      className="hidden"
                      id="media-upload"
                    />
                    <label htmlFor="media-upload" className="cursor-pointer">
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 font-medium mb-1">Click to upload or drag and drop</p>
                      <p className="text-sm text-gray-500">
                        Maximum file size: 10MB for images, 250MB for videos<br />
                        Supported formats: jpeg, png, gif, webp, mp4, webm, mov, quicktime
                      </p>
                    </label>
                  </div>

                  {/* Media Preview */}
                  {mediaItems.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {mediaItems.map(item => (
                        <div key={item.id} className="relative group">
                          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                            {item.type === 'video' ? (
                              <video
                                src={item.preview}
                                className="w-full h-full object-cover"
                                controls={false}
                              />
                            ) : (
                              <img
                                src={item.preview}
                                alt="Preview"
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <button
                            onClick={() => removeMediaItem(item.id)}
                            className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="absolute bottom-2 left-2 px-2 py-1 bg-black bg-opacity-70 text-white text-xs rounded">
                            {item.type}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Post Settings Tabs */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="border-b border-gray-200">
                  <nav className="flex">
                    <button
                      onClick={() => setActiveTab('preview')}
                      className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'preview'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Eye className="w-4 h-4 mx-auto mb-1" />
                      Preview
                    </button>
                    <button
                      onClick={() => setActiveTab('schedule')}
                      className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'schedule'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Calendar className="w-4 h-4 mx-auto mb-1" />
                      Schedule
                    </button>
                    <button
                      onClick={() => setActiveTab('settings')}
                      className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'settings'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Settings className="w-4 h-4 mx-auto mb-1" />
                      Platform settings
                    </button>
                  </nav>
                </div>

                <div className="p-6">
                  {activeTab === 'preview' && (
                    <div className="space-y-4">
                      <div className="bg-black rounded-lg p-4 aspect-[9/16] max-h-96 overflow-hidden">
                        <div className="text-white text-center h-full flex items-center justify-center">
                          <div>
                            <h4 className="font-medium mb-2">Post Preview</h4>
                            <p className="text-sm opacity-75">Preview will show here</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'schedule' && (
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setScheduledAt('')}
                          className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${
                            !scheduledAt
                              ? 'border-blue-500 bg-blue-50 text-blue-600'
                              : 'border-gray-200 text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          Post now
                        </button>
                        <button
                          onClick={() => setScheduledAt(new Date().toISOString().slice(0, 16))}
                          className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${
                            scheduledAt
                              ? 'border-blue-500 bg-blue-50 text-blue-600'
                              : 'border-gray-200 text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          Pick time
                        </button>
                      </div>

                      {scheduledAt && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Schedule for
                          </label>
                          <input
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={(e) => setScheduledAt(e.target.value)}
                            min={new Date().toISOString().slice(0, 16)}
                            className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      )}

                      {/* Account Selection */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Select accounts</h4>
                        <div className="space-y-2">
                          {accounts.map(account => (
                            <label key={account.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedAccounts.includes(account.id)}
                                onChange={() => handleAccountToggle(account.id)}
                                className="w-4 h-4 text-blue-600 rounded"
                              />
                              <div className="flex items-center gap-2 flex-1">
                                {account.avatar ? (
                                  <img src={account.avatar} alt="" className="w-8 h-8 rounded-full" />
                                ) : (
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    account.platform === 'TIKTOK' ? 'bg-black' :
                                    account.platform === 'INSTAGRAM' ? 'bg-gradient-to-br from-purple-500 to-pink-500' :
                                    'bg-blue-500'
                                  }`}>
                                    <span className="text-white text-xs">
                                      {account.platform === 'TIKTOK' ? 'T' :
                                       account.platform === 'INSTAGRAM' ? 'I' : 'F'}
                                    </span>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm text-gray-900 truncate">
                                    @{account.username}
                                  </p>
                                  <p className="text-xs text-gray-500">{account.platform}</p>
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'settings' && (
                    <div className="space-y-4">
                      {selectedAccountsData.some(acc => acc.platform === 'TIKTOK') && (
                        <div className="space-y-3">
                          <h4 className="font-medium text-gray-900 flex items-center gap-2">
                            <div className="w-6 h-6 bg-black rounded flex items-center justify-center">
                              <span className="text-white text-xs">T</span>
                            </div>
                            TikTok
                          </h4>

                          <label className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">Publish as draft</span>
                            <input
                              type="checkbox"
                              checked={platformSettings.tiktok.publishAsDraft}
                              onChange={(e) => setPlatformSettings(prev => ({
                                ...prev,
                                tiktok: { ...prev.tiktok, publishAsDraft: e.target.checked }
                              }))}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                          </label>

                          <div>
                            <label className="block text-sm text-gray-700 mb-1">Privacy settings</label>
                            <select
                              value={platformSettings.tiktok.privacy}
                              onChange={(e) => setPlatformSettings(prev => ({
                                ...prev,
                                tiktok: { ...prev.tiktok, privacy: e.target.value as any }
                              }))}
                              className="w-full p-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="PUBLIC">Public</option>
                              <option value="MUTUAL_FRIENDS">Mutual friends</option>
                              <option value="ONLY_ME">Only me</option>
                            </select>
                          </div>

                          <label className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">Allow Comments</span>
                            <input
                              type="checkbox"
                              checked={platformSettings.tiktok.allowComments}
                              onChange={(e) => setPlatformSettings(prev => ({
                                ...prev,
                                tiktok: { ...prev.tiktok, allowComments: e.target.checked }
                              }))}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                          </label>

                          <label className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">Allow Duet</span>
                            <input
                              type="checkbox"
                              checked={platformSettings.tiktok.allowDuet}
                              onChange={(e) => setPlatformSettings(prev => ({
                                ...prev,
                                tiktok: { ...prev.tiktok, allowDuet: e.target.checked }
                              }))}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                          </label>

                          <label className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">Allow Stitch</span>
                            <input
                              type="checkbox"
                              checked={platformSettings.tiktok.allowStitch}
                              onChange={(e) => setPlatformSettings(prev => ({
                                ...prev,
                                tiktok: { ...prev.tiktok, allowStitch: e.target.checked }
                              }))}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}