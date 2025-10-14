"use client";

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { User, Mail, Key, Shield, Bell, CreditCard, LogOut } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Password updated successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      toast.error('Failed to update password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f3f4f0' }}>
      <div className="p-4 xl:p-6 max-w-4xl mx-auto w-full">
        <div className="pt-4 xl:pt-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-gray-900 mb-2">Settings</h1>
            <p className="text-gray-600">Manage your account settings and preferences</p>
          </div>

          {/* Account Information */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Information
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Email</label>
                <div className="flex items-center gap-2 mt-1">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <p className="text-gray-900">{user?.email}</p>
                </div>
              </div>
              
              <div>
                <label className="text-sm text-gray-500">User ID</label>
                <p className="text-gray-900 font-mono text-sm mt-1">{user?.id}</p>
              </div>
              
              <div>
                <label className="text-sm text-gray-500">Account Created</label>
                <p className="text-gray-900 mt-1">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Change Password */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Key className="h-5 w-5" />
              Change Password
            </h2>
            
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5564ff] focus:border-[#5564ff]"
                  placeholder="Enter current password"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5564ff] focus:border-[#5564ff]"
                  placeholder="Enter new password"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5564ff] focus:border-[#5564ff]"
                  placeholder="Confirm new password"
                />
              </div>
              
              <button
                type="submit"
                disabled={isChangingPassword}
                className="px-4 py-2 bg-[#5564ff] text-white rounded-lg hover:bg-[#4654e6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isChangingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>

          {/* Preferences */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Preferences
            </h2>
            
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-gray-700">Email notifications</span>
                <input
                  type="checkbox"
                  className="w-4 h-4 text-[#5564ff] border-gray-300 rounded focus:ring-[#5564ff]"
                  defaultChecked
                />
              </label>
              
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-gray-700">Marketing emails</span>
                <input
                  type="checkbox"
                  className="w-4 h-4 text-[#5564ff] border-gray-300 rounded focus:ring-[#5564ff]"
                />
              </label>
            </div>
          </div>

          {/* Subscription */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription
            </h2>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Current Plan</span>
                <span className="px-3 py-1 bg-[#5564ff]/10 text-[#5564ff] rounded-full text-sm font-medium">
                  Free
                </span>
              </div>
              
              <button className="w-full px-4 py-2 bg-gradient-to-r from-[#f8d4eb] via-[#ce7acb] to-[#e9bcba] text-gray-900 font-medium rounded-lg hover:opacity-90 transition-opacity">
                Upgrade to Pro
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-red-200">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-red-600">
              <Shield className="h-5 w-5" />
              Danger Zone
            </h2>
            
            <div className="space-y-3">
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
              
              <p className="text-sm text-gray-500">
                Once you sign out, you'll need to sign in again to access your account.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}