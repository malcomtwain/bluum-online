"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Plus, Users, ExternalLink, Edit2, Check, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface TikTokAccount {
  id: string;
  platform: string;
  platformUsername?: string;
  displayName?: string;
}

interface TikTokProfile {
  username: string;
  displayName: string;
  avatar: string;
  followers: number;
  following: number;
  hearts: number;
  videos: number;
  verified: boolean;
  signature: string;
}

export default function TikTokAccountsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState<TikTokAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [customUsernames, setCustomUsernames] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, TikTokProfile>>({});

  useEffect(() => {
    if (user) {
      loadTikTokAccounts();
      loadCustomUsernames();
    }
  }, [user]);

  const loadTikTokAccounts = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const response = await fetch('/api/postfast/social-accounts', {
        headers: {
          'x-invitation-code': user.id // Pass user ID as invitation code
        }
      });
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 404) {
          // No API key configured
          setAccounts([]);
          setHasApiKey(false);
          return;
        }
        throw new Error(data.error || 'Failed to fetch accounts');
      }
      
      // Filtrer uniquement les comptes TikTok
      const tiktokAccounts = data.accounts || [];
      setAccounts(tiktokAccounts);
      setHasApiKey(true);
    } catch (error) {
      console.error('Error loading TikTok accounts:', error);
      toast.error('Failed to load TikTok accounts');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
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
        // Charger les profils TikTok pour chaque username
        for (const [accountId, username] of Object.entries(data.usernames || {})) {
          loadTikTokProfile(accountId, username as string);
        }
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

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadTikTokAccounts();
    loadCustomUsernames();
  };
  
  const startEditUsername = (accountId: string, currentUsername: string) => {
    setEditingId(accountId);
    setEditUsername(currentUsername || '');
  };
  
  const saveUsername = async (accountId: string) => {
    if (!user || !editUsername.trim()) return;
    
    try {
      const response = await fetch('/api/social-usernames', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          accountId: accountId,
          platform: 'TIKTOK',
          username: editUsername
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setCustomUsernames(prev => ({ ...prev, [accountId]: data.username }));
        // Charger le profil TikTok pour ce nouvel username
        loadTikTokProfile(accountId, data.username);
        toast.success('Username saved');
      }
    } catch (error) {
      console.error('Error saving username:', error);
      toast.error('Failed to save username');
    } finally {
      setEditingId(null);
      setEditUsername('');
    }
  };
  
  const cancelEdit = () => {
    setEditingId(null);
    setEditUsername('');
  };

  const connectTikTok = () => {
    if (!user) {
      toast.error('Please sign in to connect TikTok accounts');
      return;
    }

    setIsConnecting(true);
    // Ouvrir PostFast dans un nouvel onglet
    window.open('https://postfa.st', '_blank');
    toast.info('Connect your TikTok account on PostFast, then come back and refresh.');
    setTimeout(() => setIsConnecting(false), 2000);
  };

  const formatFollowers = (count?: number) => {
    if (!count) return '0';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f3f4f0' }}>
      <div className="p-6 xl:p-8">
        <div className="pt-8 xl:pt-8 max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Connected Accounts</h1>
              <p className="text-gray-600 mt-2">
                Connect your TikTok accounts to publish drafts via PostFast
              </p>
            </div>
          </div>

          {/* TikTok Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900">TikTok</h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-2 text-gray-600 px-4 py-2.5 rounded-full hover:bg-gray-100 transition-all font-medium disabled:opacity-50"
                >
                  <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </button>
                <button
                  onClick={connectTikTok}
                  disabled={isConnecting}
                  className="flex items-center gap-2 bg-black text-white px-6 py-2.5 rounded-full hover:bg-gray-800 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-5 h-5" />
                  {isConnecting ? 'Connecting...' : 'Connect TikTok'}
                </button>
              </div>
            </div>

            {/* Connected Accounts List */}
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-500 mx-auto"></div>
                <p className="text-gray-500 mt-3">Loading accounts...</p>
              </div>
            ) : !hasApiKey ? (
              <div className="text-center py-8 bg-yellow-50 rounded-lg border border-yellow-200">
                <svg className="w-12 h-12 text-yellow-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
                </svg>
                <p className="text-yellow-800 font-medium mb-2">No Post-bridge API Key Configured</p>
                <p className="text-yellow-700 text-sm mb-4">You need to add your Post-bridge API key first</p>
                <button
                  onClick={() => router.push('/post-bridge-keys')}
                  className="px-6 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-full transition-all font-medium"
                >
                  Configure API Key
                </button>
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No TikTok accounts connected</p>
                <p className="text-gray-500 text-sm mt-1">Connect via PostFast to publish drafts</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {accounts.map((account) => {
                  const profile = profiles[account.id];
                  
                  return (
                    <div key={account.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-4">
                        {/* Avatar avec image de profil ou icône par défaut */}
                        <div className="relative">
                          {profile?.avatar ? (
                            <img 
                              src={profile.avatar}
                              alt={profile.displayName || 'Profile'}
                              className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                              onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                // Si l'image ne se charge pas, afficher l'icône par défaut
                                const img = e.currentTarget;
                                img.style.display = 'none';
                                const nextSibling = img.nextElementSibling as HTMLElement;
                                if (nextSibling) {
                                  nextSibling.classList.remove('hidden');
                                }
                              }}
                            />
                          ) : null}
                          <div className={`w-12 h-12 bg-gradient-to-br from-black to-gray-700 rounded-full flex items-center justify-center ${profile?.avatar ? 'hidden' : ''}`}>
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                            </svg>
                          </div>
                          {profile?.verified && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white">
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">
                            {profile?.displayName || account.displayName || account.platformUsername || 'TikTok Account'}
                          </h3>
                          {editingId === account.id ? (
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="text"
                                value={editUsername}
                                onChange={(e) => setEditUsername(e.target.value)}
                                placeholder="Enter @username"
                                className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                              />
                              <button
                                onClick={() => saveUsername(account.id)}
                                className="p-1 text-green-600 hover:bg-green-100 rounded"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 text-red-600 hover:bg-red-100 rounded"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center justify-center gap-2 mt-1">
                                <p className="text-sm text-gray-600">
                                  @{customUsernames[account.id] || 'username not set'}
                                </p>
                                <button
                                  onClick={() => startEditUsername(account.id, customUsernames[account.id] || '')}
                                  className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="font-medium text-purple-900 mb-2">How it works with PostFast</h3>
            <ul className="text-sm text-purple-800 space-y-1 list-disc list-inside">
              <li>Connect your TikTok accounts on PostFast.st</li>
              <li>Generate videos in Bluum</li>
              <li>Send videos as drafts directly to TikTok</li>
              <li>Review and publish from the TikTok app</li>
              <li>Limit: 5 drafts pending per account every 24h</li>
            </ul>
          </div>

          {/* PostFast Info */}
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-medium text-yellow-900 mb-2">PostFast Pricing</h3>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• Creator Plan (€19/month): 600 posts/month</li>
              <li>• Pro Plan (€79/month): Unlimited drafts, 120 accounts</li>
              <li>• For 180 accounts: 2 Pro plans (€158/month)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}