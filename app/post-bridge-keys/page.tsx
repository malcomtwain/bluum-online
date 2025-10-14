"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Key, Plus, Trash2, Eye, EyeOff, Copy, CheckCircle, TestTube, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@supabase/supabase-js';
import { PostBridgeAPI } from '@/lib/post-bridge';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ApiKey {
  id: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
}

export default function PostBridgeKeysPage() {
  const { user } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showKey, setShowKey] = useState<{[key: string]: boolean}>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{[key: string]: 'success' | 'error' | null}>({});
  
  const [newKeyData, setNewKeyData] = useState({
    api_key: ''
  });

  useEffect(() => {
    if (user) {
      loadApiKeys();
    }
  }, [user]);

  const loadApiKeys = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('post_bridge_api_keys')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys(data || []);
    } catch (error) {
      console.error('Error loading API keys:', error);
      toast.error('Failed to load API keys');
    } finally {
      setIsLoading(false);
    }
  };

  const testApiKey = async (apiKey: string) => {
    setTestingKey(apiKey);
    try {
      // Test the API key using our dedicated test route
      const response = await fetch('/api/post-bridge/test', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setTestResults(prev => ({ ...prev, [apiKey]: 'success' }));
        toast.success(`API key is valid! Found ${data.totalAccounts} social accounts.`);
        return true;
      } else {
        throw new Error(data.error || 'Invalid API key');
      }
    } catch (error: any) {
      console.error('API key test failed:', error);
      setTestResults(prev => ({ ...prev, [apiKey]: 'error' }));
      toast.error(`API key test failed: ${error.message}`);
      return false;
    } finally {
      setTestingKey(null);
    }
  };

  const handleAddKey = async () => {
    if (!user) return;
    
    if (!newKeyData.api_key) {
      toast.error('Please enter an API key');
      return;
    }

    // Validate API key format
    if (!newKeyData.api_key.startsWith('pb_live_') && !newKeyData.api_key.startsWith('pb_test_')) {
      toast.error('Invalid Post-bridge API key format. It should start with pb_live_ or pb_test_');
      return;
    }

    try {
      setIsLoading(true);
      
      // Test the API key first
      const isValid = await testApiKey(newKeyData.api_key);
      if (!isValid) {
        return;
      }

      // Check if key already exists
      const existingKey = apiKeys.find(key => key.api_key === newKeyData.api_key);
      if (existingKey) {
        toast.error('This API key already exists');
        return;
      }

      const { data, error } = await supabase
        .from('post_bridge_api_keys')
        .insert({
          user_id: user.id,
          api_key: newKeyData.api_key,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      setApiKeys([data, ...apiKeys]);
      setShowAddModal(false);
      setNewKeyData({ api_key: '' });
      toast.success('Post-bridge API key added successfully');
    } catch (error) {
      console.error('Error adding API key:', error);
      toast.error('Failed to add API key');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (keyId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('post_bridge_api_keys')
        .update({ is_active: !currentStatus })
        .eq('id', keyId);

      if (error) throw error;

      setApiKeys(apiKeys.map(key => 
        key.id === keyId ? { ...key, is_active: !currentStatus } : key
      ));
      
      toast.success(`API key ${!currentStatus ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error('Error toggling API key:', error);
      toast.error('Failed to update API key');
    }
  };

  const handleDelete = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;

    try {
      const { error } = await supabase
        .from('post_bridge_api_keys')
        .delete()
        .eq('id', keyId);

      if (error) throw error;

      setApiKeys(apiKeys.filter(key => key.id !== keyId));
      toast.success('API key deleted');
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast.error('Failed to delete API key');
    }
  };

  const handleCopyKey = (apiKey: string) => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(apiKey);
    setTimeout(() => setCopiedKey(null), 2000);
    toast.success('API key copied to clipboard');
  };

  const toggleShowKey = (keyId: string) => {
    setShowKey(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f3f4f0' }}>
      <div className="p-6 xl:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Post-bridge API Keys</h1>
              <p className="text-gray-600 mt-2">
                Manage your Post-bridge API keys for scheduling posts across social media platforms
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add API Key
            </button>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800 text-sm">
              <strong>How to get your Post-bridge API key:</strong>
            </p>
            <ol className="list-decimal list-inside text-blue-700 text-sm mt-2 space-y-1">
              <li>Go to <a href="https://post-bridge.com" target="_blank" rel="noopener noreferrer" className="underline">post-bridge.com</a></li>
              <li>Sign up or log in to your account</li>
              <li>Navigate to API Keys in your dashboard</li>
              <li>Generate a new API key</li>
              <li>Copy the key (starts with pb_live_ or pb_test_) and add it here</li>
            </ol>
            <div className="mt-3 p-3 bg-white rounded border border-blue-300">
              <p className="text-blue-800 text-xs font-medium">
                📚 <strong>Documentation:</strong> <a href="https://api.post-bridge.com/docs" target="_blank" rel="noopener noreferrer" className="underline">https://api.post-bridge.com/docs</a>
              </p>
            </div>
          </div>

          {/* Migration Notice */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800 text-sm">
              <strong>✅ Migrated from PostFast to Post-bridge!</strong> 
              Post-bridge offers better reliability, more platforms, and improved documentation.
            </p>
          </div>

          {/* API Keys List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium mb-2">No API keys configured</p>
              <p className="text-gray-500 text-sm">
                Add your Post-bridge API key to start scheduling posts across multiple platforms
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map(key => (
                <div 
                  key={key.id}
                  className={`bg-white rounded-lg shadow-sm p-6 ${!key.is_active ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">
                          {key.api_key.startsWith('pb_live_') ? 'Live API Key' : 'Test API Key'}
                        </h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          key.is_active 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {key.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {testResults[key.api_key] === 'success' && (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                            ✓ Verified
                          </span>
                        )}
                        {testResults[key.api_key] === 'error' && (
                          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                            ✗ Error
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mb-3">
                        <code className="bg-gray-100 px-3 py-1 rounded text-sm font-mono">
                          {showKey[key.id] 
                            ? key.api_key 
                            : `${key.api_key.substring(0, 15)}...${key.api_key.substring(key.api_key.length - 4)}`
                          }
                        </code>
                        <button
                          onClick={() => toggleShowKey(key.id)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {showKey[key.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleCopyKey(key.api_key)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {copiedKey === key.api_key ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => testApiKey(key.api_key)}
                          disabled={testingKey === key.api_key}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-purple-600 border border-purple-600 rounded hover:bg-purple-50 disabled:opacity-50"
                        >
                          {testingKey === key.api_key ? (
                            <div className="w-3 h-3 border border-purple-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <TestTube className="w-3 h-3" />
                          )}
                          Test
                        </button>
                      </div>
                      
                      <p className="text-sm text-gray-500">
                        Added on {new Date(key.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleToggleActive(key.id, key.is_active)}
                        className={`px-3 py-1 text-sm rounded-lg ${
                          key.is_active
                            ? 'text-gray-600 border border-gray-300 hover:bg-gray-50'
                            : 'text-green-600 border border-green-600 hover:bg-green-50'
                        }`}
                      >
                        {key.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete(key.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add API Key Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Add Post-bridge API Key</h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Key
                </label>
                <input
                  type="text"
                  value={newKeyData.api_key}
                  onChange={(e) => setNewKeyData({ ...newKeyData, api_key: e.target.value })}
                  placeholder="pb_live_..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Must start with pb_live_ (production) or pb_test_ (testing)
                </p>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewKeyData({ api_key: '' });
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddKey}
                disabled={isLoading || !newKeyData.api_key}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add & Test Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}