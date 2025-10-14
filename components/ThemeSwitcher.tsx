"use client";

import React, { useEffect } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { Moon, Sun } from 'lucide-react';

export function ThemeSwitcher() {
  const { theme, toggleTheme, setTheme } = useThemeStore();

  // Force le thème sombre au démarrage
  useEffect(() => {
    if (theme !== 'dark') {
      setTheme('dark');
    }
  }, []);

  // Appliquer le thème au niveau du document HTML
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.add('dark');
    
    // Si jamais on décide de réactiver le thème clair dans le futur
    if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
  }, [theme]);

  return (
    <div className="fixed bottom-60 left-2.5 z-50">
      <button
        onClick={toggleTheme}
        className="flex items-center justify-center w-12 h-12 rounded-full bg-white dark:bg-[#18181a] shadow-lg border border-gray-200 dark:border-[#0e0f15] transition-all duration-300"
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? (
          <Sun className="w-5 h-5 text-white" />
        ) : (
          <Moon className="w-5 h-5 text-gray-700" />
        )}
      </button>
    </div>
  );
} 