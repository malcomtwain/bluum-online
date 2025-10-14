"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Plus, Users, Edit2, Check, X, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface SocialAccountRow {
  id: string;
  user_id: string;
  account_id: string;
  platform: string; // TIKTOK, INSTAGRAM, YOUTUBE
  custom_username: string;
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

const socialPlatforms = [
  {
    id: 'TIKTOK',
    name: 'TikTok',
    color: 'bg-black',
    hoverColor: 'hover:bg-gray-800',
    icon: (
      <svg fill="currentColor" width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 !h-8 !w-8">
        <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.394 10.692 6.33 6.33 0 0 0 10.857-4.424V8.687a8.182 8.182 0 0 0 4.773 1.526V6.79a4.831 4.831 0 0 1-1.003-.104z"></path>
      </svg>
    )
  },
  {
    id: 'INSTAGRAM',
    name: 'Instagram',
    color: 'bg-gradient-to-r from-purple-600 to-pink-500',
    hoverColor: 'hover:from-purple-700 hover:to-pink-600',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 102 102" fill="currentColor" className="h-6 w-6 !h-8 !w-8">
        <defs>
          <radialGradient id="a" cx="6.601" cy="99.766" r="129.502" gradientUnits="userSpaceOnUse">
            <stop offset=".09" stopColor="#fa8f21"></stop>
            <stop offset=".78" stopColor="#d82d7e"></stop>
          </radialGradient>
          <radialGradient id="b" cx="70.652" cy="96.49" r="113.963" gradientUnits="userSpaceOnUse">
            <stop offset=".64" stopColor="#8c3aaa" stopOpacity="0"></stop>
            <stop offset="1" stopColor="#8c3aaa"></stop>
          </radialGradient>
        </defs>
        <path fill="url(#a)" d="M25.865,101.639A34.341,34.341,0,0,1,14.312,99.5a19.329,19.329,0,0,1-7.154-4.653A19.181,19.181,0,0,1,2.5,87.694,34.341,34.341,0,0,1,.364,76.142C.061,69.584,0,67.617,0,51s.067-18.577.361-25.14A34.534,34.534,0,0,1,2.5,14.312,19.4,19.4,0,0,1,7.154,7.154,19.206,19.206,0,0,1,14.309,2.5,34.341,34.341,0,0,1,25.862.361C32.422.061,34.392,0,51,0s18.577.067,25.14.361A34.534,34.534,0,0,1,87.691,2.5a19.254,19.254,0,0,1,7.154,4.653A19.267,19.267,0,0,1,99.5,14.309a34.341,34.341,0,0,1,2.14,11.553c.3,6.563.361,8.528.361,25.14s-.061,18.577-.361,25.14A34.5,34.5,0,0,1,99.5,87.694,20.6,20.6,0,0,1,87.691,99.5a34.342,34.342,0,0,1-11.553,2.14c-6.557.3-8.528.361-25.14.361s-18.577-.058-25.134-.361"></path>
        <path fill="url(#b)" d="M25.865,101.639A34.341,34.341,0,0,1,14.312,99.5a19.329,19.329,0,0,1-7.154-4.653A19.181,19.181,0,0,1,2.5,87.694,34.341,34.341,0,0,1,.364,76.142C.061,69.584,0,67.617,0,51s.067-18.577.361-25.14A34.534,34.534,0,0,1,2.5,14.312,19.4,19.4,0,0,1,7.154,7.154,19.206,19.206,0,0,1,14.309,2.5,34.341,34.341,0,0,1,25.862.361C32.422.061,34.392,0,51,0s18.577.067,25.14.361A34.534,34.534,0,0,1,87.691,2.5a19.254,19.254,0,0,1,7.154,4.653A19.267,19.267,0,0,1,99.5,14.309a34.341,34.341,0,0,1,2.14,11.553c.3,6.563.361,8.528.361,25.14s-.061,18.577-.361,25.14A34.5,34.5,0,0,1,99.5,87.694,20.6,20.6,0,0,1,87.691,99.5a34.342,34.342,0,0,1-11.553,2.14c-6.557.3-8.528.361-25.14.361s-18.577-.058-25.134-.361"></path>
        <path fill="#fff" d="M461.114,477.413a12.631,12.631,0,1,1,12.629,12.632,12.631,12.631,0,0,1-12.629-12.632m-6.829,0a19.458,19.458,0,1,0,19.458-19.458,19.457,19.457,0,0,0-19.458,19.458m35.139-20.229a4.547,4.547,0,1,0,4.549-4.545h0a4.549,4.549,0,0,0-4.547,4.545m-30.99,51.074a20.943,20.943,0,0,1-7.037-1.3,12.547,12.547,0,0,1-7.193-7.19,20.923,20.923,0,0,1-1.3-7.037c-.184-3.994-.22-5.194-.22-15.313s.04-11.316.22-15.314a21.082,21.082,0,0,1,1.3-7.037,12.54,12.54,0,0,1,7.193-7.193,20.924,20.924,0,0,1,7.037-1.3c3.994-.184,5.194-.22,15.309-.22s11.316.039,15.314.221a21.082,21.082,0,0,1,7.037,1.3,12.541,12.541,0,0,1,7.193,7.193,20.926,20.926,0,0,1,1.3,7.037c.184,4,.22,5.194.22,15.314s-.037,11.316-.22,15.314a21.023,21.023,0,0,1-1.3,7.037,12.547,12.547,0,0,1-7.193,7.19,20.925,20.925,0,0,1-7.037,1.3c-3.994.184-5.194.22-15.314.22s-11.316-.037-15.309-.22m-.314-68.509a27.786,27.786,0,0,0-9.2,1.76,19.373,19.373,0,0,0-11.083,11.083,27.794,27.794,0,0,0-1.76,9.2c-.187,4.04-.229,5.332-.229,15.623s.043,11.582.229,15.623a27.793,27.793,0,0,0,1.76,9.2,19.374,19.374,0,0,0,11.083,11.083,27.813,27.813,0,0,0,9.2,1.76c4.042.184,5.332.229,15.623.229s11.582-.043,15.623-.229a27.8,27.8,0,0,0,9.2-1.76,19.374,19.374,0,0,0,11.083-11.083,27.716,27.716,0,0,0,1.76-9.2c.184-4.043.226-5.332.226-15.623s-.043-11.582-.226-15.623a27.786,27.786,0,0,0-1.76-9.2,19.379,19.379,0,0,0-11.08-11.083,27.748,27.748,0,0,0-9.2-1.76c-4.041-.185-5.332-.229-15.621-.229s-11.583.043-15.626.229" transform="translate(-422.637 -426.196)"></path>
      </svg>
    )
  },
  {
    id: 'YOUTUBE',
    name: 'YouTube',
    color: 'bg-red-600',
    hoverColor: 'hover:bg-red-700',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 93 93" fill="none" stroke="currentColor" className="h-6 w-6 !h-8 !w-8">
        <rect x="1.13867" y="1" width="91.5618" height="91.5618" rx="15" fill="#bc0404"></rect>
        <path fillRule="evenodd" clipRule="evenodd" d="M67.5615 29.2428C69.8115 29.8504 71.58 31.6234 72.1778 33.8708C73.2654 37.9495 73.2654 46.4647 73.2654 46.4647C73.2654 46.4647 73.2654 54.98 72.1778 59.0586C71.5717 61.3144 69.8032 63.0873 67.5615 63.6866C63.4932 64.7771 47.1703 64.7771 47.1703 64.7771C47.1703 64.7771 30.8557 64.7771 26.7791 63.6866C24.5291 63.079 22.7606 61.306 22.1628 59.0586C21.0752 54.98 21.0752 46.4647 21.0752 46.4647C21.0752 46.4647 21.0752 37.9495 22.1628 33.8708C22.7689 31.615 24.5374 29.8421 26.7791 29.2428C30.8557 28.1523 47.1703 28.1523 47.1703 28.1523C47.1703 28.1523 63.4932 28.1523 67.5615 29.2428ZM55.5142 46.4647L41.9561 54.314V38.6154L55.5142 46.4647Z" fill="white"></path>
      </svg>
    )
  }
];

