"use client";

import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/auth';

export const SupabaseSync = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      // Synchroniser les données utilisateur dans Supabase si nécessaire
      const syncUserData = async () => {
        await supabase
          .from('users')
          .update({
            last_login: new Date().toISOString(),
          })
          .eq('user_id', user.id);
      };

      syncUserData();
    }
  }, [user]);

  return null;
}; 