"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, getCurrentUser, onAuthStateChanged, initAuth, signOut } from '../lib/supabase-auth';

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  logout: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleLogout = async () => {
    await signOut();
    setUser(null);
    // Redirect to login page
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  useEffect(() => {
    let mounted = true;

    // Initialize auth and get current user
    (async () => {
      try {
        const currentUser = await initAuth();
        if (mounted) {
          setUser(currentUser);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    // Subscribe to auth state changes
    const unsubscribe = onAuthStateChanged((newUser) => {
      if (mounted) {
        setUser(newUser);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, logout: handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
} 