"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, Clock, Send, Save, Eye, Trash2, Edit, Plus, X, CheckCircle, Upload, Instagram, Music, Folder, Sparkles, Star } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { PostBridgeScheduler, ScheduledPost } from '@/lib/post-bridge-scheduler';
import { PostBridgeAPI } from '@/lib/post-bridge';
import { createClient } from '@supabase/supabase-js';
import { getUserCollections, getCollectionWithMedia } from '@/lib/media-collections';
import { getUserSongs, type UserSong } from '@/lib/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface SocialAccount {
  id: number;
  platform: string;
  username: string;
  displayName?: string;
  profileImageUrl?: string;
}

export default function SchedulePage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scheduler, setScheduler] = useState<PostBridgeScheduler | null>(null);
  const [userApiKey, setUserApiKey] = useState<string | null>(null);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [selectedAccountForCollection, setSelectedAccountForCollection] = useState<number | null>(null);
  const [availableCollections, setAvailableCollections] = useState<any[]>([]);
  const [accountCollections, setAccountCollections] = useState<Record<number, string>>({});
  const [selectedMediaFromCollection, setSelectedMediaFromCollection] = useState<any | null>(null);
  const [showMediaSelectionModal, setShowMediaSelectionModal] = useState(false);
  const [collectionMedia, setCollectionMedia] = useState<any[]>([]);
  const [userSongs, setUserSongs] = useState<UserSong[]>([]);
  const [selectedMusic, setSelectedMusic] = useState<UserSong | null>(null);
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [customUsernames, setCustomUsernames] = useState<Record<number, string>>({});
  const [profiles, setProfiles] = useState<Record<number, any>>({});
  
  // Account selection state
  const [favoriteAccounts, setFavoriteAccounts] = useState<Set<number>>(new Set());
  
  // Smart bulk scheduling state
  const [showBulkScheduleModal, setShowBulkScheduleModal] = useState(false);
  const [bulkConfig, setBulkConfig] = useState({
    collectionId: '',
    selectedAccounts: [] as number[],
    postsPerDay: 3,
    durationDays: 30,
    startDate: format(new Date(), 'yyyy-MM-dd'),
    content: '',
    isDraft: false,
    tiktokSettings: {
      privacy: 'PUBLIC',
      allowComments: true,
      allowDuet: true,
      allowStitch: true
    }
  });
  const [isBulkScheduling, setIsBulkScheduling] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    content: '',
    platform: 'TIKTOK',
    social_account_id: '',
    scheduled_for: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    media_files: [] as File[],
    // TikTok controls
    tiktok_privacy: 'PUBLIC',
    allow_comments: true,
    allow_duet: true,
    allow_stitch: true,
    is_draft: false,
  });

  const [mediaPreview, setMediaPreview] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      loadUserApiKey();
      loadCollections();
      loadUserSongs();
    }
  }, [user]);

  useEffect(() => {
    if (userApiKey) {
      const postScheduler = new PostBridgeScheduler(userApiKey);
      setScheduler(postScheduler);
      loadSocialAccounts();
    }
  }, [userApiKey]);

  useEffect(() => {
    if (user && accounts.length > 0) {
      loadCustomUsernames();
    }
  }, [user, accounts]);


  const loadUserApiKey = async () => {
    if (!user) return;

    try {
      // For now, use the Post-bridge API key directly
      setUserApiKey('pb_live_6wCwS8ojvWbVt92qtthRPW');
    } catch (error) {
      console.error('Error loading API key:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSocialAccounts = async () => {
    if (!userApiKey) return;
    
    try {
      console.log('Loading social accounts with API key:', userApiKey.substring(0, 10) + '...');
      
      // Use Post-bridge API route
      const response = await fetch('/api/post-bridge/social-accounts', {
        headers: {
          'Authorization': `Bearer ${userApiKey}`
        }
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API response error:', errorText);
        throw new Error('Failed to fetch social accounts');
      }
      
      const data = await response.json();
      console.log('Received data:', data);
      
      const socialAccounts = data.accounts || [];
      console.log('Setting accounts:', socialAccounts);
      setAccounts(socialAccounts);
      
      if (socialAccounts.length > 0) {
        toast.success(`Loaded ${socialAccounts.length} social accounts`);
      } else {
        toast.warning('No social accounts found');
      }
    } catch (error) {
      console.error('Error loading social accounts:', error);
      toast.error('Failed to load social accounts');
    }
  };

  const loadCustomUsernames = async () => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/social-usernames', {
        headers: {
          'x-invitation-code': user.id
        }
      });
      const data = await response.json();
      if (response.ok) {
        setCustomUsernames(data.usernames || {});
        
        // Load TikTok profiles for accounts with usernames
        accounts.forEach(account => {
          if (account.platform === 'TIKTOK') {
            const username = data.usernames?.[account.id] || account.platformUsername;
            if (username && username !== 'username not set') {
              loadTikTokProfile(account.id, username);
            }
          }
        });
      }
    } catch (error) {
      console.error('Error loading custom usernames:', error);
    }
  };

  const loadTikTokProfile = async (accountId: string, username: string) => {
    if (!username || username === 'username not set') return;
    
    try {
      const response = await fetch(`/api/tiktok-profile?username=${username}`);
      if (response.ok) {
        const profileData = await response.json();
        setProfiles(prev => ({ ...prev, [accountId]: profileData }));
      }
    } catch (error) {
      console.error(`Error loading profile for ${username}:`, error);
    }
  };


  const loadUserSongs = async () => {
    if (!user) return;
    
    try {
      const songs = await getUserSongs(user.id);
      setUserSongs(songs);
    } catch (error) {
      console.error('Error loading user songs:', error);
    }
  };

  const loadCollections = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('generated_media_collections')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Load media for each collection to create thumbnails
      const collectionsWithMedia = await Promise.all(
        (data || []).map(async (collection) => {
          // Get first 3 videos from this collection
          const { data: videos } = await supabase
            .from('generated_videos')
            .select('file_url')
            .eq('collection_id', collection.id)
            .order('created_at', { ascending: false })
            .limit(3);
          
          // Get first 3 slideshows from this collection
          const { data: slideshows } = await supabase
            .from('generated_slideshows')
            .select('file_url')
            .eq('collection_id', collection.id)
            .order('created_at', { ascending: false })
            .limit(3);
          
          // Combine and take first 3 media items
          const allMedia = [...(videos || []), ...(slideshows || [])].slice(0, 3);
          
          return {
            ...collection,
            media_preview: allMedia
          };
        })
      );
      
      setAvailableCollections(collectionsWithMedia);
      
      // Load saved account-collection associations
      const { data: associations } = await supabase
        .from('social_account_collections')
        .select('*')
        .eq('user_id', user.id);
      
      if (associations) {
        const associationsMap: Record<string, string> = {};
        associations.forEach(assoc => {
          associationsMap[assoc.account_id] = assoc.collection_id;
        });
        setAccountCollections(associationsMap);
      }
    } catch (error) {
      console.error('Error loading collections:', error);
    }
  };

  const handleAssignCollection = (accountId: string) => {
    setSelectedAccountForCollection(accountId);
    setShowCollectionModal(true);
  };

  const assignCollectionToAccount = async (collectionId: string | null) => {
    if (!user || !selectedAccountForCollection) return;
    
    try {
      if (collectionId) {
        // Save the association
        await supabase
          .from('social_account_collections')
          .upsert({
            user_id: user.id,
            account_id: selectedAccountForCollection,
            collection_id: collectionId,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,account_id'
          });
        
        setAccountCollections(prev => ({
          ...prev,
          [selectedAccountForCollection]: collectionId
        }));
        
        toast.success('Collection assigned successfully');
      } else {
        // Remove the association
        await supabase
          .from('social_account_collections')
          .delete()
          .eq('user_id', user.id)
          .eq('account_id', selectedAccountForCollection);
        
        setAccountCollections(prev => {
          const newAssoc = { ...prev };
          delete newAssoc[selectedAccountForCollection];
          return newAssoc;
        });
        
        toast.success('Collection removed');
      }
      
      setShowCollectionModal(false);
      setSelectedAccountForCollection(null);
    } catch (error) {
      console.error('Error assigning collection:', error);
      toast.error('Failed to assign collection');
    }
  };
  

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setFormData(prev => ({ ...prev, media_files: files }));
    
    // Create preview URLs
    const previews = files.map(file => URL.createObjectURL(file));
    setMediaPreview(previews);
  };

  const handleSubmit = async () => {
    if (!user || !scheduler) return;
    
    const selectedAccount = accounts.find(acc => acc.id === formData.social_account_id);
    if (!selectedAccount) {
      toast.error('Please select a social account');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Create controls based on platform
      const controls: any = {};
      if (formData.platform === 'TIKTOK') {
        controls.tiktokPrivacy = formData.tiktok_privacy;
        controls.tiktokAllowComments = formData.allow_comments;
        controls.tiktokAllowDuet = formData.allow_duet;
        controls.tiktokAllowStitch = formData.allow_stitch;
        controls.tiktokIsDraft = formData.is_draft;
        
        // Add music for slideshows
        if (selectedMediaFromCollection?.type === 'slideshow' && selectedMusic) {
          // For TikTok carousel posts, we need to upload the music file too
          console.log('Adding music to slideshow:', selectedMusic.title);
          // We'll handle the music upload separately
        }
      }
      
      // Prepare media files
      let mediaFilesToUpload: File[] = [];
      
      if (selectedMediaFromCollection) {
        // If media is selected from collection, we need to download it first
        try {
          // Check if it's a slideshow (multiple images)
          if (selectedMediaFromCollection.type === 'slideshow') {
            // For slideshows, we need to get all the images
            const slideshowId = selectedMediaFromCollection.file_url.split('/').pop();
            const imageCount = selectedMediaFromCollection.metadata?.imageCount || 5;
            
            console.log(`Preparing slideshow ${slideshowId} with ${imageCount} images`);
            const files: File[] = [];
            
            for (let i = 1; i <= imageCount; i++) {
              const imageUrl = `${window.location.origin}/generated-slideshows/${slideshowId}/part_${i}.png`;
              console.log(`Downloading slideshow image ${i}:`, imageUrl);
              
              const response = await fetch(imageUrl);
              if (!response.ok) {
                console.warn(`Failed to download image ${i}: ${response.status}`);
                continue;
              }
              
              const blob = await response.blob();
              const file = new File([blob], `slide_${i}.png`, { type: 'image/png' });
              files.push(file);
            }
            
            if (files.length === 0) {
              throw new Error('No slideshow images could be downloaded');
            }
            
            console.log(`Downloaded ${files.length} slideshow images`);
            mediaFilesToUpload = files;
            
            // Note about music: TikTok API doesn't support adding custom music to carousels
            // The music needs to be added manually in the TikTok app after receiving the draft
            if (selectedMusic) {
              console.log('Music selected for slideshow:', selectedMusic.title);
              console.log('Note: Music needs to be added manually in TikTok app after receiving the draft');
              // Store music info in metadata for reference
              if (!controls.metadata) controls.metadata = {};
              controls.metadata.selectedMusic = {
                title: selectedMusic.title,
                artist: selectedMusic.artist,
                note: 'Add this music manually in TikTok app'
              };
            }
            
          } else {
            // For single video or image
            let mediaUrl = selectedMediaFromCollection.file_url;
            if (mediaUrl.startsWith('/')) {
              mediaUrl = `${window.location.origin}${mediaUrl}`;
            }
            
            console.log('Downloading media from:', mediaUrl);
            const response = await fetch(mediaUrl);
            
            if (!response.ok) {
              throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
            }
            
            const blob = await response.blob();
            console.log('Downloaded blob size:', blob.size, 'type:', blob.type);
            
            let extension = 'mp4';
            let mimeType = 'video/mp4';
            
            if (selectedMediaFromCollection.type === 'video') {
              mimeType = 'video/mp4';
              extension = 'mp4';
            } else if (selectedMediaFromCollection.type === 'image') {
              mimeType = blob.type || 'image/png';
              extension = 'png';
            }
            
            const file = new File([blob], `media.${extension}`, { 
              type: mimeType
            });
            
            console.log('Created file:', file.name, 'size:', file.size, 'type:', file.type);
            mediaFilesToUpload = [file];
          }
        } catch (error) {
          console.error('Failed to download media from collection:', error);
          toast.error('Failed to prepare media from collection');
          setIsSubmitting(false);
          return;
        }
      } else {
        // Use uploaded files
        mediaFilesToUpload = formData.media_files;
      }
      
      // Create draft post
      const draftPost = await scheduler.createDraftPost(
        user.id,
        formData.content,
        new Date(formData.scheduled_for),
        formData.platform,
        formData.social_account_id,
        selectedAccount.displayName || selectedAccount.username || 'Unknown',
        mediaFilesToUpload,
        controls
      );
      
      // Schedule with Post-bridge (drafts are handled by tiktokIsDraft control)
      await scheduler.schedulePost(draftPost.id);
      
      if (formData.is_draft) {
        toast.success('Draft scheduled! Will be sent to TikTok System Notifications at scheduled time.');
      } else {
        toast.success('Post scheduled successfully!');
      }
      
      // Auto-remove media from collection after successful posting
      if (selectedMediaFromCollection && user) {
        try {
          // Delete the media from the generated_videos or generated_slideshows table
          const { error } = await supabase
            .from(selectedMediaFromCollection.type === 'slideshow' ? 'generated_slideshows' : 'generated_videos')
            .delete()
            .eq('id', selectedMediaFromCollection.id);
          
          if (error) {
            console.error('Error removing media from collection:', error);
          } else {
            console.log(`Media ${selectedMediaFromCollection.id} removed from collection after posting`);
            toast.success('Media removed from collection');
          }
        } catch (error) {
          console.error('Error removing media from collection:', error);
        }
      }
      
      // Reset form
      setFormData({
        content: '',
        platform: 'TIKTOK',
        social_account_id: '',
        scheduled_for: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        media_files: [],
        tiktok_privacy: 'PUBLIC',
        allow_comments: true,
        allow_duet: true,
        allow_stitch: true,
        is_draft: false,
      });
      setMediaPreview([]);
      setSelectedMediaFromCollection(null);
      setSelectedMusic(null);
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast.error(error.message || 'Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFavoriteAccount = (accountId: number) => {
    setFavoriteAccounts(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(accountId)) {
        newFavorites.delete(accountId);
      } else {
        newFavorites.add(accountId);
      }
      return newFavorites;
    });
  };

  const handleBulkSchedule = async () => {
    if (!bulkConfig.collectionId || bulkConfig.selectedAccounts.length === 0) {
      toast.error('Please select a collection and at least one account');
      return;
    }

    setIsBulkScheduling(true);
    
    try {
      const response = await fetch('/api/bulk-schedule-bridge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionId: bulkConfig.collectionId,
          selectedAccounts: bulkConfig.selectedAccounts,
          postsPerDay: bulkConfig.postsPerDay,
          durationDays: bulkConfig.durationDays,
          startDate: bulkConfig.startDate,
          isDraft: bulkConfig.isDraft,
          content: bulkConfig.content,
          tiktokSettings: bulkConfig.tiktokSettings
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to schedule posts');
      }

      const result = await response.json();
      
      const totalPosts = bulkConfig.selectedAccounts.length * bulkConfig.postsPerDay * bulkConfig.durationDays;
      
      toast.success(
        `🎉 Bulk scheduling completed!\n${result.scheduled}/${totalPosts} posts scheduled successfully` +
        (result.errors > 0 ? `\n${result.errors} posts failed` : '')
      );
      
      setShowBulkScheduleModal(false);
      
      // Reset bulk config
      setBulkConfig({
        collectionId: '',
        selectedAccounts: [],
        postsPerDay: 3,
        durationDays: 30,
        startDate: format(new Date(), 'yyyy-MM-dd'),
        content: '',
        isDraft: false,
        tiktokSettings: {
          privacy: 'PUBLIC',
          allowComments: true,
          allowDuet: true,
          allowStitch: true
        }
      });
      
    } catch (error: any) {
      console.error('Bulk scheduling error:', error);
      toast.error(error.message || 'Failed to schedule posts');
    } finally {
      setIsBulkScheduling(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    const platformLower = platform.toLowerCase();
    switch (platformLower) {
      case 'tiktok':
        return (
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
          </svg>
        );
      case 'instagram':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z"/>
          </svg>
        );
      case 'facebook':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        );
      case 'twitter':
      case 'x':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        );
      case 'youtube':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        );
      case 'linkedin':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        );
      default:
        return (
          <span className="text-xs font-bold">
            {platform.slice(0, 2).toUpperCase()}
          </span>
        );
    }
  };

  // Show loading state while checking API key
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f3f4f0' }}>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  // Continue to the normal page even without API key - will show empty accounts

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f3f4f0' }}>
      <div className="p-6 xl:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Schedule Post</h1>
                <p className="text-gray-600 mt-2">
                  Create and schedule your posts to TikTok, Instagram, and more
                </p>
              </div>
              <button
                onClick={() => setShowBulkScheduleModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all"
              >
                <Sparkles className="w-5 h-5" />
                Smart Bulk Schedule
              </button>
            </div>
          </div>

          {/* Main Content - Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Base content</h2>

                {/* Account Bubbles */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Select Account ({accounts.length} available)
                  </label>
                  
                  {accounts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p className="mb-2">No accounts connected</p>
                      <p className="text-sm">Connect accounts in the Accounts page</p>
                    </div>
                  ) : (
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {accounts.map(account => {
                        const profile = profiles[account.id];
                        const username = customUsernames[account.id] || account.username || '';
                        const isSelected = formData.social_account_id === account.id.toString();
                        const isFavorite = favoriteAccounts.has(account.id);
                        
                        return (
                          <button
                            key={account.id}
                            onClick={() => {
                              setFormData(prev => ({ 
                                ...prev, 
                                social_account_id: account.id.toString(),
                                platform: account.platform.toUpperCase()
                              }));
                            }}
                            className={`group relative flex-shrink-0 flex flex-col items-center p-4 w-32 rounded-lg border-2 transition-all hover:shadow-md ${
                              isSelected 
                                ? 'border-blue-500 bg-blue-50' 
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="relative mb-2">
                              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                                {profile?.avatar ? (
                                  <img
                                    src={profile.avatar}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className={`w-full h-full bg-gradient-to-br ${
                                    account.platform.toLowerCase() === 'tiktok' 
                                      ? 'from-black via-gray-800 to-gray-700' 
                                      : account.platform.toLowerCase() === 'instagram'
                                      ? 'from-purple-500 via-pink-500 to-red-500'
                                      : 'from-blue-500 via-blue-600 to-blue-700'
                                  } rounded-full flex items-center justify-center`}>
                                    <span className="text-white font-bold text-sm">
                                      {(username || 'U').charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                )}
                              </div>
                              
                              {/* Platform icon overlay */}
                              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center border-2 border-gray-200 shadow-sm">
                                <div className="text-black">
                                  {getPlatformIcon(account.platform)}
                                </div>
                              </div>
                              
                              {/* Verified badge */}
                              {profile?.verified && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white">
                                  <CheckCircle className="w-3 h-3 text-white fill-current" />
                                </div>
                              )}
                              
                              {/* Favorite star - clickable */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavoriteAccount(account.id);
                                }}
                                className="absolute -top-1 -left-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center border-2 border-white hover:bg-yellow-600 transition-colors"
                                style={{ display: isFavorite ? 'flex' : 'none' }}
                              >
                                <Star className="w-3 h-3 text-white fill-current" />
                              </button>
                            </div>
                            
                            <p className="text-xs font-medium text-gray-900 text-center mb-1 whitespace-nowrap">
                              @{username}
                            </p>
                            {!isFavorite && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavoriteAccount(account.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-1 right-1"
                              >
                                <Star className="w-3 h-3 text-gray-400 hover:text-yellow-500" />
                              </button>
                            )}
                            <p className="text-xs text-gray-500 capitalize">
                              {account.platform.toLowerCase()}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Post content
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="This is the content that will be used if no platform specific content is provided."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                {/* Media Upload */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Image/Video
                  </label>
                  <div className="space-y-3">
                    {/* Buttons for choosing media source */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          document.getElementById('media-upload')?.click();
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        <Upload className="w-4 h-4" />
                        Upload from Device
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMediaSelectionModal(true)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        <Folder className="w-4 h-4" />
                        Choose from Collection
                      </button>
                    </div>

                    {/* Hidden file input */}
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={handleMediaUpload}
                      className="hidden"
                      id="media-upload"
                    />

                    {/* Media preview */}
                    {(mediaPreview.length > 0 || selectedMediaFromCollection) && (
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                        <div className="flex gap-2">
                          {selectedMediaFromCollection ? (
                            <div className="relative w-20 h-20 bg-gray-100 rounded overflow-hidden">
                              {selectedMediaFromCollection.type === 'slideshow' ? (
                                <>
                                  <img src={`${selectedMediaFromCollection.file_url}/part_1.png`} alt="" className="w-full h-full object-cover" />
                                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs px-1 py-0.5 text-center">
                                    Slideshow
                                  </div>
                                </>
                              ) : selectedMediaFromCollection.type === 'video' ? (
                                <video src={selectedMediaFromCollection.file_url} className="w-full h-full object-cover" muted />
                              ) : (
                                <img src={selectedMediaFromCollection.file_url} alt="" className="w-full h-full object-cover" />
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedMediaFromCollection(null)}
                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            mediaPreview.map((url, idx) => (
                              <div key={idx} className="relative w-20 h-20 bg-gray-100 rounded overflow-hidden">
                                {formData.media_files[idx]?.type.startsWith('video') ? (
                                  <video src={url} className="w-full h-full object-cover" />
                                ) : (
                                  <img src={url} alt="" className="w-full h-full object-cover" />
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMediaPreview(prev => prev.filter((_, i) => i !== idx));
                                    setFormData(prev => ({
                                      ...prev,
                                      media_files: prev.media_files.filter((_, i) => i !== idx)
                                    }));
                                  }}
                                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* Music selection for slideshows */}
                    {selectedMediaFromCollection?.type === 'slideshow' && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Music className="w-4 h-4 text-gray-600" />
                            <span className="text-sm text-gray-700">
                              {selectedMusic ? selectedMusic.title : 'No music selected'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowMusicModal(true)}
                            className="px-3 py-1 text-sm bg-black text-white rounded hover:bg-gray-800"
                          >
                            {selectedMusic ? 'Change' : 'Select'} Music
                          </button>
                        </div>
                        <p className="text-xs text-gray-500">
                          Note: Music needs to be added manually in TikTok app after receiving the draft
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Platform-specific settings */}
                {formData.platform === 'TIKTOK' && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">TikTok Settings</h4>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Privacy
                      </label>
                      <select
                        value={formData.tiktok_privacy}
                        onChange={(e) => setFormData(prev => ({ ...prev, tiktok_privacy: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="PUBLIC">Public</option>
                        <option value="MUTUAL_FRIENDS">Friends</option>
                        <option value="ONLY_ME">Private</option>
                      </select>
                    </div>

                    <div className="space-y-4">
                      {/* Allow Comments Toggle */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">Allow Comments</span>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, allow_comments: !prev.allow_comments }))}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            formData.allow_comments ? 'bg-blue-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              formData.allow_comments ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Allow Duets Toggle */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">Allow Duets</span>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, allow_duet: !prev.allow_duet }))}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            formData.allow_duet ? 'bg-blue-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              formData.allow_duet ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Allow Stitches Toggle */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">Allow Stitches</span>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, allow_stitch: !prev.allow_stitch }))}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            formData.allow_stitch ? 'bg-blue-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              formData.allow_stitch ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Publish as Draft Toggle */}
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">Publish as draft</span>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, is_draft: !prev.is_draft }))}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              formData.is_draft ? 'bg-blue-600' : 'bg-gray-200'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                formData.is_draft ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                        {formData.is_draft && (
                          <p className="text-xs text-gray-500 mt-2">
                            Publish this content to TikTok as a draft post. You can find and edit your draft in TikTok's Inbox &gt; System Notifications, then publish it when ready
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Post Settings */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Post settings</h2>

                {/* Schedule */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pick time
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduled_for}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduled_for: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>


                {/* Submit Button */}
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !formData.social_account_id || !formData.content}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Processing...
                    </>
                  ) : formData.is_draft ? (
                    <>
                      <Send className="w-4 h-4" />
                      Schedule Draft
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Schedule Post
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Collection Assignment Modal */}
      {showCollectionModal && selectedAccountForCollection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">
                Assign Collection to Account
              </h3>
              <button
                onClick={() => {
                  setShowCollectionModal(false);
                  setSelectedAccountForCollection(null);
                }}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              <button
                onClick={() => assignCollectionToAccount(null)}
                className="w-full text-left p-3 hover:bg-gray-100 rounded-lg flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                  <X size={18} className="text-gray-600" />
                </div>
                <div>
                  <p className="font-medium">No Collection</p>
                  <p className="text-sm text-gray-500">Remove collection assignment</p>
                </div>
              </button>
              
              {availableCollections.map(collection => (
                <button
                  key={collection.id}
                  onClick={() => assignCollectionToAccount(collection.id)}
                  className={`w-full text-left p-3 hover:bg-gray-100 rounded-lg flex items-center gap-3 ${
                    accountCollections[selectedAccountForCollection] === collection.id ? 'bg-blue-50 border border-blue-200' : ''
                  }`}
                >
                  {/* Collection Cover with 3 images */}
                  <div className="w-16 h-16 rounded-lg bg-[#1a1a1a] overflow-hidden flex-shrink-0">
                    {collection.media_preview && collection.media_preview.length > 0 ? (
                      <div className="w-full h-full grid grid-cols-3 grid-rows-2 gap-0.5">
                        {/* First item - large, takes left 2/3 */}
                        {collection.media_preview[0] && (
                          <div className="col-span-2 row-span-2">
                            {collection.media_preview[0].file_url ? (
                              <video 
                                src={collection.media_preview[0].file_url} 
                                className="w-full h-full object-cover"
                                muted
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                <Folder className="w-6 h-6 text-gray-500" />
                              </div>
                            )}
                          </div>
                        )}
                        {/* Second item - top right */}
                        {collection.media_preview[1] ? (
                          <div className="col-span-1 row-span-1">
                            {collection.media_preview[1].file_url ? (
                              <video 
                                src={collection.media_preview[1].file_url} 
                                className="w-full h-full object-cover"
                                muted
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-700"></div>
                            )}
                          </div>
                        ) : (
                          <div className="col-span-1 row-span-1 bg-[#2a2a2a]"></div>
                        )}
                        {/* Third item - bottom right */}
                        {collection.media_preview[2] ? (
                          <div className="col-span-1 row-span-1">
                            {collection.media_preview[2].file_url ? (
                              <video 
                                src={collection.media_preview[2].file_url} 
                                className="w-full h-full object-cover"
                                muted
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-700"></div>
                            )}
                          </div>
                        ) : (
                          <div className="col-span-1 row-span-1 bg-[#2a2a2a]"></div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <Folder className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{collection.name}</p>
                    {collection.description && (
                      <p className="text-sm text-gray-500 truncate">{collection.description}</p>
                    )}
                  </div>
                  {accountCollections[selectedAccountForCollection] === collection.id && (
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  )}
                </button>
              ))}
              
              {availableCollections.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Folder size={48} className="mx-auto mb-3 text-gray-300" />
                  <p className="mb-3">No collections available</p>
                  <a
                    href="/posts-collections"
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Create your first collection
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Media Selection Modal */}
      {showMediaSelectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-xl font-semibold">Choose Media from Collections</h3>
              <button
                onClick={() => {
                  setShowMediaSelectionModal(false);
                  setCollectionMedia([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {collectionMedia.length === 0 ? (
                <div>
                  <h4 className="font-medium text-gray-700 mb-4">Select a Collection</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {availableCollections.map(collection => (
                      <button
                        key={collection.id}
                        onClick={async () => {
                          try {
                            const data = await getCollectionWithMedia(collection.id);
                            if (data) {
                              const allMedia = [
                                ...(data.videos || []).map(v => ({ ...v, type: 'video' })),
                                ...(data.slideshows || []).map(s => ({ ...s, type: 'slideshow' }))
                              ];
                              setCollectionMedia(allMedia);
                            }
                          } catch (error) {
                            console.error('Error loading collection media:', error);
                            toast.error('Failed to load collection media');
                          }
                        }}
                        className="p-4 border rounded-lg hover:bg-gray-50 text-left"
                      >
                        <div className="w-full aspect-square rounded bg-[#1a1a1a] overflow-hidden mb-2">
                          {collection.media_preview && collection.media_preview.length > 0 && collection.media_preview[0]?.file_url ? (
                            <video 
                              src={collection.media_preview[0].file_url} 
                              className="w-full h-full object-cover"
                              muted
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-200">
                              <Folder className="w-12 h-12 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <h4 className="font-medium text-sm truncate">{collection.name}</h4>
                        {collection.description && (
                          <p className="text-xs text-gray-500 truncate mt-1">{collection.description}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <button
                    onClick={() => setCollectionMedia([])}
                    className="text-blue-600 hover:text-blue-700 text-sm mb-4"
                  >
                    ← Back to Collections
                  </button>
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {collectionMedia.map((media) => (
                      <button
                        key={media.id}
                        onClick={() => {
                          setSelectedMediaFromCollection(media);
                          setShowMediaSelectionModal(false);
                          setCollectionMedia([]);
                          // Clear any uploaded files and music selection
                          setFormData(prev => ({ ...prev, media_files: [] }));
                          setMediaPreview([]);
                          setSelectedMusic(null);
                        }}
                        className="relative aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-500"
                      >
                        {media.type === 'slideshow' ? (
                          // For slideshows, show the first image with an overlay indicator
                          <div className="relative w-full h-full">
                            <img
                              src={`${media.file_url}/part_1.png`}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
                              Slideshow
                            </div>
                          </div>
                        ) : media.type === 'video' ? (
                          <video
                            src={media.file_url}
                            className="w-full h-full object-cover"
                            muted
                          />
                        ) : (
                          <img
                            src={media.file_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Music Selection Modal */}
      {showMusicModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-xl font-semibold">Select Music for Slideshow</h3>
              <button
                onClick={() => setShowMusicModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {userSongs.length === 0 ? (
                <div className="text-center py-8">
                  <Music className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">No music uploaded yet</p>
                  <p className="text-sm text-gray-500">Upload music in the Music page</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {userSongs.map(song => (
                    <button
                      key={song.id}
                      onClick={() => {
                        setSelectedMusic(song);
                        setShowMusicModal(false);
                      }}
                      className={`p-4 border rounded-lg text-left transition-colors ${
                        selectedMusic?.id === song.id
                          ? 'bg-blue-50 border-blue-500'
                          : 'hover:bg-gray-50 border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                          <Music className="w-5 h-5 text-gray-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{song.title}</p>
                          <p className="text-xs text-gray-500 truncate">{song.artist}</p>
                        </div>
                      </div>
                      {selectedMusic?.id === song.id && (
                        <div className="text-xs text-blue-600 font-medium">Selected</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {selectedMusic && (
              <div className="p-4 border-t bg-gray-50">
                <button
                  onClick={() => {
                    setSelectedMusic(null);
                    setShowMusicModal(false);
                  }}
                  className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                >
                  Remove Music
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Smart Bulk Schedule Modal */}
      {showBulkScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Smart Bulk Schedule</h2>
                  <p className="text-gray-600 mt-1">Schedule multiple posts across accounts automatically</p>
                </div>
                <button
                  onClick={() => setShowBulkScheduleModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Collection Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Collection *
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {availableCollections.map(collection => (
                    <button
                      key={collection.id}
                      onClick={() => setBulkConfig(prev => ({ ...prev, collectionId: collection.id }))}
                      className={`p-4 border rounded-lg text-left transition-colors ${
                        bulkConfig.collectionId === collection.id
                          ? 'bg-blue-50 border-blue-500'
                          : 'hover:bg-gray-50 border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Folder className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="font-medium text-sm">{collection.name}</p>
                          <p className="text-xs text-gray-500">
                            {collection.stats?.videos || 0}V + {collection.stats?.slideshows || 0}S
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Account Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Accounts * ({bulkConfig.selectedAccounts.length} selected)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto">
                  {accounts.map(account => (
                    <button
                      key={account.id}
                      onClick={() => {
                        setBulkConfig(prev => ({
                          ...prev,
                          selectedAccounts: prev.selectedAccounts.includes(account.id)
                            ? prev.selectedAccounts.filter(id => id !== account.id)
                            : [...prev.selectedAccounts, account.id]
                        }));
                      }}
                      className={`p-3 border rounded-lg text-left transition-colors ${
                        bulkConfig.selectedAccounts.includes(account.id)
                          ? 'bg-green-50 border-green-500'
                          : 'hover:bg-gray-50 border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {getPlatformIcon(account.platform)}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {customUsernames[account.id] || account.displayName || account.platformUsername || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500">{account.platform}</p>
                        </div>
                        {bulkConfig.selectedAccounts.includes(account.id) && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Configuration Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Posts Per Day */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Posts Per Day
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={bulkConfig.postsPerDay}
                    onChange={(e) => setBulkConfig(prev => ({ ...prev, postsPerDay: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={bulkConfig.durationDays}
                    onChange={(e) => setBulkConfig(prev => ({ ...prev, durationDays: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={bulkConfig.startDate}
                    onChange={(e) => setBulkConfig(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Draft Toggle */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Post Type
                  </label>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setBulkConfig(prev => ({ ...prev, isDraft: false }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        !bulkConfig.isDraft
                          ? 'bg-green-100 text-green-700 border border-green-300'
                          : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      Publish
                    </button>
                    <button
                      onClick={() => setBulkConfig(prev => ({ ...prev, isDraft: true }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        bulkConfig.isDraft
                          ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                          : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      Draft
                    </button>
                  </div>
                </div>
              </div>

              {/* Caption */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Caption (Optional)
                </label>
                <textarea
                  value={bulkConfig.content}
                  onChange={(e) => setBulkConfig(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Enter your caption here..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              {/* Stats Preview */}
              {bulkConfig.collectionId && bulkConfig.selectedAccounts.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 mb-2">Scheduling Preview</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-blue-600 font-medium">Total Posts</p>
                      <p className="text-blue-900 text-lg font-bold">
                        {bulkConfig.selectedAccounts.length * bulkConfig.postsPerDay * bulkConfig.durationDays}
                      </p>
                    </div>
                    <div>
                      <p className="text-blue-600 font-medium">Accounts</p>
                      <p className="text-blue-900 text-lg font-bold">{bulkConfig.selectedAccounts.length}</p>
                    </div>
                    <div>
                      <p className="text-blue-600 font-medium">Posts/Day</p>
                      <p className="text-blue-900 text-lg font-bold">{bulkConfig.postsPerDay}</p>
                    </div>
                    <div>
                      <p className="text-blue-600 font-medium">Duration</p>
                      <p className="text-blue-900 text-lg font-bold">{bulkConfig.durationDays}d</p>
                    </div>
                  </div>
                  <p className="text-blue-700 text-xs mt-2">
                    Posts will be automatically distributed across selected accounts with smart timing (8AM-8PM)
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowBulkScheduleModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkSchedule}
                  disabled={!bulkConfig.collectionId || bulkConfig.selectedAccounts.length === 0 || isBulkScheduling}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  {isBulkScheduling ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Scheduling...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Schedule {bulkConfig.selectedAccounts.length * bulkConfig.postsPerDay * bulkConfig.durationDays} Posts
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}