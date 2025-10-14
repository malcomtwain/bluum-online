"use client";

import React, { useState, useEffect } from 'react';
import { 
  Calendar, Users, Clock, Settings, Play, 
  ChevronRight, Check, X, Loader, Sparkles,
  Folder, Video, Image, Grid, List, CheckSquare,
  Square, AlertCircle, Eye
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { format, addDays, differenceInDays } from 'date-fns';
import { 
  getUserCollections, 
  getCollectionWithMedia,
  type MediaCollection 
} from '@/lib/media-collections';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface SocialAccount {
  id: number;
  platform: string;
  username: string;
  displayName?: string;
  profileImageUrl?: string;
  selected?: boolean;
}

interface DistributionConfig {
  startDate: string;
  endDate: string;
  postsPerDay: number;
  postTimes: string[];
  distributionMethod: 'smart' | 'sequential' | 'random';
}

interface DistributionPlan {
  date: string;
  account: SocialAccount;
  media: any;
  time: string;
}

export default function DistributionPage() {
  const { user } = useAuth();
  
  // États principaux
  const [collections, setCollections] = useState<MediaCollection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<MediaCollection | null>(null);
  const [collectionMedia, setCollectionMedia] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [distributionPlan, setDistributionPlan] = useState<DistributionPlan[]>([]);
  
  // Configuration
  const [config, setConfig] = useState<DistributionConfig>({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    postsPerDay: 3,
    postTimes: ['09:00', '14:00', '20:00'],
    distributionMethod: 'smart'
  });
  
  // Statistiques
  const [stats, setStats] = useState({
    totalPosts: 0,
    uniqueMedia: 0,
    avgUsagePerMedia: 0,
    totalDays: 0
  });

  // Bulk scheduling state
  const [isScheduling, setIsScheduling] = useState(false);
  const [isDraft, setIsDraft] = useState(true);
  const [postContent, setPostContent] = useState('');
  const [tiktokSettings, setTiktokSettings] = useState({
    privacy: 'PUBLIC',
    allowComments: true,
    allowDuet: true,
    allowStitch: true
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    calculateStats();
  }, [selectedAccounts, config, collectionMedia]);

  const loadData = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      // Charger les collections
      const userCollections = await getUserCollections(user.id);
      setCollections(userCollections);
      
      // Charger les comptes sociaux
      await loadSocialAccounts();
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSocialAccounts = async () => {
    if (!user) return;
    
    try {
      // Get user's Post-bridge API key
      const { data: apiKeyData } = await supabase
        .from('post_bridge_api_keys')
        .select('api_key')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();
      
      if (!apiKeyData?.api_key) return;
      
      // Fetch social accounts from Post-bridge
      const response = await fetch('/api/post-bridge/social-accounts', {
        headers: {
          'Authorization': `Bearer ${apiKeyData.api_key}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.allAccounts || data.accounts || []);
      }
    } catch (error) {
      console.error('Error loading social accounts:', error);
    }
  };

  const selectCollection = async (collection: MediaCollection) => {
    setSelectedCollection(collection);
    
    // Charger les médias de la collection
    const collectionData = await getCollectionWithMedia(collection.id);
    if (collectionData) {
      const allMedia = [
        ...(collectionData.videos || []),
        ...(collectionData.slideshows || [])
      ];
      setCollectionMedia(allMedia);
    }
  };

  const toggleAccount = (accountId: number) => {
    setSelectedAccounts(prev => 
      prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const toggleAllAccounts = () => {
    if (selectedAccounts.length === accounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(accounts.map(acc => acc.id));
    }
  };

  const calculateStats = () => {
    const days = differenceInDays(
      new Date(config.endDate), 
      new Date(config.startDate)
    ) + 1;
    
    const totalPosts = selectedAccounts.length * config.postsPerDay * days;
    const uniqueMedia = collectionMedia.length;
    const avgUsage = uniqueMedia > 0 ? Math.ceil(totalPosts / uniqueMedia) : 0;
    
    setStats({
      totalPosts,
      uniqueMedia,
      avgUsagePerMedia: avgUsage,
      totalDays: days
    });
  };

  const generateDistributionPlan = () => {
    if (!selectedCollection || selectedAccounts.length === 0 || collectionMedia.length === 0) {
      toast.error('Please select a collection and at least one account');
      return;
    }
    
    setIsGenerating(true);
    
    // Algorithme de distribution intelligente
    const plan: DistributionPlan[] = [];
    const days = differenceInDays(new Date(config.endDate), new Date(config.startDate)) + 1;
    
    // Créer un index rotatif pour chaque compte pour éviter les répétitions
    const accountMediaIndex: Record<string, number> = {};
    selectedAccounts.forEach(accId => {
      accountMediaIndex[accId] = 0;
    });
    
    // Générer le plan jour par jour
    for (let day = 0; day < days; day++) {
      const currentDate = format(addDays(new Date(config.startDate), day), 'yyyy-MM-dd');
      
      // Pour chaque compte sélectionné
      selectedAccounts.forEach((accountId, accountIndex) => {
        const account = accounts.find(acc => acc.id === accountId);
        if (!account) return;
        
        // Pour chaque post du jour
        for (let postNum = 0; postNum < config.postsPerDay; postNum++) {
          // Distribution intelligente : rotation avec décalage
          let mediaIndex = 0;
          
          if (config.distributionMethod === 'smart') {
            // Chaque compte commence à un index différent et rotate
            const startOffset = accountIndex * Math.floor(collectionMedia.length / selectedAccounts.length);
            mediaIndex = (accountMediaIndex[accountId] + startOffset) % collectionMedia.length;
            accountMediaIndex[accountId]++;
          } else if (config.distributionMethod === 'sequential') {
            mediaIndex = (day * config.postsPerDay + postNum) % collectionMedia.length;
          } else if (config.distributionMethod === 'random') {
            mediaIndex = Math.floor(Math.random() * collectionMedia.length);
          }
          
          plan.push({
            date: currentDate,
            account,
            media: collectionMedia[mediaIndex],
            time: config.postTimes[postNum % config.postTimes.length]
          });
        }
      });
    }
    
    setDistributionPlan(plan);
    setShowPreview(true);
    setIsGenerating(false);
  };

  const confirmDistribution = async () => {
    if (!selectedCollection || selectedAccounts.length === 0) {
      toast.error('Please select a collection and accounts');
      return;
    }

    setIsScheduling(true);

    try {
      const durationDays = differenceInDays(new Date(config.endDate), new Date(config.startDate)) + 1;

      const response = await fetch('/api/bulk-schedule-bridge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionId: selectedCollection.id,
          selectedAccounts,
          postsPerDay: config.postsPerDay,
          durationDays,
          startDate: config.startDate,
          isDraft,
          content: postContent || `Content from ${selectedCollection.name} collection`,
          tiktokSettings
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to schedule posts');
      }

      const result = await response.json();

      toast.success(
        `✅ Successfully scheduled ${result.scheduled} posts! ${
          result.errors > 0 ? `(${result.errors} failed)` : ''
        }`
      );

      if (result.errors > 0) {
        console.warn('Some posts failed to schedule:', result.details.failed);
      }

      setShowPreview(false);
      setPostContent('');
    } catch (error: any) {
      console.error('Bulk scheduling error:', error);
      toast.error(`Failed to schedule posts: ${error.message}`);
    } finally {
      setIsScheduling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading distribution manager...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Distribution Manager</h1>
          <p className="text-gray-600 mt-2">Automatically distribute content across your social accounts</p>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Collection & Media */}
          <div className="space-y-6">
            {/* Collection Selector */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Folder className="w-5 h-5 text-blue-600" />
                Source Collection
              </h2>
              
              {selectedCollection ? (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{selectedCollection.name}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {collectionMedia.length} items available
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedCollection(null);
                        setCollectionMedia([]);
                      }}
                      className="p-2 hover:bg-blue-100 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Media Preview Grid */}
                  <div className="mt-3 grid grid-cols-4 gap-1">
                    {collectionMedia.slice(0, 8).map((media, idx) => (
                      <div key={idx} className="aspect-square bg-gray-200 rounded overflow-hidden">
                        {media.file_url && (
                          <video 
                            src={media.file_url} 
                            className="w-full h-full object-cover"
                            muted
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {collections.map(collection => (
                    <button
                      key={collection.id}
                      onClick={() => selectCollection(collection)}
                      className="w-full text-left p-3 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{collection.name}</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Statistics */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Distribution Stats
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total posts:</span>
                  <span className="font-semibold">{stats.totalPosts.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Unique media:</span>
                  <span className="font-semibold">{stats.uniqueMedia}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg usage/media:</span>
                  <span className="font-semibold">{stats.avgUsagePerMedia}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-semibold">{stats.totalDays} days</span>
                </div>
              </div>
              
              {stats.avgUsagePerMedia > stats.uniqueMedia && (
                <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    Media will be reused multiple times due to high post volume
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Middle Column - Accounts */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-green-600" />
              Social Accounts
              <span className="ml-auto text-sm text-gray-500">
                {selectedAccounts.length}/{accounts.length} selected
              </span>
            </h2>
            
            <div className="mb-3">
              <button
                onClick={toggleAllAccounts}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {selectedAccounts.length === accounts.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {accounts.map(account => (
                <div
                  key={account.id}
                  onClick={() => toggleAccount(account.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedAccounts.includes(account.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {selectedAccounts.includes(account.id) ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {account.displayName || account.username}
                      </p>
                      <p className="text-sm text-gray-500">{account.platform}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column - Configuration */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-orange-600" />
                Configuration
              </h2>
              
              <div className="space-y-4">
                {/* Date Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={config.startDate}
                    onChange={(e) => setConfig({...config, startDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={config.endDate}
                    onChange={(e) => setConfig({...config, endDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                {/* Posts per day */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Posts per day per account
                  </label>
                  <select
                    value={config.postsPerDay}
                    onChange={(e) => setConfig({...config, postsPerDay: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>1 post/day</option>
                    <option value={2}>2 posts/day</option>
                    <option value={3}>3 posts/day</option>
                    <option value={4}>4 posts/day</option>
                    <option value={5}>5 posts/day</option>
                  </select>
                </div>
                
                {/* Post Times */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Post Times
                  </label>
                  <div className="space-y-2">
                    {config.postTimes.map((time, idx) => (
                      <input
                        key={idx}
                        type="time"
                        value={time}
                        onChange={(e) => {
                          const newTimes = [...config.postTimes];
                          newTimes[idx] = e.target.value;
                          setConfig({...config, postTimes: newTimes});
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ))}
                  </div>
                </div>
                
                {/* Distribution Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Distribution Method
                  </label>
                  <select
                    value={config.distributionMethod}
                    onChange={(e) => setConfig({...config, distributionMethod: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="smart">Smart Rotation (Recommended)</option>
                    <option value="sequential">Sequential</option>
                    <option value="random">Random</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Smart rotation ensures maximum variety per account
                  </p>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={generateDistributionPlan}
              disabled={!selectedCollection || selectedAccounts.length === 0 || isGenerating}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader className="animate-spin w-5 h-5" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Generate Distribution Plan
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Distribution Preview</h2>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Post Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Post Settings</h3>

                  {/* Post Content */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Post Content
                    </label>
                    <textarea
                      value={postContent}
                      onChange={(e) => setPostContent(e.target.value)}
                      placeholder={`Content from ${selectedCollection?.name} collection`}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Draft Toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Publish as draft</span>
                    <button
                      type="button"
                      onClick={() => setIsDraft(!isDraft)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isDraft ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isDraft ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* TikTok Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">TikTok Settings</h3>

                  {/* Privacy */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Privacy
                    </label>
                    <select
                      value={tiktokSettings.privacy}
                      onChange={(e) => setTiktokSettings(prev => ({ ...prev, privacy: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="PUBLIC">Public</option>
                      <option value="MUTUAL_FRIENDS">Friends</option>
                      <option value="ONLY_ME">Private</option>
                    </select>
                  </div>

                  {/* TikTok Toggles */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Allow Comments</span>
                      <button
                        type="button"
                        onClick={() => setTiktokSettings(prev => ({ ...prev, allowComments: !prev.allowComments }))}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          tiktokSettings.allowComments ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                            tiktokSettings.allowComments ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Allow Duets</span>
                      <button
                        type="button"
                        onClick={() => setTiktokSettings(prev => ({ ...prev, allowDuet: !prev.allowDuet }))}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          tiktokSettings.allowDuet ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                            tiktokSettings.allowDuet ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Allow Stitches</span>
                      <button
                        type="button"
                        onClick={() => setTiktokSettings(prev => ({ ...prev, allowStitch: !prev.allowStitch }))}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          tiktokSettings.allowStitch ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                            tiktokSettings.allowStitch ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-4 border-t pt-4">
                <p className="text-gray-600">
                  Total: <span className="font-semibold">{distributionPlan.length} posts</span> will be scheduled
                  {isDraft && (
                    <span className="text-blue-600 ml-2">(as drafts)</span>
                  )}
                </p>
              </div>
              
              {/* Group by date for preview */}
              <div className="space-y-4">
                {Array.from(new Set(distributionPlan.map(p => p.date))).slice(0, 3).map(date => (
                  <div key={date} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(date), 'EEEE, MMM d, yyyy')}
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {distributionPlan
                        .filter(p => p.date === date)
                        .slice(0, 6)
                        .map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                            <Clock className="w-3 h-3 text-gray-400" />
                            <span className="font-medium">{item.time}</span>
                            <span className="text-gray-600">{item.account.platformUsername}</span>
                          </div>
                        ))}
                    </div>
                    {distributionPlan.filter(p => p.date === date).length > 6 && (
                      <p className="text-sm text-gray-500 mt-2">
                        +{distributionPlan.filter(p => p.date === date).length - 6} more posts
                      </p>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <Check className="inline w-4 h-4 mr-1" />
                  Distribution uses smart rotation to ensure maximum content variety per account
                </p>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDistribution}
                  disabled={isScheduling}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isScheduling ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Confirm & Schedule
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