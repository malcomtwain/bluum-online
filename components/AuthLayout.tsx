"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePathname } from 'next/navigation';
import MainSidebar from './MainSidebar';
import ContentLoading from './ContentLoading';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  
  // Check if we're on an auth page
  const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password' || pathname === '/reset-password';
  
  // If we're on an auth page, just render the children without any auth checks
  if (isAuthPage) {
    return <>{children}</>;
  }
  
  // Gérer le loading lors des changements de page
  useEffect(() => {
    if (pathname !== prevPathname) {
      setPrevPathname(pathname);
      setIsPageLoading(false);
    }
  }, [pathname, prevPathname]);

  // Si l'authentification est en cours de chargement, afficher un loader
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black dark:border-white"></div>
      </div>
    );
  }

  // Si l'utilisateur n'est pas connecté, rediriger vers /login
  if (!user) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black dark:border-white"></div>
      </div>
    );
  }

  // Si l'utilisateur est connecté, afficher le layout normal avec le sidebar
  return (
    <div className="flex h-screen overflow-hidden w-full">
      <MainSidebar />
      <main className="flex-1 overflow-y-auto relative w-full" style={{ backgroundColor: '#f3f4f0' }}>
        {isPageLoading && <ContentLoading />}
        {children}
      </main>
    </div>
  );
}