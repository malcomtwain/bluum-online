"use client";

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Play,
  Images,
  Video,
  Presentation,
  Music,
  Users,
  Instagram,
  Calendar,
  Key,
  LogOut,
  Settings,
  User,
  FolderOpen,
  Sparkles,
  FileText,
  Plus
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const sidebarItems = [
  {
    id: 'statistics',
    label: 'Statistics',
    icon: FileText,
    path: '/statistics',
    section: 'statistics',
  },
  {
  },
  {
    id: 'create-videos',
    label: 'Create Videos',
    icon: Play,
    path: '/create',
    section: 'creation',
  },
  {
    id: 'create-slideshow',
    label: 'Create Slideshow',
    icon: Presentation,
    path: '/slideshow',
    section: 'creation',
  },
  {
    id: 'generated-videos',
    label: 'Generated Videos',
    icon: Video,
    path: '/generated-videos',
    section: 'generated',
  },
  {
    id: 'generated-slideshows',
    label: 'Generated Slideshows',
    icon: Presentation,
    path: '/generated-slideshows',
    section: 'generated',
  },
  {
    id: 'videos',
    label: 'Videos Collections',
    icon: Video,
    path: '/videos',
    section: 'medias',
  },
  {
    id: 'images', 
    label: 'Images Collections',
    icon: Images,
    path: '/images',
    section: 'medias',
  },
  {
    id: 'music',
    label: 'Music Library',
    icon: Music,
    path: '/music',
    section: 'medias',
  },
  {
    id: 'accounts',
    label: 'Social Accounts',
    icon: Users,
    path: '/accounts',
    section: 'statistics',
  },
];

export default function MainSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <div 
      className="w-64 h-screen flex flex-col border-r"
      style={{ backgroundColor: '#EEEFE8', borderColor: '#dedfd7' }}
    >
      {/* Header */}
      <div className="p-6 border-b border-[#d0d0ce]">
        <div className="flex items-center gap-3">
          <img 
            src="/BluumLogo.png" 
            alt="Bluum Logo" 
            className="w-8 h-8 object-contain"
          />
          <span 
            className="text-lg font-bold"
            style={{ color: '#1e1e1e' }}
          >
            Bluum
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <div className="space-y-4">
          {/* Statistics Section */}
          <div>
            <h3 className="text-xs font-semibold mb-2 px-3" style={{ color: '#777777' }}>
              Statistics
            </h3>
            <div className="space-y-1">
              {sidebarItems.filter(item => item.section === 'statistics').map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item.path)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all border text-sm ${
                      isActive
                        ? 'text-[#1e1e1e]'
                        : 'hover:bg-white/50 border-transparent'
                    }`}
                    style={{
                      backgroundColor: isActive ? '#ffffff' : 'transparent',
                      borderColor: isActive ? '#dadbd2' : 'transparent',
                      color: isActive ? '#1e1e1e' : '#1e1e1e',
                    }}
                  >
                    <Icon size={16} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Create Section */}
          <div>
            <h3 className="text-xs font-semibold mb-2 px-3" style={{ color: '#777777' }}>
              Create
            </h3>
            <div className="space-y-1">
              {sidebarItems.filter(item => item.section === 'creation').map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path || 
                  (item.path === '/create' && pathname.startsWith('/create'));
                
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item.path)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all border text-sm ${
                      isActive
                        ? 'text-[#1e1e1e]'
                        : 'hover:bg-white/50 border-transparent'
                    }`}
                    style={{
                      backgroundColor: isActive ? '#ffffff' : 'transparent',
                      borderColor: isActive ? '#dadbd2' : 'transparent',
                      color: isActive ? '#1e1e1e' : '#1e1e1e',
                    }}
                  >
                    <Icon size={16} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generated Section */}
          <div>
            <h3 className="text-xs font-semibold mb-2 px-3" style={{ color: '#777777' }}>
              Generated
            </h3>
            <div className="space-y-1">
              {sidebarItems.filter(item => item.section === 'generated').map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item.path)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all border text-sm ${
                      isActive
                        ? 'text-[#1e1e1e]'
                        : 'hover:bg-white/50 border-transparent'
                    }`}
                    style={{
                      backgroundColor: isActive ? '#ffffff' : 'transparent',
                      borderColor: isActive ? '#dadbd2' : 'transparent',
                      color: isActive ? '#1e1e1e' : '#1e1e1e',
                    }}
                  >
                    <Icon size={16} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Medias Section */}
          <div>
            <h3 className="text-xs font-semibold mb-2 px-3" style={{ color: '#777777' }}>
              Medias
            </h3>
            <div className="space-y-1">
              {sidebarItems.filter(item => item.section === 'medias').map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item.path)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all border text-sm ${
                      isActive
                        ? 'text-[#1e1e1e]'
                        : 'hover:bg-white/50 border-transparent'
                    }`}
                    style={{
                      backgroundColor: isActive ? '#ffffff' : 'transparent',
                      borderColor: isActive ? '#dadbd2' : 'transparent',
                      color: isActive ? '#1e1e1e' : '#1e1e1e',
                    }}
                  >
                    <Icon size={16} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accounts Section removed; Social Accounts moved under Statistics */}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[#d0d0ce]">
        {/* Settings Button */}
        <button
          onClick={() => handleNavigation('/settings')}
          className="w-full flex items-center gap-2 px-3 py-2 mb-3 rounded-xl text-left transition-all border text-sm hover:bg-white/50"
          style={{
            backgroundColor: pathname === '/settings' ? '#ffffff' : 'transparent',
            borderColor: pathname === '/settings' ? '#dadbd2' : 'transparent',
            color: '#1e1e1e',
          }}
        >
          <Settings size={16} />
          <span className="font-medium">Settings</span>
        </button>
        
        {/* User Info */}
        <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-xl bg-white/50">
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
            <User size={16} className="text-gray-600" />
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="text-sm font-medium text-[#1e1e1e] truncate">
              {user?.name || user?.email?.split('@')[0] || 'User'}
            </div>
            <div className="text-xs text-[#777777] truncate">
              {user?.email}
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all text-sm font-medium"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}