export default function AccountsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState<SocialAccountRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [profiles, setProfiles] = useState<Record<string, TikTokProfile>>({});
  const [newUsernames, setNewUsernames] = useState<Record<string, string>>({ TIKTOK: '', INSTAGRAM: '', YOUTUBE: '' });
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadAccounts();
    }
  }, [user]);

  const loadAccounts = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const response = await fetch('/api/social-usernames', {
        headers: {
          'x-invitation-code': user.id
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load accounts');
      const rows: SocialAccountRow[] = data.rows || [];
      const filtered = rows.filter((r: SocialAccountRow) => ['TIKTOK','INSTAGRAM','YOUTUBE'].includes(r.platform));
      setAccounts(filtered);
      toast.success(`Loaded ${filtered.length} social accounts`);

    } catch (error) {
      console.warn('Error loading accounts:', error);
      toast.warning('Unable to load social accounts');
      setAccounts([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadCustomUsernames = async () => {
    if (!user) return;
    try {
      const response = await fetch('/api/social-usernames', {
        headers: { 'x-invitation-code': user.id }
      });
      const data = await response.json();
      if (response.ok) {
        const rows: SocialAccountRow[] = data.rows || [];
        setAccounts(rows.filter(r => ['TIKTOK','INSTAGRAM','YOUTUBE'].includes(r.platform)));
        rows.forEach(row => {
          if (row.platform === 'TIKTOK' && row.custom_username) {
            loadTikTokProfile(row.account_id, row.custom_username);
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
        // Éviter de surcharger le state si pas de données valides
        if (profileData && profileData.username) {
          setProfiles(prev => ({ ...prev, [accountId]: profileData }));
        }
      } else {
        console.warn(`TikTok profile API returned ${response.status} for ${username}`);
      }
    } catch (error) {
      console.warn(`Error loading profile for ${username}:`, error);
      // Ne pas traiter ça comme une erreur critique
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadAccounts();
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
          platform: accountId.split(':')[0],
          username: editUsername
        })
      });

      if (response.ok) {
        const data = await response.json();
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

  const deleteUsername = async (accountId: string) => {
    if (!user) return;
    try {
      const response = await fetch('/api/social-usernames', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, accountId })
      });
      if (response.ok) {
        setAccounts(prev => prev.filter(a => a.account_id !== accountId));
        toast.success('Account removed');
      }
    } catch (e) {
      toast.error('Failed to remove');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditUsername('');
  };

  const connectPlatform = (platformId: string, connectUrl: string) => {
    if (!user) {
      toast.error('Please sign in to connect accounts');
      return;
    }

    setConnectingPlatform(platformId);
    window.open(connectUrl, '_blank');
    toast.info(`Connect your ${platformId} account on PostFast, then come back and refresh.`);
    setTimeout(() => setConnectingPlatform(null), 2000);
  };

  const formatFollowers = (count?: number) => {
    if (!count) return '0';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const getAccountsByPlatform = (platform: string) => {
    return accounts.filter(account => account.platform === platform);
  };

  const getInitials = (name: string) => {
    if (!name || name === 'username not set') return '?';
    const cleanName = name.replace('@', '');
    return cleanName.slice(0, 2).toUpperCase();
  };

  const platformLabel = (platform: string) => {
    switch (platform.toUpperCase()) {
      case 'TIKTOK':
        return 'TikTok';
      case 'INSTAGRAM':
        return 'Instagram';
      case 'YOUTUBE':
        return 'YouTube';
      default:
        return platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase();
    }
  };

  const platformLogo = (platform: string) => {
    const p = platform.toUpperCase();
    if (p === 'TIKTOK') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 293768 333327" className="w-5 h-5"><path d="M204958 0c5369 45832 32829 78170 77253 81022v43471l-287 27V87593c-44424-2850-69965-30183-75333-76015l-47060-1v192819c6791 86790-60835 89368-86703 56462 30342 18977 79608 6642 73766-68039V0h58365zM78515 319644c-26591-5471-50770-21358-64969-44588-34496-56437-3401-148418 96651-157884v54345l-164 27v-40773C17274 145544 7961 245185 33650 286633c9906 15984 26169 27227 44864 33011z" fill="#26f4ee"/><path d="M218434 11587c3505 29920 15609 55386 35948 70259-27522-10602-43651-34934-47791-70262l11843 3zm63489 82463c3786 804 7734 1348 11844 1611v51530c-25770 2537-48321-5946-74600-21749l4034 88251c0 28460 106 41467-15166 67648-34260 58734-95927 63376-137628 35401 54529 22502 137077-4810 136916-103049v-96320c26279 15803 48830 24286 74600 21748V94050zm-171890 37247c5390-1122 11048-1985 16998-2548v54345c-21666 3569-35427 10222-41862 22528-20267 38754 5827 69491 35017 74111-33931 5638-73721-28750-49999-74111 6434-12304 18180-18959 39846-22528v-51797zm64479-119719h1808-1808z" fill="#fb2c53"/><path d="M206590 11578c5369 45832 30910 73164 75333 76015v51528c-25770 2539-48321-5945-74600-21748v96320c206 125717-135035 135283-173673 72939-25688-41449-16376-141089 76383-155862v52323c-21666 3569-33412 10224-39846 22528-39762 76035 98926 121273 89342-1225V11577l47060 1z"/></svg>
      );
    }
    if (p === 'INSTAGRAM') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 132.004 132" className="w-5 h-5"><defs><linearGradient id="b"><stop offset="0" stopColor="#3771c8"/><stop stopColor="#3771c8" offset=".128"/><stop offset="1" stopColor="#60f" stopOpacity="0"/></linearGradient><linearGradient id="a"><stop offset="0" stopColor="#fd5"/><stop offset=".1" stopColor="#fd5"/><stop offset=".5" stopColor="#ff543e"/><stop offset="1" stopColor="#c837ab"/></linearGradient><radialGradient id="c" cx="158.429" cy="578.088" r="65" gradientUnits="userSpaceOnUse" gradientTransform="matrix(0 -1.98198 1.8439 0 -1031.402 454.004)"/><radialGradient id="d" cx="147.694" cy="473.455" r="65" gradientUnits="userSpaceOnUse" gradientTransform="matrix(.17394 .86872 -3.5818 .71718 1648.348 -458.493)"/></defs><path fill="url(#c)" d="M65.03 0C37.888 0 29.95.028 28.407.156c-5.57.463-9.036 1.34-12.812 3.22-2.91 1.445-5.205 3.12-7.47 5.468C4 13.126 1.5 18.394.595 24.656c-.44 3.04-.568 3.66-.594 19.188-.01 5.176 0 11.988 0 21.125 0 27.12.03 35.05.16 36.59.45 5.42 1.3 8.83 3.1 12.56 3.44 7.14 10.01 12.5 17.75 14.5 2.68.69 5.64 1.07 9.44 1.25 1.61.07 18.02.12 34.44.12 16.42 0 32.84-.02 34.41-.1 4.4-.207 6.955-.55 9.78-1.28 7.79-2.01 14.24-7.29 17.75-14.53 1.765-3.64 2.66-7.18 3.065-12.317.088-1.12.125-18.977.125-36.81 0-17.836-.04-35.66-.128-36.78-.41-5.22-1.305-8.73-3.127-12.44-1.495-3.037-3.155-5.305-5.565-7.624C116.9 4 111.64 1.5 105.372.596 102.335.157 101.73.027 86.19 0H65.03z" transform="translate(1.004 1)"/><path fill="url(#d)" d="M66.004 18c-13.036 0-14.672.057-19.792.29-5.11.234-8.598 1.043-11.65 2.23-3.157 1.226-5.835 2.866-8.503 5.535-2.67 2.668-4.31 5.346-5.54 8.502-1.19 3.053-2 6.542-2.23 11.65C18.06 51.327 18 52.964 18 66s.058 14.667.29 19.787c.235 5.11 1.044 8.598 2.23 11.65 1.227 3.157 2.867 5.835 5.536 8.503 2.667 2.67 5.345 4.314 8.5 5.54 3.054 1.187 6.543 1.996 11.652 2.23 5.12.233 6.755.29 19.79.29 13.037 0 14.668-.057 19.788-.29 5.11-.234 8.602-1.043 11.656-2.23 3.156-1.226 5.83-2.87 8.497-5.54 2.67-2.668 4.31-5.346 5.54-8.502 1.18-3.053 1.99-6.542 2.23-11.65.23-5.12.29-6.752.29-19.788 0-13.036-.06-14.672-.29-19.792-.24-5.11-1.05-8.598-2.23-11.65-1.23-3.157-2.87-5.835-5.54-8.503-2.67-2.67-5.34-4.31-8.5-5.535-3.06-1.187-6.55-1.996-11.66-2.23-5.12-.233-6.75-.29-19.79-.29z"/><path fill="#fff" d="M66.003 41.35c-13.613 0-24.65 11.037-24.65 24.65 0 13.613 11.037 24.645 24.65 24.645C79.617 90.645 90.65 79.613 90.65 66S79.616 41.35 66.003 41.35zm0 8.65c8.836 0 16 7.163 16 16 0 8.836-7.164 16-16 16-8.837 0-16-7.164-16-16 0-8.837 7.163-16 16-16z"/></svg>
      );
    }
    if (p === 'YOUTUBE') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 333333 333333" className="w-5 h-5"><path d="M329930 100020s-3254-22976-13269-33065c-12691-13269-26901-13354-33397-14124-46609-3396-116614-3396-116614-3396h-122s-69973 0-116608 3396c-6522 793-20712 848-33397 14124C6501 77044 3316 100020 3316 100020S-1 126982-1 154001v25265c0 26962 3315 53979 3315 53979s3254 22976 13207 33082c12685 13269 29356 12838 36798 14254 26685 2547 113354 3315 113354 3315s70065-124 116675-3457c6522-770 20706-848 33397-14124 10021-10089 13269-33090 13269-33090s3319-26962 3319-53979v-25263c-67-26962-3384-53979-3384-53979l-18 18-2-2zM132123 209917v-93681l90046 46997-90046 46684z" fill="red"/></svg>
      );
    }
    return null;
  };

  const renderAccountCard = (account: SocialAccountRow) => {
    const getPlatformIcon = (platform: string) => {
      const platformLower = platform.toLowerCase();
      switch (platformLower) {
        case 'tiktok':
          return (
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
            </svg>
          );
        case 'instagram':
          return (
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z"/>
            </svg>
          );
        case 'twitter':
        case 'x':
          return (
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          );
        case 'facebook':
          return (
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          );
        case 'youtube':
          return (
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          );
        case 'linkedin':
          return (
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          );
        default:
          return (
            <span className="text-white text-lg font-bold">
              {platform.slice(0, 2).toUpperCase()}
            </span>
          );
      }
    };

    const getPlatformColor = (platform: string) => {
      const platformLower = platform.toLowerCase();
      switch (platformLower) {
        case 'tiktok':
          return 'bg-gradient-to-br from-gray-800 to-black';
        case 'instagram':
          return 'bg-gradient-to-br from-purple-500 to-pink-500';
        case 'twitter':
        case 'x':
          return 'bg-black';
        case 'facebook':
          return 'bg-blue-600';
        case 'youtube':
          return 'bg-red-600';
        case 'linkedin':
          return 'bg-blue-700';
        default:
          return 'bg-gray-600';
      }
    };

    return (
      <div key={account.id} className="relative">
        <div className="bg-white rounded-2xl p-6 hover:shadow-md transition-shadow border border-gray-100 text-center">
          {/* Avatar */}
          <div className="relative mx-auto mb-4 w-16 h-16">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-sm ${getPlatformColor(account.platform)}`}>
              {account.custom_username ? (
                <span className="text-white text-lg font-bold">
                  {getInitials(account.custom_username)}
                </span>
              ) : (
                getPlatformIcon(account.platform)
              )}
            </div>
          </div>

          {/* Username */}
          <div className="text-center mb-3">
            <div className="relative flex items-center justify-center">
              <h3 className="font-semibold text-gray-900 text-lg truncate">
                {account.custom_username ? `@${account.custom_username}` : 'username not set'}
              </h3>
            </div>

            {/* Platform badge */}
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="w-5 h-5 flex items-center justify-center">
                {platformLogo(account.platform)}
              </div>
              <span className="text-base font-medium text-gray-700">
                {platformLabel(account.platform)}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mt-3">
            {editingId === account.account_id ? (
              <>
                <input
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                  placeholder="Enter username"
                />
                <button onClick={() => saveUsername(account.account_id)} className="px-2 py-1 bg-green-600 text-white rounded">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={cancelEdit} className="px-2 py-1 bg-gray-200 rounded">
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => startEditUsername(account.account_id, account.custom_username)} className="px-2 py-1 bg-blue-600 text-white rounded flex items-center gap-1 text-sm">
                  <Edit2 className="w-4 h-4" /> Edit
                </button>
                <button onClick={() => deleteUsername(account.account_id)} className="px-2 py-1 bg-red-600 text-white rounded flex items-center gap-1 text-sm">
                  <Trash2 className="w-4 h-4" /> Remove
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAddAccountCard = (platform: 'TIKTOK'|'INSTAGRAM'|'YOUTUBE') => (
    <div className="bg-white rounded-2xl p-6 border-2 border-dashed border-blue-300 hover:border-blue-400 transition-colors">
      <h3 className="font-semibold text-gray-900 text-lg mb-2">Add {platformLabel(platform)} account</h3>
      <div className="flex items-center gap-2">
        <span className="text-gray-500">@</span>
        <input
          value={newUsernames[platform] || ''}
          onChange={(e) => setNewUsernames(prev => ({ ...prev, [platform]: e.target.value }))}
          placeholder="username"
          className="border rounded px-3 py-2 flex-1"
        />
        <button
          onClick={async () => {
            if (!user) return;
            const username = (newUsernames[platform] || '').trim().replace(/^@/, '');
            if (!username) return;
            const accountId = `${platform}:${username}`;
            const resp = await fetch('/api/social-usernames', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: user.id, accountId, platform, username })
            });
            if (resp.ok) {
              setNewUsernames(prev => ({ ...prev, [platform]: '' }));
              loadAccounts();
              toast.success('Account added');
            } else {
              toast.error('Failed to add');
            }
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Add
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f3f4f0' }}>
      <div className="p-6 xl:p-8">
        <div className="pt-8 xl:pt-8 max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Accounts</h1>
              <p className="text-gray-600 mt-2">
                {accounts.length} Connected
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 text-gray-600 px-4 py-2.5 rounded-full hover:bg-gray-100 transition-all font-medium disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {/* Accounts Grid */}
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-500 mx-auto"></div>
              <p className="text-gray-500 mt-4">Loading accounts...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                {(['TIKTOK','INSTAGRAM','YOUTUBE'] as const).map(p => (
                  <div key={p}>{renderAddAccountCard(p)}</div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {accounts.map(renderAccountCard)}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}