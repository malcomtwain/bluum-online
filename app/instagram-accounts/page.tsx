"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Plus, Users, ExternalLink, Instagram, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface InstagramAccount {
  id: string;
  platform: string;
  platformUsername?: string;
  displayName?: string;
}

export default function InstagramAccountsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);

  useEffect(() => {
    if (user) {
      loadInstagramAccounts();
    }
  }, [user]);

  const loadInstagramAccounts = async () => {
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
      
      // Filter Instagram accounts from all accounts
      const instagramAccounts = (data.allAccounts || []).filter(
        (acc: InstagramAccount) => acc.platform === 'INSTAGRAM'
      );
      setAccounts(instagramAccounts);
      setHasApiKey(true);
    } catch (error) {
      console.error('Error loading Instagram accounts:', error);
      toast.error('Failed to load Instagram accounts');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadInstagramAccounts();
  };

  const connectInstagram = () => {
    if (!user) {
      toast.error('Please sign in to connect Instagram accounts');
      return;
    }

    setIsConnecting(true);
    // Open PostFast in a new tab
    window.open('https://postfa.st', '_blank');
    toast.info('Connect your Instagram account on PostFast, then come back and refresh.');
    setTimeout(() => setIsConnecting(false), 2000);
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
                Connect your Instagram accounts to manage and publish content
              </p>
            </div>
          </div>

          {/* Instagram Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 rounded-full flex items-center justify-center">
                  <Instagram className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Instagram</h2>
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
                  onClick={connectInstagram}
                  disabled={isConnecting}
                  className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white px-6 py-2.5 rounded-full hover:from-purple-700 hover:to-pink-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-5 h-5" />
                  {isConnecting ? 'Connecting...' : 'Connect Instagram'}
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
                <p className="text-gray-600 font-medium">No Instagram accounts connected</p>
                <p className="text-gray-500 text-sm mt-1">Connect via PostFast to manage your Instagram accounts</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {accounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                        <Instagram className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {account.displayName || account.platformUsername || 'Instagram Account'}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Connected via PostFast</span>
                          <span className="text-xs text-gray-500">ID: {account.id.slice(0, 8)}...</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {account.platformUsername && (
                        <a 
                          href={`https://www.instagram.com/${account.platformUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="font-medium text-purple-900 mb-2">About PostFast Instagram Integration</h3>
            <ul className="text-sm text-purple-800 space-y-1 list-disc list-inside">
              <li>Accounts are managed through your PostFast dashboard</li>
              <li>Support for multiple Instagram accounts with different API keys</li>
              <li>Publish photos and videos to Instagram feed</li>
              <li>Schedule posts for optimal engagement times</li>
              <li>Visit PostFast.st to connect more Instagram accounts</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}