"use client";

import { useRouter } from "next/navigation";

export function UpgradeButton() {
  const router = useRouter();

  return (
    <button 
      onClick={() => router.push('/pricing')}
      className="fixed bottom-16 left-8 bg-gradient-to-r from-[#f8d4eb] via-[#ce7acb] to-[#e9bcba] text-[#0a0a0c] font-medium px-4 py-3 rounded-xl text-sm flex items-center gap-2 shadow-lg z-40"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path>
      </svg>
      Upgrade
    </button>
  );
} 