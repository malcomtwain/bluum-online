"use client";

import { useEffect } from "react";
import { initUserVideosCleanup } from "@/store/userVideosStore";

export function VideoCleanup() {
  useEffect(() => {
    // Initialiser le nettoyage des vidéos et récupérer la fonction de nettoyage
    const cleanup = initUserVideosCleanup();
    
    // Nettoyer l'intervalle lorsque le composant est démonté
    return () => cleanup();
  }, []);
  
  // Ce composant ne rend rien, il gère seulement le nettoyage des vidéos
  return null;
} 