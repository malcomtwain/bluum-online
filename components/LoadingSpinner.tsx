"use client";

import { useEffect, useState } from "react";

export function LoadingSpinner() {
  const [mounted, setMounted] = useState(false);

  // Pour éviter les problèmes d'hydratation, on n'affiche l'animation qu'après le montage côté client
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Version simplifiée pour le premier rendu côté serveur - toujours en thème sombre
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0c] z-50">
        <div className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-[#0a0a0c]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-20 h-20 relative">
          {/* Le cercle extérieur avec gradient */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#f8d4eb] via-[#ce7acb] to-[#e9bcba] animate-spin"></div>
          
          {/* Le cercle intérieur pour créer l'effet d'anneau */}
          <div className="absolute inset-1 rounded-full bg-[#0a0a0c]"></div>
        </div>
        
        {/* Texte Bluum avec gradient */}
        <span 
          className="text-xl font-bold"
          style={{
            background: 'linear-gradient(90deg, #f8d4eb, #ce7acb, #e9bcba)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          BLUUM
        </span>
      </div>
    </div>
  );
} 