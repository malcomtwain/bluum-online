"use client";

import * as React from "react";
import { VideoIcon, MusicIcon, PlusIcon, CreditCardIcon, SparklesIcon, LogOut, User, Settings, Calendar, FileText } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useUserPlanStore } from "@/store/userPlanStore";
import { useAuth } from "../contexts/AuthContext";
import Image from "next/image";

// Fonction pour formatter les nombres avec des virgules comme séparateurs de milliers
const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export const Sidebar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mounted, setMounted] = React.useState(false);
  const email = user?.email || '';
  
  // Utilisez le store pour les informations du plan
  const { videoCredits, setPlan } = useUserPlanStore();

  React.useEffect(() => {
    setMounted(true);
    
    // Mettre à jour le plan quand l'email change
    setPlan(email);
  }, [email, setPlan]);

  if (!mounted) {
    return null;
  }

  return (
    <aside className="w-[70px] xl:w-[260px] bg-[#fafafa] dark:bg-[#0a0a0c] border-r border-[#27272A] flex flex-col font-[-apple-system,BlinkMacSystemFont] transition-all duration-300 z-30 h-full">
      <div className="p-3 xl:p-5 flex flex-col items-center h-full">
        <div className="w-full flex justify-start pt-4 mb-10 xl:pt-4 xl:mb-12">
          <div className="hidden xl:block xl:pl-2">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img
                src="/BluumLogo.png"
                alt="Bluum Logo"
                width={40}
                height={40}
                className="object-contain dark:hidden"
              />
              <img
                src="/BluumLogoDarkTheme.png"
                alt="Bluum Logo Dark"
                width={40}
                height={40}
                className="object-contain hidden dark:block"
              />
              <span 
                id="bluum-logo-title"
                className="text-xl font-medium !text-[#fafafa] [background-image:none]"
              >
              </span>
            </Link>
          </div>
          <div className="xl:hidden flex justify-center w-full">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <img
                src="/BluumLogo.png"
                alt="Bluum Logo"
                width={40}
                height={40}
                className="object-contain dark:hidden"
              />
              <img
                src="/BluumLogoDarkTheme.png"
                alt="Bluum Logo Dark"
                width={40}
                height={40}
                className="object-contain hidden dark:block"
              />
            </Link>
          </div>
        </div>
        
        <nav className="space-y-6 w-full flex-1">
          <div>
            <Button 
              variant="ghost"
              onClick={() => router.push("/create")}
              className={`w-full flex items-center justify-center text-lg font-semibold group transition-all duration-300 rounded-xl relative overflow-hidden text-[#fafafa] hover:text-[#fafafa] dark:text-[#0a0a0c] dark:hover:text-[#0a0a0c] ${
                pathname === "/create" 
                  ? "hover:opacity-90" 
                  : "hover:opacity-90"
              } h-10 bg-[#5564ff] hover:bg-[#5564ff]/90 dark:bg-[#fafafa] dark:hover:bg-[#fafafa]/90 z-10 pointer-events-auto`}
            >
              <div className="flex items-center gap-3 relative z-10">
                <PlusIcon className="h-5 w-5 scale-125 flex-shrink-0" />
                <span className="hidden xl:inline">Create</span>
              </div>
            </Button>
          </div>
          <div className="space-y-1.5">
            <Button 
              variant="ghost" 
              onClick={() => router.push("/videos")}
              className={`w-full text-base rounded-xl ${
                pathname === "/videos" 
                  ? "bg-[#fafafa] dark:bg-[#18191C] text-black dark:text-[#fafafa] hover:bg-[#fafafa] dark:hover:bg-[#18191C] hover:text-black dark:hover:text-[#fafafa] border-2 border-[#DADBD2] dark:border-[#27272A]" 
                  : "text-black dark:text-[#fafafa] hover:text-black dark:hover:text-[#fafafa] hover:bg-[#F5F5F5] dark:hover:bg-[#18191C] border-2 border-transparent dark:hover:border-[#27272A]"
              } h-10 flex items-center justify-center xl:justify-start z-10 pointer-events-auto`}
            >
              <div className="flex items-center gap-3 pointer-events-auto">
                <VideoIcon className="h-5 w-5 scale-125 flex-shrink-0" />
                <span className={`hidden xl:inline ${pathname === "/videos" ? "font-medium" : ""}`}>
                  My Clips
                </span>
              </div>
            </Button>
            
            {/* Onglet Music Library accessible à tous */}
            <Button 
              variant="ghost" 
              onClick={() => router.push("/music")}
              className={`w-full text-base rounded-xl ${
                pathname === "/music" 
                  ? "bg-[#fafafa] dark:bg-[#18191C] text-black dark:text-[#fafafa] hover:bg-[#fafafa] dark:hover:bg-[#18191C] hover:text-black dark:hover:text-[#fafafa] border-2 border-[#DADBD2] dark:border-[#27272A]" 
                  : "text-black dark:text-[#fafafa] hover:text-black dark:hover:text-[#fafafa] hover:bg-[#F5F5F5] dark:hover:bg-[#18191C] border-2 border-transparent dark:hover:border-[#27272A]"
              } h-10 flex items-center justify-center xl:justify-start z-10 pointer-events-auto`}
            >
              <div className="flex items-center gap-3 pointer-events-auto">
                <MusicIcon className="h-5 w-5 scale-125 flex-shrink-0" />
                <span className={`hidden xl:inline ${pathname === "/music" ? "font-medium" : ""}`}>
                  Music Library
                </span>
              </div>
            </Button>

            {/* Videos Collections */}
            <Button
              variant="ghost"
              onClick={() => router.push("/videos-library")}
              className={`w-full text-base rounded-xl ${
                pathname === "/videos-library"
                  ? "bg-[#fafafa] dark:bg-[#18191C] text-black dark:text-[#fafafa] hover:bg-[#fafafa] dark:hover:bg-[#18191C] hover:text-black dark:hover:text-[#fafafa] border-2 border-[#DADBD2] dark:border-[#27272A]"
                  : "text-black dark:text-[#fafafa] hover:text-black dark:hover:text-[#fafafa] hover:bg-[#F5F5F5] dark:hover:bg-[#18191C] border-2 border-transparent dark:hover:border-[#27272A]"
              } h-10 flex items-center justify-center xl:justify-start z-10 pointer-events-auto`}
            >
              <div className="flex items-center gap-3 pointer-events-auto">
                <VideoIcon className="h-5 w-5 scale-125 flex-shrink-0" />
                <span className={`hidden xl:inline ${pathname === "/videos-library" ? "font-medium" : ""}`}>
                  Videos Collections
                </span>
              </div>
            </Button>

            {/* Images Collections */}
            <Button
              variant="ghost"
              onClick={() => router.push("/images")}
              className={`w-full text-base rounded-xl ${
                pathname === "/images"
                  ? "bg-[#fafafa] dark:bg-[#18191C] text-black dark:text-[#fafafa] hover:bg-[#fafafa] dark:hover:bg-[#18191C] hover:text-black dark:hover:text-[#fafafa] border-2 border-[#DADBD2] dark:border-[#27272A]"
                  : "text-black dark:text-[#fafafa] hover:text-black dark:hover:text-[#fafafa] hover:bg-[#F5F5F5] dark:hover:bg-[#18191C] border-2 border-transparent dark:hover:border-[#27272A]"
              } h-10 flex items-center justify-center xl:justify-start z-10 pointer-events-auto`}
            >
              <div className="flex items-center gap-3 pointer-events-auto">
                <svg className="h-5 w-5 scale-125 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className={`hidden xl:inline ${pathname === "/images" ? "font-medium" : ""}`}>
                  Images Collections
                </span>
              </div>
            </Button>

            {/* Onglet Calendar */}
            <Button
              variant="ghost"
              onClick={() => router.push("/calendar")}
              className={`w-full text-base rounded-xl ${
                pathname === "/calendar"
                  ? "bg-[#fafafa] dark:bg-[#18191C] text-black dark:text-[#fafafa] hover:bg-[#fafafa] dark:hover:bg-[#18191C] hover:text-black dark:hover:text-[#fafafa] border-2 border-[#DADBD2] dark:border-[#27272A]"
                  : "text-black dark:text-[#fafafa] hover:text-black dark:hover:text-[#fafafa] hover:bg-[#F5F5F5] dark:hover:bg-[#18191C] border-2 border-transparent dark:hover:border-[#27272A]"
              } h-10 flex items-center justify-center xl:justify-start z-10 pointer-events-auto`}
            >
              <div className="flex items-center gap-3 pointer-events-auto">
                <Calendar className="h-5 w-5 scale-125 flex-shrink-0" />
                <span className={`hidden xl:inline ${pathname === "/calendar" ? "font-medium" : ""}`}>
                  Calendar
                </span>
              </div>
            </Button>

            {/* Onglet Posts */}
            <Button
              variant="ghost"
              onClick={() => router.push("/posts")}
              className={`w-full text-base rounded-xl ${
                pathname === "/posts"
                  ? "bg-[#fafafa] dark:bg-[#18191C] text-black dark:text-[#fafafa] hover:bg-[#fafafa] dark:hover:bg-[#18191C] hover:text-black dark:hover:text-[#fafafa] border-2 border-[#DADBD2] dark:border-[#27272A]"
                  : "text-black dark:text-[#fafafa] hover:text-black dark:hover:text-[#fafafa] hover:bg-[#F5F5F5] dark:hover:bg-[#18191C] border-2 border-transparent dark:hover:border-[#27272A]"
              } h-10 flex items-center justify-center xl:justify-start z-10 pointer-events-auto`}
            >
              <div className="flex items-center gap-3 pointer-events-auto">
                <FileText className="h-5 w-5 scale-125 flex-shrink-0" />
                <span className={`hidden xl:inline ${pathname === "/posts" ? "font-medium" : ""}`}>
                  Posts
                </span>
              </div>
            </Button>
          </div>
        </nav>

        {/* Bottom section */}
        <div className="w-full mt-auto">
          {/* Pricing button */}
          <div className="mb-4">
            <Button 
              variant="ghost"
              onClick={() => router.push("/pricing")}
              className="w-full flex items-center justify-center text-base font-medium group transition-all duration-300 rounded-xl relative overflow-hidden text-[#0a0a0c] h-10 bg-gradient-to-r from-[#f8d4eb] via-[#ce7acb] to-[#e9bcba] hover:opacity-90 z-10 pointer-events-auto shadow-lg"
            >
              <div className="flex items-center gap-3 relative z-10">
                <SparklesIcon className="h-5 w-5 flex-shrink-0" />
                <span className="hidden xl:inline">Pricing</span>
              </div>
            </Button>
          </div>
          
          {/* User section at the very bottom */}
          {user && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 pb-4 space-y-2">
              {/* Settings button */}
              <Button 
                variant="ghost"
                onClick={() => router.push("/settings")}
                className={`w-full flex items-center justify-center xl:justify-start px-3 py-2 text-sm font-medium transition-all duration-200 rounded-lg text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  pathname === "/settings" ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-200" : ""
                }`}
              >
                <Settings className="h-4 w-4 flex-shrink-0" />
                <span className="hidden xl:inline ml-3">Settings</span>
              </Button>
              
              {/* User email and logout */}
              <div className="px-3">
                <div className="flex items-center gap-2 py-2">
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="hidden xl:flex flex-col flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {user.name || user.email?.split('@')[0] || 'User'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {user.email}
                    </span>
                  </div>
                  <button
                    onClick={logout}
                    className="hidden xl:block ml-auto p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}; 