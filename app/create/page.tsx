"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDropzone } from "react-dropzone";
import { ChevronLeft, ChevronRight, Play as PlayIcon, Pause as PauseIcon, Music as MusicIcon, LucideProps } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext"; // Remplacer Clerk par notre AuthContext
import { getUserSongs, type UserSong, supabase } from "@/lib/supabase";
import { useVideoStore } from "@/store/videoStore";
import type { LucideIcon } from "lucide-react";
import { drawHookText } from "@/lib/utils";
import { useSupabase } from "@/hooks/useSupabase";
import { getFileUrl, initializeStorage, getFileUrlWithFallback, uploadToSupabase } from "@/lib/supabase";
import Image from "next/legacy/image";
import { toast } from "react-toastify";
import { ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import { useUserVideosStore } from "@/store/userVideosStore";
import { downloadVideosAsZip } from "@/utils/zipDownloader";
import { useRouter } from "next/navigation";

type MediaFile = {
  id: string;
  type: "image" | "video";
  url: string;
  duration: number;
  size?: number;
};

function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

function getTotalVersusVideos(parts: {
  arrivesStadium: File[];
  training: File[];
  entry: File[];
  lineup: File[];
  faceCam: File[];
  skills: File[];
  goals: File[];
  celebrations: File[];
}): number {
  return (
    parts.arrivesStadium.length +
    parts.training.length +
    parts.entry.length +
    parts.lineup.length +
    parts.faceCam.length +
    parts.skills.length +
    parts.goals.length +
    parts.celebrations.length
  );
}

// Fonction pour générer toutes les permutations possibles des parties
function generatePermutations(parts: File[][]): File[][][] {
  if (parts.length <= 1) return [parts];
  
  const result: File[][][] = [];
  const used = new Array(parts.length).fill(false);
  
  const backtrack = (current: File[][]) => {
    if (current.length === parts.length) {
      result.push([...current]);
      return;
    }
    
    for (let i = 0; i < parts.length; i++) {
      if (!used[i]) {
        used[i] = true;
        current.push(parts[i]);
        backtrack(current);
        current.pop();
        used[i] = false;
      }
    }
  };
  
  backtrack([]);
  return result;
}

function getSlideshowCombinationCount(
  images: File[],
  hooksPerImage: {[key: number]: string},
  imageCount: number,
  uploadMode: 'ordered' | 'random'
): number {
  if (images.length === 0) return 0;
  
  // Compter les hooks uniques par image
  const hooksCount = Object.keys(hooksPerImage).reduce((total, key) => {
    const hooks = hooksPerImage[parseInt(key)];
    if (hooks && hooks.trim()) {
      const hookLines = hooks.split('\n').filter(line => line.trim() !== '');
      return total * Math.max(1, hookLines.length);
    }
    return total;
  }, 1);
  
  if (uploadMode === 'ordered') {
    // Mode ordonné : on a exactement les images uploadées dans l'ordre
    return Math.max(1, hooksCount);
  } else {
    // Mode aléatoire : on peut faire des permutations des images
    const availableImages = Math.min(images.length, imageCount);
    if (availableImages === 0) return 0;
    
    // Permutations possibles des images * combinaisons de hooks
    let permutations = 1;
    for (let i = 0; i < imageCount && i < availableImages; i++) {
      permutations *= (availableImages - i);
    }
    
    return permutations * Math.max(1, hooksCount);
  }
}

function getVersusCombinationCount(parts: {
  arrivesStadium: File[];
  training: File[];
  entry: File[];
  lineup: File[];
  faceCam: File[];
  skills: File[];
  goals: File[];
  celebrations: File[];
}, enabled?: {
  arrivesStadium: boolean;
  training: boolean;
  entry: boolean;
  lineup: boolean;
  faceCam: boolean;
  skills: boolean;
  goals: boolean;
  celebrations: boolean;
}): number {
  const isEnabled = (key: keyof typeof parts) => enabled ? (enabled as any)[key] && (parts as any)[key].length > 0 : (parts as any)[key].length > 0;

  // Fonction factorielle pour calculer les permutations
  function fact(n: number): number {
    if (n <= 1) return 1;
    return n * fact(n - 1);
  }
  
  // Chaque partie peut permuter en interne
  const arrivesCount = isEnabled('arrivesStadium') ? fact(parts.arrivesStadium.length) : 1;
  const trainingCount = isEnabled('training') ? fact(parts.training.length) : 1;
  const entryCount = isEnabled('entry') ? fact(parts.entry.length) : 1;
  const lineupCount = isEnabled('lineup') ? fact(parts.lineup.length) : 1;
  const faceCamCount = isEnabled('faceCam') ? fact(parts.faceCam.length) : 1;
  const celebrationsCount = isEnabled('celebrations') ? fact(parts.celebrations.length) : 1;
  
  // Pour skills et goals, mélange libre avec un goal qui doit finir avant celebration
  let skillsGoalsCount;
  const s = isEnabled('skills') ? parts.skills.length : 0;
  const g = isEnabled('goals') ? parts.goals.length : 0;
  
  if (g === 0 && s === 0) {
    // Pas de skills ni de goals, on ne compte pas cette partie
    skillsGoalsCount = 1;
  } else if (g === 0) {
    // Seulement des skills, ils peuvent se permuter librement
    skillsGoalsCount = fact(s);
  } else if (s === 0) {
    // Seulement des goals, ils peuvent se permuter librement
    skillsGoalsCount = fact(g);
  } else {
    // Les deux : chaque goal peut être le dernier, et les autres se mélangent avec les skills
    // Pour chaque choix de goal final : g possibilités
    // Pour les éléments restants : (s + g - 1)! permutations
    skillsGoalsCount = g * fact(s + g - 1);
  }
  
  // Vérifier qu'au moins une partie est active avec des vidéos
  const hasAnyVideos = isEnabled('arrivesStadium') || isEnabled('training') || isEnabled('entry') || 
                       isEnabled('lineup') || isEnabled('faceCam') || isEnabled('skills') || 
                       isEnabled('goals') || isEnabled('celebrations');
  
  if (!hasAnyVideos) return 0;
  
  // Calculer le total
  return arrivesCount * trainingCount * entryCount * lineupCount * faceCamCount * skillsGoalsCount * celebrationsCount;
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

type SelectedMedia = {
  file: File;
  type: "image" | "video";
  duration: number;
  url?: string;
  aspectRatio?: number;
  isCorrectRatio?: boolean;
};

// Fonction utilitaire pour déterminer si une URL est une data URL
function isDataUrl(url: string): boolean {
  return url?.startsWith('data:');
}

// Fonction pour obtenir l'URL d'affichage correcte pour un template
function getTemplateDisplayUrl(template: any): string {
  console.log("getTemplateDisplayUrl called with template:", template);
  
  // Si l'URL est undefined ou null, retourner une chaîne vide
  if (!template?.url) {
    console.log("Template URL is undefined or null");
    return '';
  }
  
  // Si l'ID du template commence par "local_", c'est un template stocké localement
  if (template.id?.startsWith('local_')) {
    console.log("Template ID starts with 'local_', checking localStorage for key:", template.url);
    try {
      // Récupérer l'URL depuis localStorage
      const dataUrl = localStorage.getItem(template.url);
      console.log("Retrieved from localStorage:", template.url, dataUrl ? "found" : "not found");
      if (dataUrl) {
        return dataUrl;
      } else {
        // Si la clé n'est pas trouvée, vérifier si l'URL elle-même est une data URL
        if (isDataUrl(template.url)) {
          console.log("URL is a data URL, using it directly");
          return template.url;
        }
        console.log("Data URL not found in localStorage, using original URL");
        return template.url;
      }
    } catch (error) {
      console.error("Error accessing localStorage:", error);
      return template.url;
    }
  }
  
  // Si l'URL commence par "local_storage_", c'est une clé localStorage
  if (template.url.startsWith('local_storage_')) {
    console.log("URL starts with 'local_storage_', retrieving from localStorage");
    try {
      // Récupérer l'URL depuis localStorage
      const dataUrl = localStorage.getItem(template.url);
      console.log("Retrieved from localStorage:", template.url, dataUrl ? "found" : "not found");
      if (dataUrl) {
        return dataUrl;
      } else {
        // Si la clé n'est pas trouvée, vérifier si l'URL elle-même est une data URL
        if (isDataUrl(template.url)) {
          console.log("URL is a data URL, using it directly");
          return template.url;
        }
        console.log("Data URL not found in localStorage, using original URL");
        return template.url;
      }
    } catch (error) {
      console.error("Error accessing localStorage:", error);
      return template.url;
    }
  }
  
  // Si c'est déjà une data URL, la retourner telle quelle
  if (isDataUrl(template.url)) {
    console.log("URL is already a data URL");
    return template.url;
  }
  
  // Sinon, c'est une URL normale
  console.log("Using normal URL:", template.url);
  return template.url;
}

// Composant pour afficher un template avec gestion du stockage local
function TemplateImage({ template, alt, position = 'center' }: { template: any, alt: string, position?: 'top' | 'center' | 'bottom' }) {
  console.log("TemplateImage rendering with template:", template, "alt:", alt, "position:", position);
  const [mediaError, setMediaError] = useState(false);
  const [isVideo, setIsVideo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Récupérer l'URL d'affichage
  const displayUrl = useMemo(() => {
    if (!template?.url) {
      console.log("No template URL provided");
      return '';
    }

    // Si l'URL commence par 'local_storage_', récupérer depuis localStorage
    if (template.url.startsWith('local_storage_')) {
      try {
        const dataUrl = localStorage.getItem(template.url);
        if (dataUrl) {
          console.log("Retrieved from localStorage:", template.url);
          return dataUrl;
        }
      } catch (error) {
        console.error("Error accessing localStorage:", error);
      }
    }

    // Sinon retourner l'URL telle quelle
    return template.url;
  }, [template?.url]);

  console.log("Display URL after processing:", displayUrl);
  
  // Détecter si c'est une vidéo basée sur le type ou l'extension
  useEffect(() => {
    setIsLoading(true);
    setMediaError(false);
    
    console.log("Template type check:", template?.type);
    
    // First check the explicit type property
    if (template?.type === 'video') {
      console.log("Template type is explicitly set to video");
      setIsVideo(true);
      setIsLoading(false);
      return;
    }
    
    // If no explicit type or type is not 'video', check the URL
    if (displayUrl) {
      // Check if the URL has video extensions or MIME types
      const isVideoUrl = displayUrl.match(/\.(mp4|webm|ogg|mov|avi|wmv)($|\?)/i) || 
                        displayUrl.includes('video/mp4') || 
                        displayUrl.includes('video/webm') || 
                        displayUrl.includes('video/ogg') ||
                        displayUrl.includes('video/quicktime') ||
                        displayUrl.includes('video/avi');
      
      // For object URLs or data URLs, make an extra check
      const isBlobOrDataVideo = displayUrl.startsWith('blob:') || 
                               displayUrl.startsWith('data:video');
      
      const isVideoType = isVideoUrl || isBlobOrDataVideo;
      
      console.log("URL video detection:", isVideoType ? "Is video" : "Is image", 
                 "URL:", displayUrl, 
                 "Matches:", {isVideoUrl, isBlobOrDataVideo});
      
      setIsVideo(isVideoType);
      setIsLoading(false);
    }
  }, [displayUrl, template]);
  
  if (!displayUrl || mediaError) {
    console.log("No display URL available or media error, showing placeholder");
    return (
      <div className="w-full h-full bg-gray-200 flex flex-col items-center justify-center">
        <span className="text-sm text-gray-500">No media</span>
        {mediaError && <span className="text-xs text-red-400 mt-1">Error loading media</span>}
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center">
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    );
  }
  
  // Déterminer le style de positionnement en fonction de la position
  const getObjectPositionStyle = () => {
    const style = { objectFit: 'cover' as const };
    switch(position) {
      case 'top':
        return { ...style, transform: 'translateY(0%)' } as const;
      case 'bottom':
        return { ...style, transform: 'translateY(-50%)' } as const;
      default:
        return { ...style, transform: 'translateY(-25%)' } as const;
    }
  };
  
  return (
    <div className="relative w-full h-full overflow-hidden">
      {isVideo ? (
        <video 
          key={`video-${displayUrl}`}
          src={displayUrl}
          className={`absolute inset-0 w-full h-full object-cover ${position === 'top' ? 'object-top' : position === 'bottom' ? 'object-bottom' : 'object-center'}`}
          muted
          loop
          playsInline
          autoPlay
          controls={false}
          onLoadStart={() => console.log("Video load started for:", displayUrl)}
          onLoadedMetadata={() => console.log("Video metadata loaded for:", displayUrl)}
          onLoadedData={() => console.log("Video data loaded successfully for:", displayUrl)}
          onCanPlay={() => console.log("Video can play now for:", displayUrl)}
          onPlay={() => console.log("Video started playing for:", displayUrl)}
          onError={(e) => {
            const videoElement = e.currentTarget;
            const errorDetail = {
              mediaError: videoElement.error ? {
                code: videoElement.error.code,
                message: videoElement.error.message,
                MEDIA_ERR_DECODE: videoElement.error.MEDIA_ERR_DECODE,
                MEDIA_ERR_NETWORK: videoElement.error.MEDIA_ERR_NETWORK,
                MEDIA_ERR_SRC_NOT_SUPPORTED: videoElement.error.MEDIA_ERR_SRC_NOT_SUPPORTED,
                MEDIA_ERR_ABORTED: videoElement.error.MEDIA_ERR_ABORTED,
              } : 'No specific error details',
              src: displayUrl,
              videoElementInfo: {
                networkState: videoElement.networkState,
                readyState: videoElement.readyState,
              }
            };
            console.error("Error loading video:", errorDetail);
            setMediaError(true);
            videoElement.classList.add('video-error');
          }}
        />
      ) : (
        <Image 
          key={`img-${displayUrl}`}
          src={displayUrl} 
          alt={alt}
          layout="fill"
          className={`absolute inset-0 w-full h-full object-cover ${position === 'top' ? 'object-top' : position === 'bottom' ? 'object-bottom' : 'object-center'}`}
          onLoad={() => console.log("Image loaded successfully")}
          onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
            // Improve error reporting
            const errorInfo = {
              src: displayUrl,
              target: e.currentTarget ? "HTMLImageElement" : "unknown",
              error: "Failed to load image"
            };
            console.error("Error loading image:", errorInfo);
            setMediaError(true);
            if (e.currentTarget) {
              e.currentTarget.classList.add('image-error');
              e.currentTarget.setAttribute('title', `Failed to load: ${displayUrl}`);
            }
          }}
        />
      )}
    </div>
  );
}

// Fonction pour sauvegarder l'état de génération dans localStorage
const saveGenerationState = (state: {
  isGenerating: boolean;
  progress: number;
  generatedVideos: string[];
  generatedCount: number;
  totalToGenerate: number;
  currentHookIndex: number;
  currentMediaIndex: number;
}) => {
  localStorage.setItem('bluum-generation-state', JSON.stringify(state));
};

// Fonction pour charger l'état de génération depuis localStorage
const loadGenerationState = () => {
  const savedState = localStorage.getItem('bluum-generation-state');
  return savedState ? JSON.parse(savedState) : null;
};

// Fonction pour effacer l'état de génération dans localStorage
const clearGenerationState = () => {
  localStorage.removeItem('bluum-generation-state');
};

// Ajouter ces constantes en haut du fichier, après les imports
const ESTIMATED_TIME_PER_VIDEO = 15; // Estimation de 15 secondes par vidéo
const PROGRESS_STEPS = {
  INIT: 5,
  TEMPLATE_PREP: 5,
  MEDIA_PREP: 5,
  VIDEO_START: 5,
  COMPLETION: 100
};

// Ajouter des constantes pour l'estimation du temps
const BASE_PROCESSING_TIME = 10; // Temps de base en secondes
const SIZE_FACTOR = 0.5; // Facteur multiplicateur par MB

// Fonction pour estimer le temps de traitement
const estimateProcessingTime = (file1Size: number, file2Size: number) => {
  const totalSizeMB = (file1Size + file2Size) / (1024 * 1024); // Convertir en MB
  return BASE_PROCESSING_TIME + (totalSizeMB * SIZE_FACTOR);
};

// Composant pour afficher une vidéo avec indicateur de durée
const VideoThumbnail = ({ 
  video, 
  partKey, 
  index,
  onRemove,
  getVideoUrl
}: { 
  video: File; 
  partKey: string; 
  index: number;
  onRemove: (partKey: string, index: number) => void;
  getVideoUrl: (file: File) => string;
}) => {
  return (
    <div className="relative aspect-[9/16] rounded overflow-hidden border-2 border-gray-200 dark:border-gray-600">
      <video
        src={getVideoUrl(video)}
        className="w-full h-full object-cover"
        muted
      />
      <button
        onClick={() => onRemove(partKey as any, index)}
        className="absolute top-0.5 right-0.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 opacity-80 hover:opacity-100 transition-opacity"
        title="Remove video"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>
  );
};

export default function CreatePage() {
  // Ajouter une vérification pour éviter les erreurs d'hydratation
  const isClient = typeof window !== 'undefined';
  const { user } = useAuth(); // Utiliser notre hook useAuth au lieu de useUser de Clerk
  const { mediaFiles } = useVideoStore();
  
  // Charger l'état sauvegardé depuis localStorage
  const loadSavedState = () => {
    if (!isClient || !user) return {};
    const saved = localStorage.getItem(`create-video-form-${user.id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading saved state:', e);
        return {};
      }
    }
    return {};
  };
  
  const savedState = loadSavedState();
  
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(savedState.selectedTemplate || null);
  const [uploadedVideos, setUploadedVideos] = useState<File[]>([]);
  const [selectedSong, setSelectedSong] = useState<UserSong | null>(null);  // Ne pas charger directement, attendre que les songs soient chargées
  const [songs, setSongs] = useState<UserSong[]>([]);
  const [hooks, setHooks] = useState<string>(savedState.hooks || "");
  const [isExtractingLyrics, setIsExtractingLyrics] = useState(false);
  const [extractedLyrics, setExtractedLyrics] = useState<string>("");
  const [wordTimestamps, setWordTimestamps] = useState<Array<{text: string, start: number, end: number}>>(savedState.wordTimestamps || []);
  const [showTimestampEditor, setShowTimestampEditor] = useState(false);
  const [lyricsSaveStatus, setLyricsSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [textCase, setTextCase] = useState<'actual' | 'uppercase' | 'lowercase'>(savedState.textCase || 'actual');
  const [selectedStyles, setSelectedStyles] = useState<Set<number>>(new Set(savedState.selectedStyles || [2]));
  const [currentStyle, setCurrentStyle] = useState<number>(savedState.currentStyle || 2);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingSongs, setIsLoadingSongs] = useState(true);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [templateDurationRange, setTemplateDurationRange] = useState<{min: number, max: number}>(
    savedState.templateDurationRange || {min: 4, max: 6}
  );
  const [videoDurationRange, setVideoDurationRange] = useState<{min: number, max: number}>(
    savedState.videoDurationRange || {min: 4, max: 6}
  );
  const [selectedMedias, setSelectedMedias] = useState<SelectedMedia[]>([]);  // Ne pas charger les médias, trop lourd
  const [selectedMediaIndexes, setSelectedMediaIndexes] = useState<Set<number>>(new Set(savedState.selectedMediaIndexes || []));

  // Pour Auto Lyrics : 2 collections séparées
  const [selectedMediasBeforeRefrain, setSelectedMediasBeforeRefrain] = useState<SelectedMedia[]>([]);
  const [selectedMediasAfterRefrain, setSelectedMediasAfterRefrain] = useState<SelectedMedia[]>([]);
  const [selectedMediaIndexesBeforeRefrain, setSelectedMediaIndexesBeforeRefrain] = useState<Set<number>>(new Set());
  const [selectedMediaIndexesAfterRefrain, setSelectedMediaIndexesAfterRefrain] = useState<Set<number>>(new Set());
  const [textPosition, setTextPosition] = useState<'top' | 'middle' | 'bottom'>(savedState.textPosition || 'top');
  const [textOffset, setTextOffset] = useState<number>(savedState.textOffset || 0);
  const [style1Position, setStyle1Position] = useState<{position: 'top' | 'middle' | 'bottom', offset: number}>(
    savedState.style1Position || { position: 'top', offset: 0 }
  );
  const [style2Position, setStyle2Position] = useState<{position: 'top' | 'middle' | 'bottom', offset: number}>(
    savedState.style2Position || { position: 'top', offset: 0 }
  );
  const [style3Position, setStyle3Position] = useState<{position: 'top' | 'middle' | 'bottom', offset: number}>(
    savedState.style3Position || { position: 'top', offset: 0 }
  );
  const [style4Position, setStyle4Position] = useState<{position: 'top' | 'middle' | 'bottom', offset: number}>(
    savedState.style4Position || { position: 'middle', offset: 0 }
  );

  // État pour la sélection de fonts (multiples)
  const [selectedFonts, setSelectedFonts] = useState<string[]>(savedState.selectedFonts || ['tiktok']);
  
  // État pour la taille de font (en pourcentage, 100 = taille normale)
  const [fontSize, setFontSize] = useState<number>(savedState.fontSize || 100);
  
  // État pour le mode random font size
  const [randomFontSize, setRandomFontSize] = useState<boolean>(savedState.randomFontSize || false);
  
  // État pour le mode random position
  const [randomPosition, setRandomPosition] = useState<boolean>(savedState.randomPosition || false);

  // Liste des fonts disponibles
  const availableFonts = [
    { id: 'all', name: 'All Fonts', path: 'mixed' },
    { id: 'tiktok', name: 'TikTok', path: '/fonts/TikTokDisplayMedium.otf' },
    { id: 'elgraine', name: 'Elgraine', path: '/fonts/new-fonts/Elgraine-LightItalic.otf' },
    { id: 'garamond', name: 'Garamond', path: '/fonts/new-fonts/Garamond Premier Pro Light Display.otf' },
    { id: 'gazpacho', name: 'Gazpacho', path: '/fonts/new-fonts/Gazpacho-Heavy.otf' },
    { id: 'kaufmann', name: 'Kaufmann', path: '/fonts/new-fonts/Kaufmann Bold.otf' },
    { id: 'pepi', name: 'Pepi', path: '/fonts/new-fonts/PepiTRIAL-Bold-BF676cc171e9076.otf' },
    { id: 'rudi', name: 'Rudi', path: '/fonts/new-fonts/RudiTRIAL-Bold-BF676cc17237a19.otf' },
    { id: 'silk', name: 'Silk', path: '/fonts/new-fonts/Silk Serif SemiBold.otf' },
    { id: 'routine', name: 'Routine', path: '/fonts/new-fonts/Thursday Routine.ttf' }
  ];

  const fontsAutoLyrics = [
    { id: 'tiktok', name: 'TikTok', path: '/fonts/TikTokDisplayBold.otf' },
    { id: 'railroad', name: 'Railroad Gothic', path: '/fonts/RailroadGothicCC.ttf' },
    { id: 'pencil', name: 'Pencil Sharp', path: '/fonts/PENCIL SHARP.ttf' },
    { id: 'gunterz', name: 'Gunterz', path: '/fonts/Fontspring-DEMO-gunterz-bold.otf' }
  ];
  const [templateImagePosition, setTemplateImagePosition] = useState<'top' | 'center' | 'bottom'>('center');
  const [isGenerating, setIsGenerating] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [totalToGenerate, setTotalToGenerate] = useState(0);
  const [generatedVideos, setGeneratedVideos] = useState<string[]>([]);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { uploadTemplate } = useSupabase();
  
  // Variables d'état pour le suivi de la progression entre les onglets
  const [currentHookIndex, setCurrentHookIndex] = useState(0);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  
  // Initialiser sans template par défaut
  const [defaultTemplate, setDefaultTemplate] = useState<{id: string, url: string, type: string} | null>(null);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const { addVideo } = useUserVideosStore();

  // Ajouter une nouvelle variable d'état pour l'animation de fin
  const [showCompletionAnimation, setShowCompletionAnimation] = useState(false);
  const [generationComplete, setGenerationComplete] = useState(false);

  // Ajout de l'état pour suivre l'index de prévisualisation actuel
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  
  // État pour le modèle sélectionné
  const [selectedModel, setSelectedModel] = useState<string>(savedState.selectedModel || 'versus');
  const [videosToCreate, setVideosToCreate] = useState<number>(savedState.videosToCreate || 1);
  
  // États pour les nouvelles options de timing et variation (en millisecondes)
  const [imageTimingMin, setImageTimingMin] = useState<number>(savedState.imageTimingMin || 450);
  const [imageTimingMax, setImageTimingMax] = useState<number>(savedState.imageTimingMax || 1200);
  const [imageCountMin, setImageCountMin] = useState<number>(savedState.imageCountMin || 8);
  const [imageCountMax, setImageCountMax] = useState<number>(savedState.imageCountMax || 20);
  const [maxVideoDuration, setMaxVideoDuration] = useState<number>(savedState.maxVideoDuration || 15);
  const [enableVariation, setEnableVariation] = useState<boolean>(savedState.enableVariation || true);
  
  // États pour le mode slideshow
  const [contentType, setContentType] = useState<'video' | 'slideshow'>(savedState.contentType || 'video');
  const [slideshowImageCount, setSlideshowImageCount] = useState<number>(5);
  const [slideshowImages, setSlideshowImages] = useState<File[]>([]);
  const [slideshowHooksPerImage, setSlideshowHooksPerImage] = useState<{[key: number]: string}>({});
  const [slideshowUploadMode, setSlideshowUploadMode] = useState<'ordered' | 'random'>('ordered');
  const [slideshowsToCreate, setSlideshowsToCreate] = useState<number>(1);
  
  // État pour les liaisons partie-dossier FE!N
  const [feinFolderMappings, setFeinFolderMappings] = useState<{
    [key: string]: string | null; // part1, part2, ... part10 -> folder_id
  }>({});
  
  // État pour les liaisons partie-dossier Creed Streamer
  const [creedFolderMappings, setCreedFolderMappings] = useState<{
    [key: string]: string | null; // creed-part1, creed-part2, ... creed-part11 -> folder_id
  }>({});
  
  // État pour AutoCut
  const [twainYaGamilaState, setTwainYaGamilaState] = useState<{
    collection: any | null;
    videosToGenerate: number;
  }>({
    collection: null,
    videosToGenerate: 1
  });

  // États pour Auto Lyrics - 2 collections séparées
  const [collectionBeforeRefrain, setCollectionBeforeRefrain] = useState<any | null>(null);
  const [collectionAfterRefrain, setCollectionAfterRefrain] = useState<any | null>(null);
  const [showCollectionModalBeforeRefrain, setShowCollectionModalBeforeRefrain] = useState(false);
  const [showCollectionModalAfterRefrain, setShowCollectionModalAfterRefrain] = useState(false);
  const [collectionModalPage, setCollectionModalPage] = useState(1);
  const collectionsPerModalPage = 16; // 4 lignes × 4 colonnes
  const [useOneCollection, setUseOneCollection] = useState(false); // Toggle pour utiliser 1 ou 2 collections

  // États pour les templates AutoCut (Step 6)
  const [autoCutTemplate, setAutoCutTemplate] = useState<string>('tiktok-creative'); // Template sélectionné
  const [lyricsStyle, setLyricsStyle] = useState<'words' | 'line' | 'multi-line' | 'sentence-one-shot' | 'stacked'>('words'); // Style pour Auto Lyrics
  const [montageType, setMontageType] = useState<string>('for-a-living'); // Montage type pour Auto Lyrics
  const [textColors, setTextColors] = useState<Array<{color: string, enabled: boolean}>>([
    { color: '#FFFFFF', enabled: true },
    { color: '#FBDCF6', enabled: true },
    { color: '#F3CF0D', enabled: true },
    { color: '#ED211F', enabled: true }
  ]);
  const [currentColorPicker, setCurrentColorPicker] = useState<string>('#FFFFFF');

  // États pour le modal de collection (AutoCut)
  const [showTwainCollectionModal, setShowTwainCollectionModal] = useState(false);
  const [collectionModalTab, setCollectionModalTab] = useState<'images' | 'videos'>('images');
  const [imageCollections, setImageCollections] = useState<any[]>([]);
  const [videoCollections, setVideoCollections] = useState<any[]>([]);
  const [twainModalPage, setTwainModalPage] = useState(1);
  const twainCollectionsPerPage = 12; // 3 lignes × 4 colonnes
  
  const [userFolders, setUserFolders] = useState<any[]>([]); // Deprecated - will be removed
  const [userSongs, setUserSongs] = useState<UserSong[]>([]);
  const [loadingFolderVideos, setLoadingFolderVideos] = useState(false);
  
  // État pour Versus
  const [versusParts, setVersusParts] = useState<{
    arrivesStadium: File[];
    training: File[];
    entry: File[];
    lineup: File[];
    faceCam: File[];
    skills: File[];
    goals: File[];
    celebrations: File[];
  }>({
    arrivesStadium: [],
    training: [],
    entry: [],
    lineup: [],
    faceCam: [],
    skills: [],
    goals: [],
    celebrations: []
  });
  
  // État pour Max Combinaisons
  const [maxCombinaisonsParts, setMaxCombinaisonsParts] = useState<{
    part1: File[];
    part2: File[];
    part3: File[];
    part4: File[];
    part5: File[];
    part6: File[];
    part7: File[];
    part8: File[];
    part9: File[];
    part10: File[];
    logo: File[]; // Part 11 est le logo
  }>({
    part1: [],
    part2: [],
    part3: [],
    part4: [],
    part5: [],
    part6: [],
    part7: [],
    part8: [],
    part9: [],
    part10: [],
    logo: [] // Part 11 - logo
  });
  
  // État pour Creed Streamer (11 parties)
  const [creedStreamerParts, setCreedStreamerParts] = useState<{
    part1: File[];
    part2: File[];
    part3: File[];
    part4: File[];
    part5: File[];
    part6: File[];
    part7: File[];
    part8: File[];
    part9: File[];
    part10: File[];
    part11: File[];
    logo: File[]; // logo optionnel
  }>({
    part1: [],
    part2: [],
    part3: [],
    part4: [],
    part5: [],
    part6: [],
    part7: [],
    part8: [],
    part9: [],
    part10: [],
    part11: [],
    logo: []
  });
  
  // États pour les paramètres du logo (non utilisés pour FE!N clipper - valeurs fixes)
  const [logoSize] = useState<number>(30); // Taille fixe à 30% pour FE!N clipper
  const [logoPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'>('center');
  
  // États pour stocker les hooks et logos
  const [storedHooks, setStoredHooks] = useState<string[]>([]);
  const [storedLogos, setStoredLogos] = useState<File[]>([]);
  
  // Charger les liaisons partie-dossier sauvegardées
  useEffect(() => {
    const loadFeinMappings = () => {
      const saved = localStorage.getItem('feinFolderMappings');
      if (saved) {
        try {
          const mappings = JSON.parse(saved);
          setFeinFolderMappings(mappings);
          console.log('Liaisons partie-dossier FE!N chargées:', mappings);
        } catch (e) {
          console.error('Erreur lors du chargement des liaisons FE!N:', e);
        }
      }
    };
    
    const loadCreedMappings = () => {
      const saved = localStorage.getItem('creedFolderMappings');
      if (saved) {
        try {
          const mappings = JSON.parse(saved);
          setCreedFolderMappings(mappings);
          console.log('Liaisons partie-dossier Creed Streamer chargées:', mappings);
        } catch (e) {
          console.error('Erreur lors du chargement des liaisons Creed:', e);
        }
      }
    };
    
    loadFeinMappings();
    loadCreedMappings();
  }, []);
  
  // Sauvegarder les liaisons partie-dossier
  useEffect(() => {
    if (Object.keys(feinFolderMappings).length > 0) {
      localStorage.setItem('feinFolderMappings', JSON.stringify(feinFolderMappings));
      console.log('Liaisons partie-dossier FE!N sauvegardées');
    }
  }, [feinFolderMappings]);
  
  useEffect(() => {
    if (Object.keys(creedFolderMappings).length > 0) {
      localStorage.setItem('creedFolderMappings', JSON.stringify(creedFolderMappings));
      console.log('Liaisons partie-dossier Creed Streamer sauvegardées');
    }
  }, [creedFolderMappings]);
  
  // Charger les dossiers de l'utilisateur
  useEffect(() => {
    const loadUserFolders = async () => {
      if (!user?.id) return;
      
      try {
        // Charger les collections d'images et vidéos depuis Supabase
        const { getImageCollections, getVideoCollections } = await import('@/lib/collections-db');
        
        const [imgCollections, vidCollections] = await Promise.all([
          getImageCollections(user.id),
          getVideoCollections(user.id)
        ]);
        
        setImageCollections(imgCollections);
        setVideoCollections(vidCollections);
        
        // Legacy support - à supprimer plus tard
        setUserFolders([...imgCollections, ...vidCollections]);
      } catch (e) {
        console.error('Erreur lors du chargement des collections:', e);
      }
    };
    
    if (user?.id) {
      loadUserFolders();
    }
  }, [user?.id]);
  
  // Charger les chansons de l'utilisateur  
  useEffect(() => {
    const loadUserSongs = async () => {
      if (!user?.id) return;
      
      try {
        const songs = await getUserSongs(user.id);
        setUserSongs(songs);
        console.log('Chansons utilisateur chargées:', songs.length);
      } catch (e) {
        console.error('Erreur lors du chargement des chansons:', e);
      }
    };
    
    if (user?.id) {
      loadUserSongs();
    }
  }, [user?.id]);
  
  // Charger les collections d'images depuis localStorage (comme slideshow)
  useEffect(() => {
    if (user?.id && selectedModel === 'twain-ya-gamila') {
      const saved = localStorage.getItem(`image-collections-${user.id}`);
      if (saved) {
        try {
          const collections = JSON.parse(saved);
          setImageCollections(collections);
          console.log('Collections d\'images chargées:', collections.length);
        } catch (e) {
          console.error('Erreur lors du parsing des collections:', e);
          setImageCollections([]);
        }
      } else {
        setImageCollections([]);
      }
    }
  }, [user?.id, selectedModel]);
  
  // Charger automatiquement les vidéos des dossiers liés
  useEffect(() => {
    const loadFolderVideos = async () => {
      if (!user?.id || selectedModel !== 'fein-clipper') return;
      
      setLoadingFolderVideos(true);
      
      try {
        const { getUserClips } = await import('@/lib/supabase');
        
        // Pour chaque partie liée à un dossier, charger les vidéos
        for (let i = 1; i <= 10; i++) {
          const partKey = `part${i}`;
          const folderId = feinFolderMappings[partKey];
          
          if (folderId) {
            // Charger les clips de ce dossier
            const clips = await getUserClips(user.id, folderId);
            
            // Créer des objets File légers sans télécharger le contenu
            const files = clips.map(clip => {
              // Vérifier que clip.path est une string valide
              if (!clip.path || typeof clip.path !== 'string') {
                console.error(`Invalid clip path for clip ${clip.id}:`, clip.path);
                return null;
              }

              // Créer un File-like object avec juste les métadonnées
              const file = new File([], clip.file_name || `clip_${clip.id}.mp4`, {
                type: 'video/mp4'
              });
              // Ajouter l'URL comme propriété personnalisée pour l'utiliser plus tard
              (file as any).clipUrl = clip.path;
              (file as any).clipId = clip.id;
              return file;
            }).filter(f => f !== null);
            
            const validFiles = files.filter(f => f !== null) as File[];
            
            // Mettre à jour la partie avec les fichiers chargés
            setMaxCombinaisonsParts(prev => ({
              ...prev,
              [partKey]: validFiles
            }));
            
            console.log(`Partie ${i}: ${validFiles.length} vidéos chargées du dossier ${folderId}`);
          }
        }
        
        toast.success('Vidéos chargées depuis les dossiers liés');
      } catch (e) {
        console.error('Erreur lors du chargement des vidéos:', e);
        toast.error('Erreur lors du chargement des vidéos');
      } finally {
        setLoadingFolderVideos(false);
      }
    };
    
    // Charger les vidéos quand on passe en mode FE!N clipper
    if (selectedModel === 'fein-clipper' && Object.keys(feinFolderMappings).length > 0) {
      loadFolderVideos();
    }
  }, [selectedModel, feinFolderMappings, user?.id]);

  // Charger les vidéos pour Creed Streamer
  useEffect(() => {
    const loadCreedFolderVideos = async () => {
      if (!user?.id || selectedModel !== 'creed-streamer') return;
      
      setLoadingFolderVideos(true);
      
      try {
        const { getUserClips } = await import('@/lib/supabase');
        
        // Pour chaque partie liée à un dossier, charger les vidéos
        for (let i = 1; i <= 11; i++) {
          const partKey = `creed-part${i}`;
          const folderId = creedFolderMappings[partKey];
          
          if (folderId) {
            // Charger les clips de ce dossier
            const clips = await getUserClips(user.id, folderId);
            
            // Créer des objets File légers sans télécharger le contenu
            const files = clips.map(clip => {
              // Vérifier que clip.path est une string valide
              if (!clip.path || typeof clip.path !== 'string') {
                console.error(`Invalid clip path for clip ${clip.id}:`, clip.path);
                return null;
              }

              // Créer un File-like object avec juste les métadonnées
              const file = new File([], clip.file_name || `clip_${clip.id}.mp4`, {
                type: 'video/mp4'
              });
              // Ajouter l'URL comme propriété personnalisée pour l'utiliser plus tard
              (file as any).clipUrl = clip.path;
              (file as any).clipId = clip.id;
              return file;
            }).filter(f => f !== null);
            
            const validFiles = files.filter(f => f !== null) as File[];
            
            // Mettre à jour la partie avec les fichiers chargés
            setCreedStreamerParts(prev => ({
              ...prev,
              [`part${i}`]: validFiles
            }));
            
            console.log(`Creed Part ${i}: ${validFiles.length} vidéos chargées du dossier ${folderId}`);
          }
        }
        
        toast.success('Vidéos Creed Streamer chargées depuis les dossiers liés');
      } catch (e) {
        console.error('Erreur lors du chargement des vidéos Creed:', e);
        toast.error('Erreur lors du chargement des vidéos Creed');
      } finally {
        setLoadingFolderVideos(false);
      }
    };
    
    // Charger les vidéos quand on passe en mode Creed Streamer
    if (selectedModel === 'creed-streamer' && Object.keys(creedFolderMappings).length > 0) {
      loadCreedFolderVideos();
    }
  }, [selectedModel, creedFolderMappings, user?.id]);
  
  // Plus de cases: on déduit automatiquement les parties actives des clips présents
  const versusEnabled = useMemo(() => ({
    arrivesStadium: versusParts.arrivesStadium.length > 0,
    training: versusParts.training.length > 0,
    entry: versusParts.entry.length > 0,
    lineup: versusParts.lineup.length > 0,
    faceCam: versusParts.faceCam.length > 0,
    skills: versusParts.skills.length > 0,
    goals: versusParts.goals.length > 0,
    celebrations: versusParts.celebrations.length > 0
  }), [versusParts]);
  // Versus: final length is the sum of all clip durations

  const templates = useMemo(() => {
    return mediaFiles.filter(f => 
      (f.type === "image" || f.type === "video")
    );
  }, [mediaFiles]);

  // Supprimer l'effet qui définit le template par défaut
  useEffect(() => {
    if (defaultTemplate && !selectedTemplate) {
      setSelectedTemplate(null);
    }
  }, [defaultTemplate, selectedTemplate]);

  // Load fonts for canvas
  useEffect(() => {
    const loadSelectedFont = async () => {
      try {
        setFontsLoaded(false);

        // Définir les fonts disponibles avec leurs noms CSS (basé sur les vrais fichiers)
        const fontConfigs: { [key: string]: { name: string, url: string, cssName: string } } = {
          'tiktok': { name: 'TikTok Display Medium', url: '/fonts/TikTokDisplayMedium.otf', cssName: 'TikTok Display Medium' },
          'elgraine': { name: 'Elgraine Light Italic', url: '/fonts/new-fonts/Elgraine-LightItalic.otf', cssName: 'Elgraine Light Italic' },
          'garamond': { name: 'Garamond Premier Pro Light Display', url: '/fonts/new-fonts/Garamond%20Premier%20Pro%20Light%20Display.otf', cssName: 'Garamond Premier Pro Light Display' },
          'gazpacho': { name: 'Gazpacho Heavy', url: '/fonts/new-fonts/Gazpacho-Heavy.otf', cssName: 'Gazpacho Heavy' },
          'kaufmann': { name: 'Kaufmann Bold', url: '/fonts/new-fonts/Kaufmann%20Bold.otf', cssName: 'Kaufmann Bold' },
          'pepi': { name: 'Pepi Trial Bold', url: '/fonts/new-fonts/PepiTRIAL-Bold-BF676cc171e9076.otf', cssName: 'Pepi Trial Bold' },
          'rudi': { name: 'Rudi Trial Bold', url: '/fonts/new-fonts/RudiTRIAL-Bold-BF676cc17237a19.otf', cssName: 'Rudi Trial Bold' },
          'silk': { name: 'Silk Serif SemiBold', url: '/fonts/new-fonts/Silk%20Serif%20SemiBold.otf', cssName: 'Silk Serif SemiBold' },
          'routine': { name: 'Thursday Routine', url: '/fonts/new-fonts/Thursday%20Routine.ttf', cssName: 'Thursday Routine' },
          // Fonts 2000
          'being': { name: 'Being Regular', url: '/fonts/2000/Being%20Regular/OpenType-PS/Being-Regular.otf', cssName: 'Being Regular' },
          'unique-bold': { name: 'Unique Bold', url: '/fonts/2000/Unique/Web-TT/Unique-Bold.ttf', cssName: 'Unique Bold' },
          'thunder-bold': { name: 'Thunder BoldHC', url: '/fonts/2000/THUNDER/Fonts/Web-TT/Thunder-BoldHC.ttf', cssName: 'Thunder BoldHC' },
          'valencia': { name: 'Valencia', url: '/fonts/2000/Valencia.ttf', cssName: 'Valencia' },
          'alias': { name: 'Alias Bold', url: '/fonts/2000/Alias/OpenType-TT/Alias-Bold.ttf', cssName: 'Alias Bold' },
          'alinsa': { name: 'Alinsa', url: '/fonts/2000/Alinsa/Alinsa.ttf', cssName: 'Alinsa' },
          'lemon': { name: 'Lemon Wide', url: '/fonts/2000/Lemon%20Regular/Web-TT/Lemon-Wide.ttf', cssName: 'Lemon Wide' },
          'avestiana': { name: 'AVEstiana Bold', url: '/fonts/2000/AV-Estiana/OpenType-TT/AVEstiana-Bold.ttf', cssName: 'AVEstiana Bold' },
          'estrella': { name: 'Estrella Early', url: '/fonts/2000/Estrella/Estrella-Early.otf', cssName: 'Estrella Early' }
        };
        
        // Charger toutes les fonts sélectionnées
        console.log('Loading selected fonts:', selectedFonts);
        for (const fontId of selectedFonts) {
          const config = fontConfigs[fontId];
          if (config) {
            try {
              const font = new FontFace(config.name, `url(${config.url})`, {
                weight: '400',
                style: 'normal'
              });
              await font.load();
              document.fonts.add(font);
              console.log(`${config.name} font loaded successfully`);
            } catch (error) {
              console.warn(`Failed to load font ${config.name}:`, error);
            }
          }
        }
        
        // Attendre un peu pour s'assurer que la police est bien appliquée
        setTimeout(() => {
          setFontsLoaded(true);
        }, 200);
      } catch (error) {
        console.error('Error loading fonts:', error);
        setFontsLoaded(true); // Set to true even on error to prevent blocking
      }
    };
    
    loadSelectedFont();
  }, [selectedFonts]); // Recharger quand les fonts sélectionnées changent

  // Réinitialiser les fonts sélectionnées quand on change de template
  useEffect(() => {
    if (autoCutTemplate === 'auto-lyrics') {
      // Sélectionner TikTok pour le template Auto Lyrics
      setSelectedFonts(['tiktok']);
      // Configurer les valeurs par défaut pour Auto Lyrics : 80px font size et centré
      setFontSize(80);
      setStyle1Position({ position: 'middle', offset: 0 });
      setStyle2Position({ position: 'middle', offset: 0 });
      setStyle3Position({ position: 'middle', offset: 0 });
      setStyle4Position({ position: 'middle', offset: 0 });
    } else {
      // Sélectionner TikTok par défaut pour les autres templates
      setSelectedFonts(['tiktok']);
    }
  }, [autoCutTemplate]);

  // Fonction pour obtenir le multiplicateur de taille de font
  const getFontSizeMultiplier = () => {
    if (randomFontSize) {
      // En mode random, retourner 1.0 pour la preview (la randomisation se fait côté backend)
      return 1.0;
    }
    // fontSize est maintenant en pixels (80px, 100px, etc.)
    // Pour Auto Lyrics, la base est 80px donc 80px = 1.0
    // Pour les autres templates, la base est 100px donc 100px = 1.0
    const baseFontSize = autoCutTemplate === 'auto-lyrics' ? 80 : 100;
    return fontSize / baseFontSize;
  };

  // Fonctions pour gérer les fonts multiples
  const toggleFont = (fontId: string) => {
    // Utiliser les fonts Auto Lyrics si le template est auto-lyrics, sinon les fonts normales
    const currentFonts = autoCutTemplate === 'auto-lyrics' ? fontsAutoLyrics : availableFonts;

    if (fontId === 'all') {
      // Si on clique sur "All fonts"
      if (selectedFonts.length === currentFonts.length - (autoCutTemplate === 'auto-lyrics' ? 0 : 1)) {
        // Toutes les fonts sont sélectionnées, tout décocher sauf la première
        const defaultFont = 'tiktok';
        setSelectedFonts([defaultFont]);
      } else {
        // Pas toutes sélectionnées, tout cocher
        setSelectedFonts(currentFonts.filter(f => f.id !== 'all').map(f => f.id));
      }
    } else {
      // Font individuelle - pour template Auto Lyrics, remplacer la sélection au lieu d'ajouter
      if (autoCutTemplate === 'auto-lyrics') {
        setSelectedFonts([fontId]);
      } else {
        // Autres templates: comportement multiple
        if (selectedFonts.includes(fontId)) {
          // Décocher (mais garder au moins une font)
          if (selectedFonts.length > 1) {
            setSelectedFonts(selectedFonts.filter(f => f !== fontId));
          }
        } else {
          // Cocher
          setSelectedFonts([...selectedFonts, fontId]);
        }
      }
    }
  };

  const isAllFontsSelected = () => {
    const currentFonts = autoCutTemplate === 'auto-lyrics' ? fontsAutoLyrics : availableFonts;
    const individualFonts = currentFonts.filter(f => f.id !== 'all');
    return selectedFonts.length === individualFonts.length;
  };

  // Fonction pour obtenir le nom CSS de la font pour la preview (utilise la première font sélectionnée)
  const getSelectedFontName = () => {
    const fontNames: { [key: string]: string } = {
      'tiktok': 'TikTok Display Medium',
      'elgraine': 'Elgraine Light Italic',
      'garamond': 'Garamond Premier Pro Light Display',
      'gazpacho': 'Gazpacho Heavy',
      'kaufmann': 'Kaufmann Bold',
      'pepi': 'Pepi Trial Bold',
      'rudi': 'Rudi Trial Bold',
      'silk': 'Silk Serif SemiBold',
      'routine': 'Thursday Routine',
      // Fonts 2000
      'being': 'Being Regular',
      'unique-bold': 'Unique Bold',
      'thunder-bold': 'Thunder BoldHC',
      'valencia': 'Valencia',
      'alias': 'Alias Bold',
      'alinsa': 'Alinsa',
      'lemon': 'Lemon Wide',
      'avestiana': 'AVEstiana Bold',
      'estrella': 'Estrella Early'
    };

    // Utiliser la première font sélectionnée pour la preview
    const firstFont = selectedFonts[0] || 'tiktok';
    return fontNames[firstFont] || 'TikTok Display Medium';
  };

  // Fonction pour obtenir le premier hook
  const getFirstHook = () => {
    // Ne retourner que le premier hook s'il existe, sinon retourner une chaîne vide
    return hooks.split('\n')[0] || "";
  };

  const captureHookImage = (specificHook?: string) => {
    return new Promise((resolve) => {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        if (ctx && specificHook) {
          // Redessiner le canvas avec le hook spécifique
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Pour les styles avec background, ajouter un background temporaire pour la capture
          if (currentStyle === 2 || currentStyle === 3) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.01)'; // Background presque transparent pour forcer l'opacité
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          
          const fontName = getSelectedFontName();
          const fontSizeMultiplier = getFontSizeMultiplier();
          drawHookText(ctx, specificHook, {
            type: currentStyle,
            position: currentStyle === 1 ? style1Position.position : currentStyle === 2 ? style2Position.position : currentStyle === 3 ? style3Position.position : style4Position.position,
            offset: currentStyle === 1 ? style1Position.offset : currentStyle === 2 ? style2Position.offset : currentStyle === 3 ? style3Position.offset : style4Position.offset
          }, canvas.width, canvas.height, fontName, fontSizeMultiplier, false, autoCutTemplate);
        }
        
        canvas.toBlob((blob) => {
          if (blob) {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          } else {
            resolve(null);
          }
        }, 'image/png'); // PNG pour supporter la transparence
      } else {
        resolve(null);
      }
    });
  };

  // Remplaçons la fonction de dessin du hook pour s'assurer que le style est correctement appliqué
  useEffect(() => {
    const drawCanvas = async () => {
      if (fontsLoaded && canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size to match video dimensions (1080x1920)
        canvas.width = 1080;
        canvas.height = 1920;

        // Clear previous content
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Ne dessiner le hook que s'il y a du texte
        const hookText = getFirstHook();
        if (hookText.trim() !== "") {
          console.log("Using style for preview:", currentStyle);
          const fontName = getSelectedFontName();
          console.log("Using font for preview:", fontName);
          // Force font loading before drawing - wait for font to be available
          await document.fonts.ready;
          ctx.font = `${Math.floor(canvas.width * 0.07)}px "${fontName}", sans-serif`;

          // Draw hook text using shared function
          const fontSizeMultiplier = getFontSizeMultiplier();
          drawHookText(ctx, hookText, {
            type: currentStyle,
            position: currentStyle === 1 ? style1Position.position : currentStyle === 2 ? style2Position.position : currentStyle === 3 ? style3Position.position : style4Position.position,
            offset: currentStyle === 1 ? style1Position.offset : currentStyle === 2 ? style2Position.offset : currentStyle === 3 ? style3Position.offset : style4Position.offset
          }, canvas.width, canvas.height, fontName, fontSizeMultiplier, false, autoCutTemplate);
        }
      }
    };
    
    drawCanvas();
  }, [fontsLoaded, currentStyle, style1Position, style2Position, style3Position, style4Position, hooks, selectedTemplate, selectedFonts, fontSize, randomFontSize, randomPosition, autoCutTemplate]);

  // Charger les musiques de l'utilisateur
  useEffect(() => {
    const loadUserSongs = async () => {
      if (!user) return;
      try {
        setIsLoadingSongs(true);
        // Utiliser le cache s'il existe
        const cachedSongs = useVideoStore.getState().cachedSongs;
        if (cachedSongs.length > 0) {
          setSongs(cachedSongs);
          setIsLoadingSongs(false);
          return;
        }

        // Sinon charger depuis Supabase
        const userSongs = await getUserSongs(user.id);
        setSongs(userSongs);
        // Mettre en cache
        useVideoStore.getState().setCachedSongs(userSongs);
        
        // Restaurer la chanson sélectionnée depuis l'ID sauvegardé
        if (savedState.selectedSongId) {
          const savedSong = userSongs.find(s => s.id === savedState.selectedSongId);
          if (savedSong) setSelectedSong(savedSong);
        }
      } catch (error) {
        console.error('Error loading songs:', error);
      } finally {
        setIsLoadingSongs(false);
      }
    };

    loadUserSongs();
  }, [user]);

  // Auto-configure settings for Add Hook model
  useEffect(() => {
    if (selectedModel === 'add-hook') {
      // Force TikTok font only
      setSelectedFonts(['tiktok']);
      // Set default style to White (style 2) if current style is not White or Black
      if (currentStyle !== 2 && currentStyle !== 3) {
        setSelectedStyles(new Set([2]));
        setCurrentStyle(2);
      }
    }
  }, [selectedModel]);

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'video/*': ['.mp4', '.mov', '.avi'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif']
    },
    maxFiles: 50,
    onDrop: (acceptedFiles) => {
      // Process each media file to get its duration/dimensions and create a preview URL
      const processMedias = async () => {
        const newMedias: SelectedMedia[] = [];
        
        for (const file of acceptedFiles) {
          const url = URL.createObjectURL(file);
          
          if (file.type.startsWith('video/')) {
            // Process video
            const video = document.createElement('video');
            video.src = url;
            
            const videoData = await new Promise<{duration: number, width: number, height: number}>((resolve) => {
              video.onloadedmetadata = () => {
                resolve({
                  duration: video.duration,
                  width: video.videoWidth,
                  height: video.videoHeight
                });
              };
              setTimeout(() => resolve({
                duration: 5,
                width: 1080,
                height: 1920
              }), 1000);
            });
            
            const aspectRatio = videoData.width / videoData.height;
            const isCorrectRatio = Math.abs(aspectRatio - 0.5625) < 0.05;
            
            newMedias.push({
              file,
              type: 'video',
              duration: videoData.duration,
              url,
              aspectRatio,
              isCorrectRatio
            });
          } else if (file.type.startsWith('image/')) {
            // Process image
            const imageData = await new Promise<{width: number, height: number}>((resolve) => {
              const img = document.createElement('img');
              img.onload = () => {
                resolve({
                  width: img.width,
                  height: img.height
                });
              };
              img.src = url;
            });
            
            const aspectRatio = imageData.width / imageData.height;
            const isCorrectRatio = Math.abs(aspectRatio - 0.5625) < 0.05;
            
            newMedias.push({
              file,
              type: 'image',
              duration: 5,
              url,
              aspectRatio,
              isCorrectRatio
            });
          }
        }
        
        setSelectedMedias(prev => [...prev, ...newMedias].slice(0, 50));
        
        setTimeout(() => {
          newMedias.forEach((media, index) => {
            if (media.type === 'video') {
              const videoIndex = index + selectedMedias.length;
              const videoElement = document.getElementById(`video-${videoIndex}`) as HTMLVideoElement;
              if (videoElement) {
                videoElement.play().catch(err => {
                  console.log('Auto-play prevented:', err);
                });
              }
            }
          });
        }, 500);
      };
      
      processMedias();
    }
  });

  // useDropzone pour Auto Lyrics - Before Refrain
  const { getRootProps: getRootPropsBeforeRefrain, getInputProps: getInputPropsBeforeRefrain } = useDropzone({
    accept: {
      'video/*': ['.mp4', '.mov', '.avi'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif']
    },
    maxFiles: 50,
    onDrop: (acceptedFiles) => {
      const processMedias = async () => {
        const newMedias: SelectedMedia[] = [];
        for (const file of acceptedFiles) {
          const url = URL.createObjectURL(file);
          if (file.type.startsWith('video/')) {
            const video = document.createElement('video');
            video.src = url;
            const videoData = await new Promise<{duration: number}>((resolve) => {
              video.onloadedmetadata = () => resolve({ duration: video.duration });
              setTimeout(() => resolve({ duration: 5 }), 1000);
            });
            newMedias.push({ file, type: 'video', duration: videoData.duration, url, aspectRatio: 0.5625, isCorrectRatio: true });
          } else if (file.type.startsWith('image/')) {
            newMedias.push({ file, type: 'image', duration: 5, url, aspectRatio: 0.5625, isCorrectRatio: true });
          }
        }
        setSelectedMediasBeforeRefrain(prev => [...prev, ...newMedias].slice(0, 50));
        setSelectedMediaIndexesBeforeRefrain(new Set(Array.from({length: selectedMediasBeforeRefrain.length + newMedias.length}, (_, i) => i)));
      };
      processMedias();
    }
  });

  // useDropzone pour Auto Lyrics - After Refrain
  const { getRootProps: getRootPropsAfterRefrain, getInputProps: getInputPropsAfterRefrain } = useDropzone({
    accept: {
      'video/*': ['.mp4', '.mov', '.avi'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif']
    },
    maxFiles: 50,
    onDrop: (acceptedFiles) => {
      const processMedias = async () => {
        const newMedias: SelectedMedia[] = [];
        for (const file of acceptedFiles) {
          const url = URL.createObjectURL(file);
          if (file.type.startsWith('video/')) {
            const video = document.createElement('video');
            video.src = url;
            const videoData = await new Promise<{duration: number}>((resolve) => {
              video.onloadedmetadata = () => resolve({ duration: video.duration });
              setTimeout(() => resolve({ duration: 5 }), 1000);
            });
            newMedias.push({ file, type: 'video', duration: videoData.duration, url, aspectRatio: 0.5625, isCorrectRatio: true });
          } else if (file.type.startsWith('image/')) {
            newMedias.push({ file, type: 'image', duration: 5, url, aspectRatio: 0.5625, isCorrectRatio: true });
          }
        }
        setSelectedMediasAfterRefrain(prev => [...prev, ...newMedias].slice(0, 50));
        setSelectedMediaIndexesAfterRefrain(new Set(Array.from({length: selectedMediasAfterRefrain.length + newMedias.length}, (_, i) => i)));
      };
      processMedias();
    }
  });

  // Limiter à 2 templates maximum : le template par défaut et le dernier template téléchargé
  const lastUploadedTemplate = templates.length > 0 ? [templates[templates.length - 1]] : [];

  const handlePlayPause = (song: UserSong) => {
    if (currentlyPlaying === song.id) {
      // Si la même chanson est en cours de lecture, on la met en pause
      audioRef.current?.pause();
      setCurrentlyPlaying(null);
    } else {
      // Si une autre chanson est en cours de lecture, on l'arrête
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      // On crée un nouvel élément audio pour la nouvelle chanson
      const audio = new Audio(song.url);
      audioRef.current = audio;
      
      // On ajoute un gestionnaire pour quand la chanson se termine
      audio.onended = () => {
        setCurrentlyPlaying(null);
      };
      
      // On lance la lecture
      audio.play();
      setCurrentlyPlaying(song.id);
    }
  };

  // Nettoyer l'audio quand le composant est démonté
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const toggleMediaSelection = (index: number) => {
    const newSelection = new Set(selectedMediaIndexes);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedMediaIndexes(newSelection);
  };

  const toggleAllMedias = () => {
    if (selectedMediaIndexes.size === selectedMedias.length) {
      setSelectedMediaIndexes(new Set());
    } else {
      setSelectedMediaIndexes(new Set(selectedMedias.map((_, i) => i)));
    }
  };

  // Handlers pour Auto Lyrics - Before Refrain
  const toggleMediaSelectionBeforeRefrain = (index: number) => {
    const newSelection = new Set(selectedMediaIndexesBeforeRefrain);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedMediaIndexesBeforeRefrain(newSelection);
  };

  const toggleAllMediasBeforeRefrain = () => {
    if (selectedMediaIndexesBeforeRefrain.size === selectedMediasBeforeRefrain.length) {
      setSelectedMediaIndexesBeforeRefrain(new Set());
    } else {
      setSelectedMediaIndexesBeforeRefrain(new Set(selectedMediasBeforeRefrain.map((_, i) => i)));
    }
  };

  // Handlers pour Auto Lyrics - After Refrain
  const toggleMediaSelectionAfterRefrain = (index: number) => {
    const newSelection = new Set(selectedMediaIndexesAfterRefrain);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedMediaIndexesAfterRefrain(newSelection);
  };

  const toggleAllMediasAfterRefrain = () => {
    if (selectedMediaIndexesAfterRefrain.size === selectedMediasAfterRefrain.length) {
      setSelectedMediaIndexesAfterRefrain(new Set());
    } else {
      setSelectedMediaIndexesAfterRefrain(new Set(selectedMediasAfterRefrain.map((_, i) => i)));
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === 'string') {
          setHooks(text);
        }
      };
      reader.readAsText(file);
    }
  };

  const extractLyricsFromAudio = async () => {
    if (!selectedSong || selectedSong.id === 'no-music') {
      toast.error('Veuillez sélectionner une musique d\'abord');
      return;
    }

    // Vérifier d'abord si les lyrics sont déjà sauvegardées
    if (selectedSong.lyrics) {
      console.log('[Extract Lyrics] Using saved lyrics from database');
      const lyricsData = selectedSong.lyrics;
      setExtractedLyrics(lyricsData.lyrics);
      setHooks(lyricsData.lyrics);
      if (lyricsData.words) {
        setWordTimestamps(lyricsData.words);
      }
      toast.success('Paroles chargées depuis la base de données !');
      return;
    }

    setIsExtractingLyrics(true);
    toast.info('Extraction des paroles en cours...');

    try {
      // Télécharger le fichier audio depuis l'URL
      const audioResponse = await fetch(selectedSong.url);
      const audioBlob = await audioResponse.blob();

      // Créer un FormData avec le fichier audio et le songId
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.mp3');
      formData.append('songId', selectedSong.id);

      // Appeler l'API d'extraction de paroles
      const response = await fetch('/api/extract-lyrics', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Échec de l\'extraction des paroles');
      }

      const data = await response.json();

      if (data.success && data.lyrics) {
        setExtractedLyrics(data.lyrics);
        setHooks(data.lyrics); // Mettre les paroles dans le champ de texte

        // Stocker les timestamps mot par mot
        if (data.words) {
          setWordTimestamps(data.words);
        }

        toast.success('Paroles extraites et sauvegardées avec succès !');
      } else {
        throw new Error('Aucune parole trouvée');
      }
    } catch (error: any) {
      console.error('Erreur extraction paroles:', error);
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setIsExtractingLyrics(false);
    }
  };

  const handleSaveLyrics = () => {
    setLyricsSaveStatus('saving');

    // Forcer la sauvegarde dans localStorage
    if (user && isClient) {
      try {
        const currentState = localStorage.getItem(`create-video-form-${user.id}`);
        if (currentState) {
          const parsedState = JSON.parse(currentState);
          parsedState.wordTimestamps = wordTimestamps;
          localStorage.setItem(`create-video-form-${user.id}`, JSON.stringify(parsedState));
        }
      } catch (e) {
        console.error('Error saving lyrics:', e);
      }
    }

    // Afficher le feedback "Saved"
    setTimeout(() => {
      setLyricsSaveStatus('saved');
      setTimeout(() => {
        setLyricsSaveStatus('idle');
      }, 2000);
    }, 300);
  };

  const handleTemplateImagePosition = (position: 'top' | 'center' | 'bottom', e: React.MouseEvent) => {
    e.stopPropagation();
    setTemplateImagePosition(position);
  };

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let retryCount = 0;
    const maxRetries = 5;
    const baseRetryDelay = 1000;
    let retryTimeout: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
      }
    };

    const connectSSE = () => {
      // Skip SSE in production as it's not supported on Render
      if (process.env.NODE_ENV === 'production') {
        console.log('SSE disabled in production');
        return;
      }

      cleanup();

      try {
      console.log('Connecting to SSE...');
        eventSource = new EventSource('/api/progress', {
          withCredentials: false
        });

      eventSource.onopen = () => {
        console.log('SSE connection opened successfully');
          retryCount = 0; // Reset retry count on successful connection
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
            if (typeof data.progress === 'number') {
            setProgress(data.progress);
          }
        } catch (error) {
          console.error('Error parsing SSE data:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
          cleanup();

          if (retryCount < maxRetries) {
            const delay = Math.min(
              baseRetryDelay * Math.pow(2, retryCount) + Math.random() * 1000,
              10000
            );
            retryCount++;
            console.log(
              `Attempting to reconnect in ${Math.round(delay/1000)} seconds... (Attempt ${retryCount}/${maxRetries})`
            );
            retryTimeout = setTimeout(connectSSE, delay);
          } else {
            console.error('Max retry attempts reached. Please refresh the page to reconnect.');
          }
        };
      } catch (error) {
        console.error('Error creating EventSource:', error);
        if (retryCount < maxRetries) {
          retryTimeout = setTimeout(connectSSE, baseRetryDelay);
        }
      }
    };

    // Initial connection
    connectSSE();

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up SSE connection');
      cleanup();
    };
  }, []);

  // Fonction utilitaire pour convertir un blob/fichier en base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Fonction utilitaire pour convertir une URL en blob
  const urlToBlob = async (url: string): Promise<Blob> => {
    const response = await fetch(url);
    return response.blob();
  };

  // Récupérer l'état de génération sauvegardé au chargement de la page
  useEffect(() => {
    const savedState = loadGenerationState();
    if (savedState && savedState.isGenerating) {
      // Restaurer l'état de génération
      setIsGenerating(savedState.isGenerating);
      setProgress(savedState.progress);
      setGeneratedVideos(savedState.generatedVideos);
      setGeneratedCount(savedState.generatedCount);
      setTotalToGenerate(savedState.totalToGenerate);
      setCurrentHookIndex(savedState.currentHookIndex);
      setCurrentMediaIndex(savedState.currentMediaIndex);
      
      // Si la génération était en cours, proposer de la reprendre
      if (savedState.isGenerating && savedState.generatedCount < savedState.totalToGenerate) {
        const shouldResume = window.confirm(
          `La génération de vidéos a été interrompue (${savedState.generatedCount}/${savedState.totalToGenerate} terminées). Voulez-vous reprendre la génération?`
        );
        
        if (shouldResume) {
          // Utiliser un timeout pour s'assurer que tous les états sont bien chargés
          setTimeout(() => {
            handleResumeGeneration();
          }, 1000);
        } else {
          // Si l'utilisateur refuse, nettoyer l'état
          clearGenerationState();
          setIsGenerating(false);
        }
      }
    }
  }, []);

  // Définir la fonction handleResumeGeneration
  const handleResumeGeneration = async () => {
    try {
      const savedState = loadGenerationState();
      if (!savedState) {
        toast.error("État de génération perdu. Veuillez recommencer.");
        setIsGenerating(false);
        return;
      }
      
      // Vérifier que tous les éléments nécessaires sont disponibles
      if (!selectedTemplate || selectedMedias.length === 0 || !selectedSong || !hooks) {
        toast.error("Impossible de reprendre la génération. Certains éléments sont manquants.");
        setIsGenerating(false);
        clearGenerationState();
        return;
      }
      
      // Récupérer le template sélectionné
      const selectedTemplateObj = templates.find(t => t.id === selectedTemplate);
      if (!selectedTemplateObj) {
        toast.error("Template non trouvé.");
        setIsGenerating(false);
        clearGenerationState();
        return;
      }
      
      // Logique similaire à handleCreateVideos mais en reprenant à l'indice sauvegardé
      let templateUrl = selectedTemplateObj.url;
      let templateType = selectedTemplateObj.type || "image";
      
      // ... Préparer les données comme dans handleCreateVideos
      
      // Extraire les hooks (lignes non vides)
      const hookLines = hooks
        .split("\n")
        .map(h => h.trim())
        .filter(h => h && h !== "Enter your hook here or load from a text file..");
      
      if (hookLines.length === 0) {
        toast.error("Veuillez entrer au moins un hook valide.");
        setIsGenerating(false);
        clearGenerationState();
        return;
      }
      
      // Préparer les médias (Part 2)
      const selectedMediasList = Array.from(selectedMediaIndexes).map(index => selectedMedias[index]);
      
      // Préparer les informations sur la musique (pas d'upload pour économiser le quota)
      const songInfo = {
        id: selectedSong?.id || 'no-music',
        url: selectedSong?.url || ''
      };
      
      // Reprendre la génération à partir des indices sauvegardés
      let count = savedState.generatedCount;
      
      toast.success(`Reprise de la génération à partir de la vidéo ${count+1}/${savedState.totalToGenerate}`);
      
      // Reprendre à partir du point d'interruption
      for (let i = savedState.currentHookIndex; i < hookLines.length; i++) {
        setCurrentHookIndex(i);
        
        // Déterminer l'indice de départ pour la boucle interne
        const startJ = i === savedState.currentHookIndex ? savedState.currentMediaIndex : 0;
        
        for (let j = startJ; j < selectedMediasList.length; j++) {
          setCurrentMediaIndex(j);
          
          // ... Logique de génération des vidéos, similaire à handleCreateVideos
          
          // Mettre à jour l'état de génération
          saveGenerationState({
            isGenerating: true,
            progress: Math.round((count / savedState.totalToGenerate) * 100),
            generatedVideos,
            generatedCount: count,
            totalToGenerate: savedState.totalToGenerate,
            currentHookIndex: i,
            currentMediaIndex: j
          });
          
          // Incrémenter le compteur après chaque vidéo générée
          count++;
          setGeneratedCount(count);
          setProgress(Math.round((count / savedState.totalToGenerate) * 100));
        }
      }
      
      // Une fois terminé, effacer l'état sauvegardé
      clearGenerationState();
      setProgress(100);
      
      // Déclencher l'animation de fin
      setShowCompletionAnimation(true);
      setTimeout(() => {
        setShowCompletionAnimation(false);
        setGenerationComplete(true);
      }, 2000); // Animation pendant 2 secondes
      
      // Ne pas réinitialiser les champs après la génération des vidéos
      // car cela empêche l'affichage du popup de téléchargement
      // resetFormFields();
    } catch (error) {
      console.error('Erreur lors de la reprise de la génération:', error);
      toast.error("Une erreur est survenue lors de la reprise de la génération");
    } finally {
      setIsGenerating(false);
    }
  };

  // Modifier la fonction handleCreateVideos
  const handleCreateVideos = async () => {
    try {
      setIsGenerating(true);
      setProgress(PROGRESS_STEPS.INIT);
      setGeneratedVideos([]);
      setCurrentHookIndex(0);
      setCurrentMediaIndex(0);
      
      // Vérifier selon le modèle
      const isVersusMode = selectedModel === 'versus';
      const isMaxCombinaisonsMode = selectedModel === 'fein-clipper';
      const isCreedStreamerMode = selectedModel === 'creed-streamer';
      const isTwainYaGamilaMode = selectedModel === 'twain-ya-gamila';
      const isAddHookMode = selectedModel === 'add-hook';
      
      if (isMaxCombinaisonsMode) {
        // Vérifier que toutes les parties ont au moins une vidéo (sauf le logo qui est optionnel)
        const partsArray = [
          maxCombinaisonsParts.part1,
          maxCombinaisonsParts.part2,
          maxCombinaisonsParts.part3,
          maxCombinaisonsParts.part4,
          maxCombinaisonsParts.part5,
          maxCombinaisonsParts.part6,
          maxCombinaisonsParts.part7,
          maxCombinaisonsParts.part8,
          maxCombinaisonsParts.part9,
          maxCombinaisonsParts.part10
        ];
        
        const missingParts = partsArray.some(part => part.length === 0);
        if (missingParts) {
          toast.error("Please add at least 1 video for each part (1 to 10).");
          setIsGenerating(false);
          return;
        }
        if (!selectedSong) {
          toast.error("Please select a music track or choose 'Without music'.");
          setIsGenerating(false);
          return;
        }
      } else if (isTwainYaGamilaMode && autoCutTemplate !== 'auto-lyrics') {
        // Validation pour AutoCut (sauf Auto Lyrics qui a sa propre validation)
        if (!twainYaGamilaState.collection) {
          toast.error('Please select a collection');
          setIsGenerating(false);
          return;
        }

        if (!selectedSong) {
          toast.error('Please select a music track or choose \'Without music\'');
          setIsGenerating(false);
          return;
        }

        const hasEnoughImages = (twainYaGamilaState.collection.images?.length || 0) >= 22;
        const hasEnoughVideos = (twainYaGamilaState.collection.videos?.length || 0) >= 1;

        if (!hasEnoughImages && !hasEnoughVideos) {
          const imageCount = twainYaGamilaState.collection.images?.length || 0;
          const videoCount = twainYaGamilaState.collection.videos?.length || 0;
          toast.error(`Collection needs at least 22 images or 1 video (has ${imageCount} images, ${videoCount} videos)`);
          setIsGenerating(false);
          return;
        }
      } else if (isAddHookMode) {
        // Validation pour Add Hook (simplifié depuis AutoCut)
        if (!twainYaGamilaState.collection) {
          toast.error('Please select a collection');
          setIsGenerating(false);
          return;
        }
        
        // Pas besoin de musique pour Add Hook
        
        const hasImages = (twainYaGamilaState.collection.images?.length || 0) >= 1;
        const hasVideos = (twainYaGamilaState.collection.videos?.length || 0) >= 1;
        
        if (!hasImages && !hasVideos) {
          const imageCount = twainYaGamilaState.collection.images?.length || 0;
          const videoCount = twainYaGamilaState.collection.videos?.length || 0;
          toast.error(`Collection needs at least 1 image or 1 video (has ${imageCount} images, ${videoCount} videos)`);
          setIsGenerating(false);
          return;
        }
      } else if (isCreedStreamerMode) {
        // Vérifier que toutes les 11 parties ont au moins une vidéo (sauf le logo qui est optionnel)
        const partsArray = [
          creedStreamerParts.part1,
          creedStreamerParts.part2,
          creedStreamerParts.part3,
          creedStreamerParts.part4,
          creedStreamerParts.part5,
          creedStreamerParts.part6,
          creedStreamerParts.part7,
          creedStreamerParts.part8,
          creedStreamerParts.part9,
          creedStreamerParts.part10,
          creedStreamerParts.part11
        ];
        
        const missingParts = partsArray.some(part => part.length === 0);
        if (missingParts) {
          toast.error("Please add at least 1 video for each part (1 to 11).");
          setIsGenerating(false);
          return;
        }
        if (!selectedSong) {
          toast.error("Please select a music track or choose 'Without music'.");
          setIsGenerating(false);
          return;
        }
      } else if (isVersusMode) {
        // Valider uniquement les parts activées
        const requiredMissing = (
          (versusEnabled.arrivesStadium && versusParts.arrivesStadium.length === 0) ||
          (versusEnabled.training && versusParts.training.length === 0) ||
          (versusEnabled.entry && versusParts.entry.length === 0) ||
          (versusEnabled.lineup && versusParts.lineup.length === 0) ||
          (versusEnabled.faceCam && versusParts.faceCam.length === 0) ||
          (versusEnabled.skills && versusParts.skills.length === 0) ||
          (versusEnabled.goals && versusParts.goals.length === 0) ||
          (versusEnabled.celebrations && versusParts.celebrations.length === 0)
        );
        if (requiredMissing) {
          toast.error("Please add at least 1 video for each enabled part.");
          setIsGenerating(false);
          return;
        }
        if (!selectedSong) {
          toast.error("Please select a music track or choose 'Without music'.");
          setIsGenerating(false);
          return;
        }
      }

      // Validation spéciale pour Auto Lyrics
      if (autoCutTemplate === 'auto-lyrics') {
        if (!wordTimestamps || wordTimestamps.length === 0) {
          toast.error("Please detect lyrics first using the 'Detect Lyrics' button.");
          setIsGenerating(false);
          return;
        }
        if (!collectionBeforeRefrain) {
          toast.error(useOneCollection ? "Please select a collection." : "Please select both Before and After Refrain collections.");
          setIsGenerating(false);
          return;
        }
        if (!useOneCollection && !collectionAfterRefrain) {
          toast.error("Please select both Before and After Refrain collections.");
          setIsGenerating(false);
          return;
        }
        if ((collectionBeforeRefrain?.videos?.length || 0) === 0) {
          toast.error(useOneCollection ? "Collection must contain at least 1 video." : "Before Refrain collection must contain at least 1 video.");
          setIsGenerating(false);
          return;
        }
        if (!useOneCollection && (collectionAfterRefrain?.videos?.length || 0) === 0) {
          toast.error("After Refrain collection must contain at least 1 video.");
          setIsGenerating(false);
          return;
        }
      } else if (!isVersusMode && !isTwainYaGamilaMode) {
        if (!hooks || hooks.trim() === "" || hooks === "Enter your hook here or load from a text file..") {
          toast.error("Veuillez entrer au moins un hook.");
          setIsGenerating(false);
          return;
        }
      }

      
      // Extraire les hooks (lignes non vides)
      const hookLines = hooks
        .split("\n")
        .map(h => h.trim())
        .filter(h => h && h !== "Enter your hook here or load from a text file..");
      // Les hooks peuvent être vides en Versus et AutoCut (pas d'overlay si vide)
      if (!isVersusMode && !isTwainYaGamilaMode && hookLines.length === 0) {
        toast.error("Veuillez entrer au moins un hook valide.");
        setIsGenerating(false);
        return;
      }
      
      setProgress(PROGRESS_STEPS.MEDIA_PREP);
      
      // Fonction pour générer des paramètres variés pour chaque vidéo (timing en millisecondes)
      const generateVideoParameters = (videoIndex: number, totalVideos: number) => {
        if (!enableVariation) {
          return {
            imageTiming: Math.round((imageTimingMin + imageTimingMax) / 2), // Moyenne en ms
            imageCount: Math.round((imageCountMin + imageCountMax) / 2) // Moyenne
          };
        }
        
        // Générer des valeurs ultra-variées basées sur l'index de la vidéo
        const timingRange = imageTimingMax - imageTimingMin;
        const countRange = imageCountMax - imageCountMin;
        
        // Utiliser une distribution variée basée sur l'index avec chaos contrôlé
        const ratio = totalVideos > 1 ? videoIndex / (totalVideos - 1) : 0.5;
        
        // Ajouter du chaos pour l'originalité TikTok (variation de ±30%)
        const chaosOffset = (Math.random() - 0.5) * 0.6; // ±30% de variation
        const finalRatio = Math.max(0, Math.min(1, ratio + chaosOffset));
        
        // Ajouter des micro-variations pour que chaque timing soit unique
        const microChaos = Math.floor((Math.random() - 0.5) * 50); // ±25ms de chaos
        
        return {
          imageTiming: Math.round(imageTimingMin + (timingRange * finalRatio) + microChaos),
          imageCount: Math.round(imageCountMin + (countRange * finalRatio))
        };
      };
      
      // Déterminer le nombre de vidéos à générer
      let totalVideos = hookLines.length;
      let versusCombos: File[][] = [];
      let maxCombinaisonsCombos: File[][] = [];
      let creedStreamerCombos: File[][] = [];
      
      // Fonction pour générer des combinaisons intelligentes qui maximisent la variation
      function generateSmartCombinations(arrays: File[][], count: number): File[][] {
        const result: File[][] = [];
        const usedCombinations = new Set<string>();
        
        // Helper pour créer une clé unique pour une combinaison
        const getCombinationKey = (combo: File[]) => combo.map(f => f.name).join('|');
        
        // Si on demande plus de vidéos que de combinaisons possibles
        const maxPossible = arrays.reduce((acc, arr) => acc * arr.length, 1);
        const targetCount = Math.min(count, maxPossible);
        
        // Stratégie: prioritiser la variation dans les parties les plus importantes
        // Ordre de priorité: Part 1, Part 10, Part 9, puis 2-8
        const priorityIndices = [0, 9, 8, 1, 2, 3, 4, 5, 6, 7];
        
        // Générer les combinaisons
        let attempts = 0;
        const maxAttempts = targetCount * 100;
        
        while (result.length < targetCount && attempts < maxAttempts) {
          attempts++;
          const combo: File[] = [];
          
          // Pour chaque partie, sélectionner un élément
          for (let i = 0; i < arrays.length; i++) {
            const partArray = arrays[i];
            if (partArray.length === 0) continue;
            
            // Pour les premières vidéos, maximiser la variation sur les parties prioritaires
            let index: number;
            if (result.length < partArray.length * 2 && priorityIndices.includes(i)) {
              // Utiliser une distribution qui favorise la variation
              const priorityIndex = priorityIndices.indexOf(i);
              const cycleLength = partArray.length;
              index = (result.length + priorityIndex) % cycleLength;
            } else {
              // Sélection aléatoire pour les autres cas
              index = Math.floor(Math.random() * partArray.length);
            }
            
            combo.push(partArray[index]);
          }
          
          // Vérifier l'unicité
          const key = getCombinationKey(combo);
          if (!usedCombinations.has(key)) {
            usedCombinations.add(key);
            result.push(combo);
          }
        }
        
        return result;
      }
      
      if (isMaxCombinaisonsMode) {
        // Générer des combinaisons intelligentes pour FE!N clipper
        const partsArrays = [
          maxCombinaisonsParts.part1,
          maxCombinaisonsParts.part2,
          maxCombinaisonsParts.part3,
          maxCombinaisonsParts.part4,
          maxCombinaisonsParts.part5,
          maxCombinaisonsParts.part6,
          maxCombinaisonsParts.part7,
          maxCombinaisonsParts.part8,
          maxCombinaisonsParts.part9,
          maxCombinaisonsParts.part10
        ];
        
        // Utiliser le nombre de vidéos demandé par l'utilisateur
        maxCombinaisonsCombos = generateSmartCombinations(partsArrays, videosToCreate);
        totalVideos = maxCombinaisonsCombos.length;
        console.log(`Génération de ${totalVideos} vidéos FE!N avec combinaisons intelligentes`);
      } else if (isTwainYaGamilaMode) {
        // Génération pour AutoCut
        totalVideos = twainYaGamilaState.videosToGenerate;
        console.log(`Génération de ${totalVideos} vidéos AutoCut`);
      } else if (isAddHookMode) {
        // Génération pour Add Hook - une seule requête API qui traite le nombre d'images spécifié
        totalVideos = 1; // Une seule requête API
        console.log(`Add Hook: traitement de ${twainYaGamilaState.videosToGenerate} images`);
      } else if (isCreedStreamerMode) {
        // Générer des combinaisons intelligentes pour Creed Streamer (11 parties)
        const partsArrays = [
          creedStreamerParts.part1,
          creedStreamerParts.part2,
          creedStreamerParts.part3,
          creedStreamerParts.part4,
          creedStreamerParts.part5,
          creedStreamerParts.part6,
          creedStreamerParts.part7,
          creedStreamerParts.part8,
          creedStreamerParts.part9,
          creedStreamerParts.part10,
          creedStreamerParts.part11
        ];
        
        // Utiliser le nombre de vidéos demandé par l'utilisateur
        creedStreamerCombos = generateSmartCombinations(partsArrays, videosToCreate);
        totalVideos = creedStreamerCombos.length;
        console.log(`Génération de ${totalVideos} vidéos Creed Streamer avec combinaisons intelligentes`);
      } else if (isVersusMode) {
        const A = versusParts.arrivesStadium;
        const B = versusParts.training;
        const C = versusParts.entry;
        const D = versusParts.lineup;
        const F = versusParts.faceCam;
        const S = versusParts.skills;
        const G = versusParts.goals;
        const Cc = versusParts.celebrations;

        // Générer toutes les combinaisons possibles selon la logique Versus
        if (G.length === 0) {
          versusCombos = [];
          totalVideos = 0;
        } else {
          // Logique des combinaisons versus :
          // 1. Les 5 premières parties sont FIXES dans l'ordre mais peuvent permuter à l'intérieur
          // 2. Skills & Goals peuvent permuter entre eux ET à l'intérieur
          // 3. Celebrations toujours après Goals et à la fin
          // 4. Chaque vidéo finale contient TOUTES les vidéos uploadées
          
          // Fonction pour générer toutes les permutations d'un tableau
          function generatePermutations(arr: File[]): File[][] {
            if (arr.length <= 1) return [arr];
            
            const result: File[][] = [];
            for (let i = 0; i < arr.length; i++) {
              const current = arr[i];
              const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
              const perms = generatePermutations(remaining);
              
              for (const perm of perms) {
                result.push([current, ...perm]);
              }
            }
            
            return result;
          }
          
          // Fonction pour générer toutes les permutations de skills et goals
          // avec mélange libre MAIS en gardant toujours un goal à la fin (avant celebration)
          function generateSkillsGoalsPermutations(skills: File[], goals: File[]): File[][] {
            if (goals.length === 0) return [skills];
            
            // On doit toujours garder un goal à la fin (juste avant celebration)
            // Mais tous les goals peuvent permuter pour être ce dernier goal
            const result: File[][] = [];
            
            // Pour chaque goal qui pourrait être le dernier
            for (let i = 0; i < goals.length; i++) {
              const lastGoal = goals[i];
              const otherGoals = [...goals.slice(0, i), ...goals.slice(i + 1)];
              const mixItems = [...skills, ...otherGoals];
              
              if (mixItems.length === 0) {
                // Juste le goal final
                result.push([lastGoal]);
              } else {
                // Générer toutes les permutations des autres éléments
                const mixPerms = generatePermutations(mixItems);
                for (const mixPerm of mixPerms) {
                  result.push([...mixPerm, lastGoal]);
                }
              }
            }
            
            return result;
          }
          
          // Si pas de goals, pas de vidéos possibles
          if (!versusEnabled.goals || G.length === 0) {
            versusCombos = [];
          } else {
            // Chaque partie peut permuter en interne
            const arrivesPerms = (versusEnabled.arrivesStadium && A.length > 0) ? generatePermutations(A) : [[]];
            const trainingPerms = (versusEnabled.training && B.length > 0) ? generatePermutations(B) : [[]];
            const entryPerms = (versusEnabled.entry && C.length > 0) ? generatePermutations(C) : [[]];
            const lineupPerms = (versusEnabled.lineup && D.length > 0) ? generatePermutations(D) : [[]];
            const faceCamPerms = (versusEnabled.faceCam && F.length > 0) ? generatePermutations(F) : [[]];
            
            // Skills et Goals ont un mélange libre, celebrations toujours à la fin
            const skills = (versusEnabled.skills && S.length > 0) ? S : [];
            const goals = G; // Goals est obligatoire
            const celebrations = (versusEnabled.celebrations && Cc.length > 0) ? Cc : [];
            
            // Générer toutes les permutations de skills+goals (avec un goal à la fin)
            const skillsGoalsCombos = generateSkillsGoalsPermutations(skills, goals);
            const celebrationsPerms = celebrations.length > 0 ? generatePermutations(celebrations) : [[]];
            
            // Créer toutes les combinaisons possibles
            for (const arrivesPerm of arrivesPerms) {
              for (const trainingPerm of trainingPerms) {
                for (const entryPerm of entryPerms) {
                  for (const lineupPerm of lineupPerms) {
                    for (const faceCamPerm of faceCamPerms) {
                      for (const skillsGoalsCombo of skillsGoalsCombos) {
                        for (const celebrationsPerm of celebrationsPerms) {
                          const combo: File[] = [
                            ...arrivesPerm,
                            ...trainingPerm,
                            ...entryPerm,
                            ...lineupPerm,
                            ...faceCamPerm,
                            ...skillsGoalsCombo,
                            ...celebrationsPerm
                          ];
                          versusCombos.push(combo);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          
          totalVideos = versusCombos.length;
          console.log('DEBUG: versusCombos générées:', versusCombos.length);
          console.log('DEBUG: versusCombos:', versusCombos);
        }
      }
      setTotalToGenerate(totalVideos);
      
      // Préparer les informations sur la musique (pas d'upload pour économiser le quota)
      const songInfo = {
        id: selectedSong?.id || 'no-music',
        url: selectedSong?.url || ''
      };
      
      setProgress(PROGRESS_STEPS.VIDEO_START);
      
      // Sauvegarder l'état initial de la génération
      saveGenerationState({
        isGenerating: true,
        progress: PROGRESS_STEPS.VIDEO_START,
        generatedVideos: [],
        generatedCount: 0,
        totalToGenerate: totalVideos,
        currentHookIndex: 0,
        currentMediaIndex: 0
      });
      
      let count = 0;
      
        // Si Versus: on envoie 8 parties (avec permutations des 4 premières), sinon logique actuelle
        const isVersus = selectedModel === 'versus';
        const versusCounts = [
          versusParts.arrivesStadium.length,
          versusParts.training.length,
          versusParts.entry.length,
          versusParts.lineup.length,
          versusParts.faceCam.length,
          versusParts.skills.length,
          versusParts.goals.length,
          versusParts.celebrations.length,
        ];
        const versusPossible = isVersus && versusCounts.every((n) => n > 0);

      for (let i = 0; i < totalVideos; i++) {
        setCurrentHookIndex(i);
        const mediaIndex = !isVersusMode && !isMaxCombinaisonsMode && !isCreedStreamerMode && !isTwainYaGamilaMode && !isAddHookMode && selectedMedias.length > 0 ? i % selectedMedias.length : 0;
        setCurrentMediaIndex(mediaIndex);

        // Sélection aléatoire des hooks pour éviter la répétition  
        let hook = '';
        if (hookLines.length > 0) {
          const randomSeed = Date.now() + i * 7919 + Math.random() * 10000;
          const randomIndex = Math.floor((Math.sin(randomSeed * 0.001) * 10000) % hookLines.length);
          const hookIndex = Math.abs(randomIndex);
          hook = hookLines[hookIndex];
          console.log(`🎲 Video ${i + 1} random hook selection: seed=${randomSeed}, index=${hookIndex}/${hookLines.length}`);
          console.log(`🎯 Selected hook: "${hook}"`);
        }
        const media = !isVersusMode && !isMaxCombinaisonsMode && !isCreedStreamerMode && !isTwainYaGamilaMode && !isAddHookMode ? selectedMediasData[mediaIndex] : undefined as any;
        
        // Déterminer le temps estimé de génération en fonction du type de média
        const isImage = !isVersusMode && !isMaxCombinaisonsMode && !isCreedStreamerMode && !isTwainYaGamilaMode && !isAddHookMode ? media?.type === 'image' : false;
        const isFixedPartImage = !isVersusMode && !isMaxCombinaisonsMode && !isCreedStreamerMode && !isTwainYaGamilaMode && !isAddHookMode && template ? template.type === 'image' : false;
        
        // Base de progression pour cette vidéo
        const baseProgress = 5; // Départ à 5%
        const maxProgressPerVideo = 90 / totalVideos; // Progression max pour chaque vidéo (jusqu'à 95% au total)
        
        // Première étape - Préparation (20% du temps total de la vidéo)
        const prepProgress = baseProgress + (maxProgressPerVideo * 0.2);
        setProgress(Math.round(baseProgress + (i / totalVideos * 90)));
        
        // Mettre à jour l'état de génération pour l'étape de préparation
        saveGenerationState({
          isGenerating: true,
          progress: Math.round(baseProgress + (i / totalVideos * 90)),
          generatedVideos,
          generatedCount: count,
          totalToGenerate: totalVideos,
          currentHookIndex: i,
          currentMediaIndex: mediaIndex
        });
        
        // Calculer le temps moyen des durées
        let totalDuration = 10;
        if (!isVersusMode) {
          const part1AvgDuration = (templateDurationRange.min + templateDurationRange.max) / 2;
          const part2AvgDuration = (videoDurationRange.min + videoDurationRange.max) / 2;
          totalDuration = part1AvgDuration + part2AvgDuration;
        }
        
        // Calculer le temps estimé basé sur le type de médias ET la durée des parties
        let baseEstimatedTime;
        if (isImage && isFixedPartImage) {
          baseEstimatedTime = 15000; // Temps de base pour image + image
        } else if (!isImage && !isFixedPartImage) {
          baseEstimatedTime = 45000; // Temps de base pour vidéo + vidéo
        } else {
          baseEstimatedTime = 30000; // Temps de base pour image + vidéo ou vidéo + image
        }
        
        // Ajuster le temps estimé en fonction de la durée totale (en supposant 10s comme référence)
        const durationFactor = totalDuration / 10; // Facteur d'ajustement basé sur 10s de référence
        const estimatedTime = Math.round(baseEstimatedTime * durationFactor);
        
        // Afficher l'estimation dans la console pour le développement
          console.log(`Génération vidéo ${i+1}/${totalVideos}:`, { totalDuration, baseEstimatedTime, estimatedTime });
        
        // Progression graduelle pendant le temps estimé de génération
        const startTime = Date.now();
        const progressInterval = setInterval(() => {
          const elapsedTime = Date.now() - startTime;
          const progressRatio = Math.min(elapsedTime / estimatedTime, 0.95); // Max 95% de la progression pour cette vidéo
          
          // Calculer la progression actuelle pour cette vidéo
          const currentVideoProgress = baseProgress + (maxProgressPerVideo * progressRatio);
          const overallProgress = Math.round(baseProgress + (i / totalVideos * 90) + (maxProgressPerVideo * progressRatio));
          
          // Ne pas dépasser 95% de progression totale
          const safeProgress = Math.min(overallProgress, 95);
          
          setProgress(safeProgress);
          
          // Mettre à jour l'état de génération pendant la progression
          saveGenerationState({
            isGenerating: true,
            progress: safeProgress,
            generatedVideos,
            generatedCount: count,
            totalToGenerate: totalVideos,
            currentHookIndex: i,
            currentMediaIndex: mediaIndex
          });
          
        }, 500); // Mise à jour toutes les 500ms
        
          // Préparer les données pour l'API
          let data: any;
          if (isMaxCombinaisonsMode) {
            const combo = maxCombinaisonsCombos[i];
            // Utiliser les URLs existantes ou uploader vers Supabase
            console.log(`Préparation des parties FE!N...`);
            const partsDataUrls = await Promise.all(combo.map(async (f, idx) => {
              // Si le fichier a déjà une URL de clip (chargé depuis la bibliothèque), l'utiliser directement
              if ((f as any).clipUrl && typeof (f as any).clipUrl === 'string') {
                console.log(`Partie ${idx + 1}: utilisation de l'URL existante - ${(f as any).clipUrl}`);
                return {
                  url: (f as any).clipUrl,
                  type: 'video',
                };
              }
              // Sinon, uploader vers Supabase
              const resourceType = f.type?.startsWith('video/') ? 'video' : 'image';
              console.log(`Upload partie ${idx + 1}/${combo.length}...`);
              const url = await uploadToSupabase(f, resourceType);
              return {
                url,
                type: f.type?.startsWith('video/') ? 'video' : 'image',
              };
            }));

            // Préparer le logo si présent
            let logoData = null;
            if (maxCombinaisonsParts.logo.length > 0) {
              console.log('Préparation du logo...');
              // Convertir le fichier logo en data URL
              const logoFile = maxCombinaisonsParts.logo[0];
              const logoDataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(logoFile);
              });
              
              // Convertir la position du logo pour l'API
              let apiLogoPosition: 'top' | 'middle' | 'bottom' = 'top';
              let horizontalPosition: 'left' | 'center' | 'right' = 'center';
              
              if (logoPosition === 'top-left') {
                apiLogoPosition = 'top';
                horizontalPosition = 'left';
              } else if (logoPosition === 'top-right') {
                apiLogoPosition = 'top';
                horizontalPosition = 'right';
              } else if (logoPosition === 'center') {
                apiLogoPosition = 'middle';
                horizontalPosition = 'center';
              } else if (logoPosition === 'bottom-left') {
                apiLogoPosition = 'bottom';
                horizontalPosition = 'left';
              } else if (logoPosition === 'bottom-right') {
                apiLogoPosition = 'bottom';
                horizontalPosition = 'right';
              }
              
              logoData = {
                url: logoDataUrl,
                size: logoSize,
                position: apiLogoPosition,
                horizontalPosition: horizontalPosition
              };
              
              console.log('Logo data being sent:', {
                size: logoSize,
                position: apiLogoPosition,
                horizontalPosition: horizontalPosition,
                originalPosition: logoPosition
              });
            }
            
            // Capturer l'image exacte du hook preview avec le hook spécifique
            const hookImageDataUrl = await captureHookImage(hook);
            
            // Générer les paramètres pour cette vidéo
            const videoParams = generateVideoParameters(i, totalVideos);
            
            data = {
              hook: hookImageDataUrl ? {
                imageUrl: hookImageDataUrl,
                position: currentStyle === 1 ? style1Position.position : currentStyle === 2 ? style2Position.position : currentStyle === 3 ? style3Position.position : style4Position.position,
                offset: currentStyle === 1 ? style1Position.offset : currentStyle === 2 ? style2Position.offset : currentStyle === 3 ? style3Position.offset : style4Position.offset
              } : {
                text: hook,
                style: currentStyle,
                position: currentStyle === 1 ? style1Position.position : currentStyle === 2 ? style2Position.position : currentStyle === 3 ? style3Position.position : style4Position.position,
                offset: currentStyle === 1 ? style1Position.offset : currentStyle === 2 ? style2Position.offset : currentStyle === 3 ? style3Position.offset : style4Position.offset
              },
              parts: partsDataUrls,
              song: songInfo,
              logo: logoData,
              mode: 'fein',
              // Nouveaux paramètres de timing et variation
              imageTiming: videoParams.imageTiming / 1000, // Convertir ms en secondes pour l'API
              imageCount: videoParams.imageCount
            };
          } else if (autoCutTemplate === 'auto-lyrics') {
            // Préparer les données pour Auto Lyrics
            // Utiliser les 2 collections séparées depuis la bibliothèque
            const videosBeforeRefrainData = collectionBeforeRefrain?.videos?.map((video: any) => ({
              url: video.url,
              type: 'video'
            })) || [];

            const videosAfterRefrainData = collectionAfterRefrain?.videos?.map((video: any) => ({
              url: video.url,
              type: 'video'
            })) || [];

            // Préparer les données de la musique
            let musicData = selectedSong!.url;
            if (!musicData.startsWith('data:')) {
              const response = await fetch(musicData);
              const blob = await response.blob();
              musicData = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
            }

            const currentPosition = currentStyle === 1 ? style1Position : currentStyle === 2 ? style2Position : currentStyle === 3 ? style3Position : style4Position;

            // Appliquer la transformation de casse aux paroles
            const transformedWordTimestamps = wordTimestamps.map(word => ({
              ...word,
              text: textCase === 'uppercase'
                ? word.text.toUpperCase()
                : textCase === 'lowercase'
                  ? word.text.toLowerCase()
                  : word.text
            }));

            data = {
              images: [],
              videos: [], // Garder pour compatibilité
              videosBeforeRefrain: videosBeforeRefrainData,
              videosAfterRefrain: videosAfterRefrainData,
              useOneCollection: useOneCollection, // Envoyer le paramètre pour utiliser 1 ou 2 collections
              hooks: [],
              music: {
                id: selectedSong!.id,
                url: musicData,
                duration: selectedSong!.duration
              },
              videoCount: 1,
              style: currentStyle,
              position: currentPosition,
              selectedFonts: selectedFonts,
              fontSize: fontSize,
              randomFontSize: randomFontSize,
              randomPosition: randomPosition,
              wordTimestamps: transformedWordTimestamps,
              lyricsStyle: lyricsStyle,
              textColors: textColors.filter(c => c.enabled).map(c => c.color),
              montageType: montageType
            };
          } else if (isTwainYaGamilaMode) {
            // Préparer les données pour AutoCut (autres templates)
            // Récupérer images et vidéos de la collection
            const collectionImages = twainYaGamilaState.collection!.images || [];
            const collectionVideos = twainYaGamilaState.collection!.videos || [];
            
            // Combiner images et vidéos
            const allMedia = [
              ...collectionImages.map(img => ({ ...img, type: 'image' })),
              ...collectionVideos.map(vid => ({ ...vid, type: 'video' }))
            ];
            
            // Utiliser tous les médias disponibles dans la collection
            const availableMediaCount = allMedia.length;
            const mediaCount = availableMediaCount;

            console.log(`[AutoCut] Using all available media: ${mediaCount} items`);

            // Utiliser tous les médias disponibles
            const selectedMedia = allMedia;
            
            // Séparer images et vidéos pour traitement
            const images = selectedMedia.filter(m => m.type === 'image');
            const videos = selectedMedia.filter(m => m.type === 'video');
            
            // Convertir les images en base64
            const imagesData = await Promise.all(images.map(async (img) => {
              const response = await fetch(img.url);
              const blob = await response.blob();
              return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
            }));
            
            // Convertir les vidéos en base64 (ou garder les URLs)
            const videosData = await Promise.all(videos.map(async (vid) => {
              if (vid.url.startsWith('data:')) {
                return { url: vid.url, type: 'video' };
              } else {
                // Pour les URLs, on peut soit les garder soit les convertir
                return { url: vid.url, type: 'video' };
              }
            }));
            
            // Préparer les données de la musique
            let musicData = null;
            if (selectedSong!.id === 'no-music') {
              // Skip music processing for "no-music" option
              musicData = '';
            } else {
              musicData = selectedSong!.url;
              if (!musicData.startsWith('data:')) {
                const response = await fetch(musicData);
                const blob = await response.blob();
                musicData = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(blob);
                });
              }
            }
            
            // Utiliser les hooks du système existant
            const hookLines = hooks.split('\n').filter(line => line.trim() !== '');
            // Sélection aléatoire des hooks pour AutoCut
            let currentHook = '';
            if (hookLines.length > 0) {
              const randomSeed = Date.now() + i * 8971 + Math.random() * 10000;
              const randomIndex = Math.floor(Math.abs(Math.sin(randomSeed * 0.001) * 10000) % hookLines.length);
              currentHook = hookLines[randomIndex];
              console.log(`🎲 AutoCut video ${i + 1} random hook: seed=${randomSeed}, index=${randomIndex}/${hookLines.length}`);
              console.log(`🎯 Selected hook: "${currentHook}"`);
            }
            
            // Générer les paramètres pour cette vidéo
            const videoParams = generateVideoParameters(i, totalVideos);
            
            // Check if using TikTok Creative template
            if (autoCutTemplate === 'tiktok-creative') {
              data = {
                images: imagesData.map(url => ({ url, type: 'image' })),
                videos: videosData,
                hooks: currentHook ? [currentHook] : [],
                music: {
                  id: selectedSong!.id,
                  url: musicData
                },
                videoCount: 1, // On génère une vidéo à la fois
                style: currentStyle,
                position: currentStyle === 1 ? style1Position.position : currentStyle === 2 ? style2Position.position : currentStyle === 3 ? style3Position.position : style4Position.position,
                offset: currentStyle === 1 ? style1Position.offset : currentStyle === 2 ? style2Position.offset : currentStyle === 3 ? style3Position.offset : style4Position.offset,
                selectedFonts: selectedFonts,
                fontSize: fontSize,
                randomFontSize: randomFontSize,
                randomPosition: randomPosition,
                imageTimingMin: imageTimingMin, // Durée totale min
                imageTimingMax: imageTimingMax, // Durée totale max
                clipDuration: 1.5 // TikTok Creative uses automatic intelligent duration
              };
            } else {
              // Default AutoCut mode (includes one-shoot and for-a-living)
              data = {
                images: imagesData.map(url => ({ url, type: 'image' })),
                videos: videosData,
                hooks: currentHook ? [currentHook] : [],
                music: {
                  id: selectedSong!.id,
                  url: musicData
                },
                videoCount: 1, // On génère une vidéo à la fois
                style: currentStyle,
                position: currentStyle === 1 ? style1Position.position : currentStyle === 2 ? style2Position.position : currentStyle === 3 ? style3Position.position : style4Position.position,
                offset: currentStyle === 1 ? style1Position.offset : currentStyle === 2 ? style2Position.offset : currentStyle === 3 ? style3Position.offset : style4Position.offset,
                selectedFonts: selectedFonts,
                fontSize: fontSize,
                randomFontSize: randomFontSize,
                randomPosition: randomPosition,
                // Nouveaux paramètres de timing et variation
                imageTiming: videoParams.imageTiming / 1000, // Convertir ms en secondes pour l'API
                imageCount: videoParams.imageCount,
                maxVideoDuration: maxVideoDuration,
                template: autoCutTemplate // Ajouter le template pour que l'API sache quel template utiliser
              };
            }
          } else if (isCreedStreamerMode) {
            const combo = creedStreamerCombos[i];
            // Utiliser les URLs existantes ou uploader vers Supabase
            console.log(`Préparation des parties Creed Streamer...`);
            const partsDataUrls = await Promise.all(combo.map(async (f, idx) => {
              // Si le fichier a déjà une URL de clip (chargé depuis la bibliothèque), l'utiliser directement
              if ((f as any).clipUrl && typeof (f as any).clipUrl === 'string') {
                console.log(`Partie ${idx + 1}: utilisation de l'URL existante - ${(f as any).clipUrl}`);
                return {
                  url: (f as any).clipUrl,
                  type: 'video',
                };
              }
              // Sinon, uploader vers Supabase
              const resourceType = f.type?.startsWith('video/') ? 'video' : 'image';
              console.log(`Upload partie ${idx + 1}/${combo.length}...`);
              const url = await uploadToSupabase(f, resourceType);
              return {
                url,
                type: f.type?.startsWith('video/') ? 'video' : 'image',
              };
            }));

            // Préparer le logo si présent
            let logoData = null;
            if (creedStreamerParts.logo.length > 0) {
              console.log('Préparation du logo...');
              // Convertir le fichier logo en data URL
              const logoFile = creedStreamerParts.logo[0];
              const logoDataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(logoFile);
              });
              
              // Convertir la position du logo pour l'API (même logique que FE!N)
              let apiLogoPosition: 'top' | 'middle' | 'bottom' = 'top';
              let horizontalPosition: 'left' | 'center' | 'right' = 'center';
              
              if (logoPosition === 'top-left') {
                apiLogoPosition = 'top';
                horizontalPosition = 'left';
              } else if (logoPosition === 'top-right') {
                apiLogoPosition = 'top';
                horizontalPosition = 'right';
              } else if (logoPosition === 'center') {
                apiLogoPosition = 'middle';
                horizontalPosition = 'center';
              } else if (logoPosition === 'bottom-left') {
                apiLogoPosition = 'bottom';
                horizontalPosition = 'left';
              } else if (logoPosition === 'bottom-right') {
                apiLogoPosition = 'bottom';
                horizontalPosition = 'right';
              }
              
              logoData = {
                url: logoDataUrl,
                size: logoSize,
                position: apiLogoPosition,
                horizontalPosition: horizontalPosition
              };
            }
            
            // Capturer l'image exacte du hook preview avec le hook spécifique
            const hookImageDataUrl = await captureHookImage(hook);
            
            // Générer les paramètres pour cette vidéo
            const videoParams = generateVideoParameters(i, totalVideos);
            
            data = {
              hook: hookImageDataUrl ? {
                imageUrl: hookImageDataUrl,
                position: currentStyle === 1 ? style1Position.position : currentStyle === 2 ? style2Position.position : currentStyle === 3 ? style3Position.position : style4Position.position,
                offset: currentStyle === 1 ? style1Position.offset : currentStyle === 2 ? style2Position.offset : currentStyle === 3 ? style3Position.offset : style4Position.offset
              } : {
                text: hook,
                style: currentStyle,
                position: currentStyle === 1 ? style1Position.position : currentStyle === 2 ? style2Position.position : currentStyle === 3 ? style3Position.position : style4Position.position,
                offset: currentStyle === 1 ? style1Position.offset : currentStyle === 2 ? style2Position.offset : currentStyle === 3 ? style3Position.offset : style4Position.offset
              },
              parts: partsDataUrls,
              song: songInfo,
              logo: logoData,
              mode: 'creed-streamer',
              // Nouveaux paramètres de timing et variation
              imageTiming: videoParams.imageTiming / 1000, // Convertir ms en secondes pour l'API
              imageCount: videoParams.imageCount
            };
          } else if (isAddHookMode) {
            // Préparer les données pour Add Hook (traitement individuel des images et vidéos)
            const collectionImages = twainYaGamilaState.collection!.images || [];
            const collectionVideos = twainYaGamilaState.collection!.videos || [];

            // Convertir les images en base64 si présentes
            let imagesData: any[] = [];
            if (collectionImages.length > 0) {
              imagesData = await Promise.all(collectionImages.map(async (img) => {
                const response = await fetch(img.url);
                const blob = await response.blob();
                return new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(blob);
                });
              }));
            }

            // Préparer les vidéos (garder les URLs directement pour éviter les problèmes de taille)
            let videosData: any[] = [];
            if (collectionVideos.length > 0) {
              videosData = collectionVideos.map(video => ({ url: video.url, type: 'video' }));
            }

            // Utiliser les hooks du système existant
            const hookLines = hooks.split('\n').filter(line => line.trim() !== '');

            data = {
              images: imagesData.map(url => ({ url, type: 'image' })),
              videos: videosData,
              hooks: hookLines,
              imageCount: collectionImages.length > 0 ? twainYaGamilaState.videosToGenerate : 0,
              videoCount: collectionVideos.length > 0 ? twainYaGamilaState.videosToGenerate : 0,
              style: currentStyle,
              position: currentStyle === 1 ? style1Position.position : style2Position.position,
              offset: currentStyle === 1 ? style1Position.offset : style2Position.offset
            };
          } else if (isVersusMode) {
            const combo = versusCombos[i];
            // Pour le mode Versus, uploader vers Cloudinary puis envoyer les URLs
            
            // Traiter chaque partie une par une
            const partVideos: string[] = [];
            for (let partIdx = 0; partIdx < combo.length; partIdx++) {
              const part = combo[partIdx];
              console.log(`Upload de la partie ${partIdx + 1}/${combo.length} vers Supabase...`);
              
              try {
                // Uploader vers Supabase
                const resourceType = part.type?.startsWith('video/') ? 'video' : 'image';
                const supabaseUrl = await uploadToSupabase(part, resourceType);
                console.log(`Partie ${partIdx + 1} uploadée avec succès vers Supabase`);
                
                // Créer l'objet avec l'URL Supabase
                const partDataUrl = {
                  url: supabaseUrl,
                  type: part.type?.startsWith('video/') ? 'video' : 'image',
                };
                
                // Générer les paramètres pour cette vidéo
                const videoParams = generateVideoParameters(comboIdx, versusCombos.length);
                
                // Créer une requête pour cette partie uniquement
                const partData = {
                hook: {
                  text: hook,
                  style: currentStyle,
                  position: currentStyle === 1 ? style1Position.position : style2Position.position,
                  offset: currentStyle === 1 ? style1Position.offset : style2Position.offset
                },
                parts: [partDataUrl], // Une seule partie à la fois
                song: songInfo,
                mode: 'versus',
                isSinglePart: true,
                partNumber: partIdx + 1,
                totalParts: combo.length,
                // Nouveaux paramètres de timing et variation
                imageTiming: videoParams.imageTiming / 1000, // Convertir ms en secondes pour l'API
                imageCount: videoParams.imageCount
              };
              
              // Envoyer cette partie au serveur
              try {
                // Get the auth token from Supabase
                const { data: { session } } = await supabase.auth.getSession();
                
                const response = await fetch('/api/create-video/versus', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` })
                  },
                  body: JSON.stringify(partData),
                });
                
                if (response.ok) {
                  const result = await response.json();
                  partVideos.push(result.videoPath);
                  console.log(`Partie ${partIdx + 1}/${combo.length} créée avec succès`);
                } else {
                  const errorText = await response.text();
                  console.error(`Erreur pour la partie ${partIdx + 1}:`, errorText);
                  toast.error(`Erreur partie ${partIdx + 1}: ${errorText}`);
                }
                } catch (error) {
                  console.error(`Erreur lors de la création de la partie ${partIdx + 1}:`, error);
                  toast.error(`Erreur partie ${partIdx + 1}`);
                }
              } catch (uploadError) {
                console.error(`Erreur lors de l'upload Cloudinary pour la partie ${partIdx + 1}:`, uploadError);
                toast.error(`Erreur d'upload partie ${partIdx + 1}`);
                continue; // Passer à la partie suivante
              }
              
              // Mettre à jour la progression
              const partProgress = ((i + (partIdx + 1) / combo.length) / totalVideos) * 100;
              setProgress(partProgress);
            }
            
            // Si on a créé toutes les parties, on a fini cette vidéo
            if (partVideos.length === combo.length) {
              console.log(`Vidéo Versus ${i + 1} complète avec ${partVideos.length} parties`);
              setGeneratedVideos(prev => [...prev, ...partVideos]);
            }
            
            // On continue la boucle principale sans faire d'autre requête
            // Marquer data comme undefined pour éviter la requête normale
            data = undefined as any;
            continue;
          } else {
            const filteredVideos = (twainYaGamilaState.collection?.videos || []).filter((v: any) => {
              const d = v?.duration || v?.durationSeconds || 0;
              return d >= 6;
            });

            data = {
              hook: {
                text: hook,
                style: currentStyle,
                position: currentStyle === 1 ? style1Position.position : currentStyle === 2 ? style2Position.position : currentStyle === 3 ? style3Position.position : style4Position.position,
                offset: currentStyle === 1 ? style1Position.offset : currentStyle === 2 ? style2Position.offset : currentStyle === 3 ? style3Position.offset : style4Position.offset
              },
              part1: template ? {
                url: template.url,
                type: template.type,
                position: templateImagePosition,
                duration: {
                  min: templateDurationRange.min,
                  max: templateDurationRange.max
                }
              } : undefined,
              part2: autoCutTemplate === 'one-shoot' && filteredVideos.length > 0 ? {
                url: filteredVideos[0].url,
                type: 'video',
              } : {
                url: media.url,
                type: media.type,
              },
              part2Duration: {
                min: videoDurationRange.min,
                max: videoDurationRange.max
              },
              song: songInfo
            };
          }
          
        // Si on est en mode Versus et qu'on a déjà traité les parties, on skip cette partie
        if (isVersusMode && !data) {
          // Les parties ont déjà été traitées individuellement
          clearInterval(progressInterval);
          count++;
          setGeneratedCount(count);
          setProgress(Math.round((count / totalVideos) * 100));
          continue;
        }
        
        try {
          // Envoi au serveur
          const apiEndpoint = isMaxCombinaisonsMode 
            ? '/api/create-video/fein' 
            : isCreedStreamerMode 
              ? '/api/create-video/creed-streamer'
              : isTwainYaGamilaMode
                ? (autoCutTemplate === 'tiktok-creative'
                    ? '/api/create-video/tiktok-creative'
                    : autoCutTemplate === 'one-shoot'
                      ? '/api/create-video/one-shoot'
                      : autoCutTemplate === 'for-a-living'
                        ? '/api/create-video/auto-cut'
                        : autoCutTemplate === 'auto-lyrics'
                          ? '/api/create-video/2000'
                          : '/api/create-video/twain-ya-gamila') // Default AutoCut
              : isAddHookMode
                ? '/api/create-video/add-hook' // Utiliser la nouvelle API dédiée
                : isVersusMode 
                  ? '/api/create-video/versus' 
                  : '/api/create-video';
          
          // Get the auth token from Supabase
          const { data: { session } } = await supabase.auth.getSession();
          
          console.log('[Auto Lyrics] Sending request to:', apiEndpoint);
          console.log('[Auto Lyrics] Data:', {
            ...data,
            videosBeforeRefrain: data.videosBeforeRefrain?.length,
            videosAfterRefrain: data.videosAfterRefrain?.length,
            wordTimestamps: data.wordTimestamps?.length,
            lyricsStyle: data.lyricsStyle,
            fontSize: data.fontSize,
            selectedFonts: data.selectedFonts
          });

          // Use job queue system in production to avoid OOM errors
          const useQueue = false; // Désactivé: traitement direct avec Render Starter (2GB RAM)

          if (useQueue) {
            // Create job in queue - worker will process it
            const response = await fetch('/api/create-video-job', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` })
              },
              body: JSON.stringify({
                ...data,
                apiEndpoint, // Tell worker which API to use
                mode: isMaxCombinaisonsMode ? 'fein' : isCreedStreamerMode ? 'creed' : isTwainYaGamilaMode ? 'autocut' : isAddHookMode ? 'add-hook' : isVersusMode ? 'versus' : 'standard'
              }),
            });

            if (response.ok) {
              const result = await response.json();
              console.log(`✅ Job created: ${result.jobId}`);
              toast.success(`Vidéo ${i+1}/${totalVideos} ajoutée à la queue. Tu peux fermer le site, elle continuera de se générer !`, {
                duration: 5000
              });

              // TODO: Add job tracking UI to show progress
            } else {
              const errorText = await response.text();
              console.error('Erreur création du job:', errorText);
              toast.error(`Erreur: ${errorText}`);
            }
          } else {
            // Development: generate directly (old behavior)
            const response = await fetch(apiEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` })
              },
              body: JSON.stringify(data),
            });

            if (response.ok) {
              const result = await response.json();

              // Gérer le format de réponse différent selon les APIs
              if (isTwainYaGamilaMode && result.videos) {
                // twain-ya-gamila retourne un tableau de vidéos
                result.videos.forEach((video: any) => {
                  const videoPath = video.url;
                  // Pas d'expiration spécifique, utiliser la valeur par défaut
                  addVideo(videoPath);
                  setGeneratedVideos(prev => [...prev, videoPath]);
                });
              } else if (isAddHookMode && result.media) {
                // add-hook retourne un tableau de médias traités
                result.media.forEach((media: any) => {
                  const mediaPath = media.url;
                  addVideo(mediaPath);
                  setGeneratedVideos(prev => [...prev, mediaPath]);
                });
              } else {
                // Format standard pour les autres APIs
                const videoPath = result.videoPath;
                const expiresAt = result.expiresAt;

                addVideo(videoPath, expiresAt);
                setGeneratedVideos(prev => [...prev, videoPath]);
              }
            } else {
              const errorText = await response.text();
              console.error('Erreur response du serveur:', errorText);
              toast.error(`Erreur de création de vidéo: ${errorText}`);
            }
          }
        } catch (error) {
          console.error('Erreur lors de la création de la vidéo:', error);
          toast.error('Erreur lors de la création de la vidéo');
        }

        // Après la génération d'une vidéo, nettoyer l'intervalle
        clearInterval(progressInterval);
        
        // Vidéo générée, mise à jour du compteur
        count++;
        setGeneratedCount(count);
        
        // Marquer cette vidéo comme complétée (100% pour cette vidéo)
        const completedProgress = Math.min(Math.round(baseProgress + ((i+1) / totalVideos * 90)), 95);
        setProgress(completedProgress);
        
        // Mettre à jour l'état final pour cette vidéo
        saveGenerationState({
          isGenerating: true,
          progress: completedProgress,
          generatedVideos,
          generatedCount: count,
          totalToGenerate: totalVideos,
          currentHookIndex: i,
          currentMediaIndex: mediaIndex
        });
      }
      
      // Toutes les vidéos sont générées, marquer comme terminé
      setProgress(PROGRESS_STEPS.COMPLETION); // 100%
      
      // Déclencher l'animation de fin
      setShowCompletionAnimation(true);
      setTimeout(() => {
        setShowCompletionAnimation(false);
        setGenerationComplete(true);
      }, 2000);
      
      // Ne pas réinitialiser les champs après la génération des vidéos
      // car cela empêche l'affichage du popup de téléchargement
      // resetFormFields();
      
    } catch (error) {
      console.error('Erreur lors de la génération des vidéos:', error);
      toast.error("Une erreur est survenue lors de la génération des vidéos");
    } finally {
      setIsGenerating(false);
    }
  };

  // Fonction pour réinitialiser les champs du formulaire
  const resetFormFields = () => {
    // Réinitialiser les hooks
    setHooks('');
    
    // Réinitialiser la musique
    setSelectedSong(null);
    
    // Réinitialiser Part 1 (template)
    setSelectedTemplate(null);
    // Utiliser le state actuel au lieu de setLastUploadedTemplate
    // setLastUploadedTemplate([]);
    
    // Réinitialiser Part 2 (médias)
    setSelectedMedias([]);
    setSelectedMediaIndexes(new Set());
    
    // Réinitialiser l'état de génération
    setGeneratedVideos([]);
    setGeneratedCount(0);
    setTotalToGenerate(0);
    setProgress(0);
    
    clearGenerationState();
  };

  // Ajouter un gestionnaire pour la visibilité de la page
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Si la page est cachée et que la génération est en cours, sauvegarder l'état
      if (document.visibilityState === 'hidden' && isGenerating) {
        saveGenerationState({
          isGenerating,
          progress,
          generatedVideos,
          generatedCount,
          totalToGenerate,
          currentHookIndex,
          currentMediaIndex
        });
      }
    };

    // Ajouter l'écouteur d'événement
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Nettoyer l'écouteur lors du démontage du composant
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isGenerating, progress, generatedVideos, generatedCount, totalToGenerate, currentHookIndex, currentMediaIndex]);

  // ... existing code ...
  
  // Assurer que l'état est nettoyé lorsque la génération est terminée
  useEffect(() => {
    if (!isGenerating) {
      clearGenerationState();
    }
  }, [isGenerating]);

  // ... existing code ...

  // Fonction pour télécharger une vidéo
  const handleDownloadVideo = (videoPath: string) => {
    const link = document.createElement('a');
    
    // Correction du chemin pour les vidéos temporaires
    if (videoPath.startsWith('/temp-videos/')) {
      // Utiliser le chemin direct vers le fichier temporaire dans le dossier public
      link.href = videoPath;
    } else if (videoPath.includes('supabase') || videoPath.startsWith('http')) {
      // C'est une URL complète de Supabase, l'utiliser directement
      link.href = videoPath;
    } else {
      // C'est un chemin local (fallback), ajouter le préfixe /generated/ si nécessaire
      link.href = videoPath.startsWith('/generated/') ? videoPath : `/generated/${videoPath}`;
    }
    
    // Extraire juste le nom du fichier pour le téléchargement
    let fileName = videoPath.split('/').pop();
    
    // Si aucun nom de fichier, générer un nom par défaut
    if (!fileName || fileName.trim() === '') {
      fileName = `video_${Date.now()}.mp4`;
    }
    
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Ajouter un petit délai pour permettre le téléchargement de démarrer
    setTimeout(() => {
      // Vérifier si le téléchargement a fonctionné en créant une requête pour tester l'existence du fichier
      const testRequest = new XMLHttpRequest();
      testRequest.open('HEAD', link.href, true);
      testRequest.onreadystatechange = function() {
        if (testRequest.readyState === 4) {
          if (testRequest.status !== 200) {
            // Le fichier n'est pas accessible, afficher une erreur
            toast.error(`Erreur: Le fichier n'est pas disponible. Veuillez réessayer plus tard.`);
            console.error(`Fichier non disponible: ${link.href}`);
          }
        }
      };
      testRequest.send();
    }, 500);
  };

  // Fonction pour télécharger toutes les vidéos en ZIP
  const handleDownloadAll = async () => {
    try {
      if (generatedVideos.length === 0) {
        toast.error("Aucune vidéo à télécharger");
        return;
      }
      
      // Afficher un toast de chargement
      toast.loading("Préparation de votre téléchargement...");
      
      // Préparer les données pour le ZIP
      const videosToDownload = generatedVideos.map(videoPath => {
        // Extraire le nom du fichier
        let fileName = videoPath.split('/').pop() || `video_${Date.now()}.mp4`;
        
        // Corriger le chemin pour les différents types d'URL
        let path = videoPath;
        if (videoPath.startsWith('/temp-videos/')) {
          // Utiliser le chemin direct
          path = videoPath;
        } else if (videoPath.includes('supabase') || videoPath.startsWith('http')) {
          // C'est une URL complète, l'utiliser directement
          path = videoPath; 
        } else {
          // C'est un chemin local, l'utiliser directement (les APIs retournent déjà le bon chemin)
          path = videoPath;
        }
        
        return { path, fileName };
      });
      
      // Télécharger en ZIP
      await downloadVideosAsZip(videosToDownload, `bluum_videos_${Date.now()}.zip`);
      
      // Terminer l'affichage du toast de chargement et afficher un succès
      toast.dismiss();
      toast.success(`${videosToDownload.length} vidéos téléchargées avec succès`);
      
      // Ne pas fermer le modal et ne pas recharger la page
      // setGenerationComplete(false);
      // setTimeout(() => {
      //   if (typeof window !== 'undefined') {
      //     window.location.reload();
      //   }
      // }, 1000);
    } catch (error) {
      console.error("Erreur lors du téléchargement des vidéos:", error);
      toast.dismiss();
      toast.error("Une erreur est survenue lors du téléchargement. Veuillez réessayer.");
    }
  };

  const handleVersusVideoUpload = (part: 'arrivesStadium' | 'training' | 'entry' | 'lineup' | 'faceCam' | 'skills' | 'goals' | 'celebrations') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setVersusParts(prev => ({
        ...prev,
        [part]: [...prev[part], ...files]
      }));
    }
    event.target.value = '';
  };

  const removeVersusVideo = (part: 'arrivesStadium' | 'training' | 'entry' | 'lineup' | 'faceCam' | 'skills' | 'goals' | 'celebrations', index: number) => {
    setVersusParts(prev => ({
      ...prev,
      [part]: prev[part].filter((_, i) => i !== index)
    }));
  };

  const handleMaxCombinaisonsVideoUpload = (part: 'part1' | 'part2' | 'part3' | 'part4' | 'part5' | 'part6' | 'part7' | 'part8' | 'part9' | 'part10' | 'logo') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setMaxCombinaisonsParts(prev => ({
        ...prev,
        [part]: [...prev[part], ...files]
      }));
    }
    event.target.value = '';
  };
  
  // Helper pour obtenir l'URL d'un fichier vidéo
  const getVideoUrl = (file: File): string => {
    // Si le fichier a une URL de clip (depuis la bibliothèque), l'utiliser
    if ((file as any).clipUrl) {
      return (file as any).clipUrl;
    }
    // Sinon, créer une URL blob
    return URL.createObjectURL(file);
  };
  
  // Durées minimales requises pour chaque partie (en secondes)
  // Validation de durée supprimée - les vidéos sont acceptées quelle que soit leur durée
  
  // Composant pour le sélecteur de collection vidéo (FE!N et autres modèles vidéo)
  const VideoCollectionSelector = ({ partKey, mapping, setMapping }: { 
    partKey: string;
    mapping: Record<string, string | null>;
    setMapping: React.Dispatch<React.SetStateAction<Record<string, string | null>>>;
  }) => (
    <select
      value={mapping[partKey] || ''}
      onChange={(e) => setMapping(prev => ({ ...prev, [partKey]: e.target.value || null }))}
      className="px-2 py-1 text-xs bg-[#e6e6e1] dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md"
      title={`Link ${partKey} to a video collection from your library`}
    >
      <option value="">No collection</option>
      {videoCollections.map(collection => (
        <option key={collection.id} value={collection.id}>{collection.name}</option>
      ))}
    </select>
  );
  
  // Alias pour compatibilité
  const FolderSelector = ({ partKey }: { partKey: string }) => (
    <VideoCollectionSelector partKey={partKey} mapping={feinFolderMappings} setMapping={setFeinFolderMappings} />
  );

  const CreedFolderSelector = ({ partKey }: { partKey: string }) => (
    <VideoCollectionSelector partKey={partKey} mapping={creedFolderMappings} setMapping={setCreedFolderMappings} />
  );
  
  // Composant pour le sélecteur de collection d'images (Slideshow)
  const ImageCollectionSelector = ({ value, onChange }: { 
    value: string;
    onChange: (value: string) => void;
  }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-2 py-1 text-xs bg-[#e6e6e1] dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md"
    >
      <option value="">No collection</option>
      {imageCollections.map(collection => (
        <option key={collection.id} value={collection.id}>{collection.name}</option>
      ))}
    </select>
  );

  const removeMaxCombinaisonsVideo = (part: 'part1' | 'part2' | 'part3' | 'part4' | 'part5' | 'part6' | 'part7' | 'part8' | 'part9' | 'part10' | 'logo', index: number) => {
    setMaxCombinaisonsParts(prev => ({
      ...prev,
      [part]: prev[part].filter((_, i) => i !== index)
    }));
  };

  // Fonctions pour Creed Streamer
  const handleCreedStreamerVideoUpload = (part: 'part1' | 'part2' | 'part3' | 'part4' | 'part5' | 'part6' | 'part7' | 'part8' | 'part9' | 'part10' | 'part11' | 'logo') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setCreedStreamerParts(prev => ({
        ...prev,
        [part]: [...prev[part], ...files]
      }));
    }
    event.target.value = '';
  };

  const removeCreedStreamerVideo = (part: 'part1' | 'part2' | 'part3' | 'part4' | 'part5' | 'part6' | 'part7' | 'part8' | 'part9' | 'part10' | 'part11' | 'logo', index: number) => {
    setCreedStreamerParts(prev => ({
      ...prev,
      [part]: prev[part].filter((_, i) => i !== index)
    }));
  };

  const handleTemplateUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!user) {
      alert('Please log in to upload templates');
      return;
    }

    // Vérifier si on a déjà un template personnalisé
    const currentTemplates = useVideoStore.getState().mediaFiles || [];
    const customTemplates = currentTemplates.filter(f => (f.type === "image" || f.type === "video") && f.id !== defaultTemplate?.id);

    try {
      setIsUploadingTemplate(true);
      
      // Create a default project if needed
      const projectId = 'default';
      
      // Check file type
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      
      if (!isImage && !isVideo) {
        alert('Please upload an image or video file');
        return;
      }

      // Check file size (max 5MB pour le localStorage)
      const MAX_LOCAL_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB
      if (file.size > 10 * 1024 * 1024) {
        alert(`File size must be less than 10MB for both images and videos`);
        return;
      }

      // Avertir l'utilisateur si le fichier est trop grand pour le localStorage
      if (file.size > MAX_LOCAL_STORAGE_SIZE) {
        console.warn(`File size (${(file.size / (1024 * 1024)).toFixed(2)}MB) may be too large for localStorage. Using object URL as fallback.`);
      }

      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      // Déclarer templateUrl au niveau supérieur pour qu'il soit accessible dans le bloc finally
      let templateUrl = '';

      let aspectRatio = 0.5625; // Default 9:16 ratio
      let duration = 5; // Default duration in seconds

      // For images, check dimensions and aspect ratio
      if (isImage) {
        const imageData = await new Promise<{ width: number; height: number }>((resolve, reject) => {
          const img = document.createElement('img');
          img.onload = () => {
            resolve({
              width: img.width,
              height: img.height
            });
          };
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = previewUrl;
        });

        // Calculate aspect ratio
        aspectRatio = imageData.width / imageData.height;
        
        // Nous ne validons plus le ratio 9:16
        // Enregistrer simplement les dimensions pour référence
        console.log(`Image dimensions: ${imageData.width}x${imageData.height}, ratio: ${aspectRatio.toFixed(2)}`);
      }
      
      // For videos, get duration and check aspect ratio
      if (isVideo) {
        const videoData = await new Promise<{ duration: number; aspectRatio: number }>((resolve, reject) => {
          const video = document.createElement('video');
          video.onloadedmetadata = () => {
            resolve({
              duration: video.duration,
              aspectRatio: video.videoWidth / video.videoHeight
            });
          };
          video.onerror = () => reject(new Error('Failed to load video'));
          video.src = previewUrl;
        });
        
        duration = videoData.duration;
        aspectRatio = videoData.aspectRatio;
        
        // Nous ne validons plus le ratio 9:16
        // Enregistrer simplement les dimensions pour référence
        console.log(`Video dimensions: ratio: ${aspectRatio.toFixed(2)}, duration: ${duration.toFixed(2)}s`);
      }
      
      console.log('Uploading template...');
      
      try {
        // Try to upload to Supabase first
        const timestamp = Date.now();
        const fileName = `user_${user.id}_${projectId}_templates_${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const path = `${projectId}/templates/${fileName}`;
        
        // Utiliser local par défaut car Supabase n'est pas accessible
        
        try {
          // First, try to initialize storage buckets if they don't exist
          await initializeStorage().catch(error => {
            console.warn('Failed to initialize storage buckets:', error);
            // Continue anyway, the upload might still work with local fallback
          });
          
          // Pour les vidéos, toujours utiliser directement l'URL d'objet
          if (isVideo) {
            console.log('Video file detected, using object URL directly');
            templateUrl = previewUrl;
            
            // Créer un objet pour suivre cette URL d'objet
            try {
              const objectUrls = JSON.parse(localStorage.getItem('object_urls') || '[]');
              objectUrls.push({
                id: `local_${timestamp}`,
                url: previewUrl,
                timestamp: Date.now()
              });
              // Ne garder que les 5 dernières URLs
              if (objectUrls.length > 5) {
                objectUrls.splice(0, objectUrls.length - 5);
              }
              localStorage.setItem('object_urls', JSON.stringify(objectUrls));
            } catch (e) {
              console.warn('Failed to track object URL:', e);
            }
          } else if (file.size > 2 * 1024 * 1024) { // 2MB pour les images volumineuses
            console.log('Large image file detected, using object URL directly');
            templateUrl = previewUrl;
          } else {
            // Utiliser localStorage uniquement pour les petites images
            console.log('Using localStorage for small image file...');
            
            // Create a unique key for localStorage
            const localKey = `local_storage_templates_user_${user.id}_${projectId}_templates_${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            
            // Nettoyer le localStorage avant d'ajouter un nouveau fichier
            try {
              // Supprimer tous les anciens templates du localStorage
              const keysToRemove = [];
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('local_storage_templates_user_')) {
                  keysToRemove.push(key);
                }
              }
              
              // Supprimer les clés
              keysToRemove.forEach(key => {
                localStorage.removeItem(key);
                console.log('Removed old template from localStorage:', key);
              });
            } catch (e) {
              console.warn('Failed to clean localStorage:', e);
            }
            
            try {
              // Read file as data URL
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsDataURL(file);
              });
              
              // Store in localStorage
              try {
                localStorage.setItem(localKey, dataUrl);
                // Use the localStorage key as the URL
                templateUrl = localKey;
                console.log('Template stored in localStorage with key:', localKey);
              } catch (storageError) {
                console.error('Failed to store in localStorage:', storageError);
                // Si erreur de stockage, utiliser l'URL d'objet
                templateUrl = previewUrl;
                console.log('localStorage error, using object URL instead');
              }
            } catch (readError) {
              console.error('Failed to read file:', readError);
              templateUrl = previewUrl;
              console.log('File reading error, using object URL instead');
            }
          }
        } catch (uploadError) {
          console.error('All storage methods failed:', uploadError);
          
          // Last resort: use the preview URL
          templateUrl = previewUrl;
          console.log('Using preview URL as last resort');
        }
        
        // Créer le nouveau template
        const newTemplate: MediaFile = {
          id: `local_${timestamp}`,
          type: isImage ? 'image' as const : 'video' as const,
          url: templateUrl,
          duration: duration
        };
        
        console.log("Created new template:", newTemplate);
        
        // Mettre à jour le store en remplaçant l'ancien template personnalisé s'il existe
        const updatedMediaFiles = [...currentTemplates.filter(f => f.id === defaultTemplate?.id), newTemplate];
        useVideoStore.setState({ 
          mediaFiles: updatedMediaFiles
        });
        
        // Sélectionner automatiquement le nouveau template
        setSelectedTemplate(newTemplate.id);
      } catch (error) {
        console.error('Error in template upload process:', error);
        throw error instanceof Error ? error : new Error('Unknown error during upload');
      } finally {
        // Clean up preview URL only if we're not using it
        if (templateUrl !== previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
      }
    } catch (error) {
      console.error('Template upload error:', error);
      alert(`Error uploading template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploadingTemplate(false);
      // Reset the input value to allow uploading the same file again
      event.target.value = '';
    }
  };

  useEffect(() => {
    // Initialize required storage buckets
    initializeStorage().catch(error => {
      console.error('Failed to initialize storage buckets:', error);
      // Continue with app initialization even if bucket creation fails
      // This allows the app to work with existing buckets
    });
    
    // Note: loadFonts and loadUserSongs are called elsewhere in the component
  }, []);

  const handleDeleteMedia = (indexToDelete: number) => {
    setSelectedMedias(prev => {
      const updatedMedias = prev.filter((_, index) => index !== indexToDelete);
      // Sauvegarder dans le localStorage
      try {
        localStorage.setItem('selectedMedias', JSON.stringify(updatedMedias));
      } catch (error) {
        console.error('Error saving medias:', error);
      }
      return updatedMedias;
    });

    setSelectedMediaIndexes(prev => {
      const newSelection = new Set(prev);
      newSelection.delete(indexToDelete);
      const adjustedSelection = new Set<number>();
      newSelection.forEach(index => {
        if (index > indexToDelete) {
          adjustedSelection.add(index - 1);
        } else {
          adjustedSelection.add(index);
        }
      });
      return adjustedSelection;
    });

    // Nettoyer l'URL de l'objet
    const mediaToDelete = selectedMedias[indexToDelete];
    if (mediaToDelete?.url && mediaToDelete.url.startsWith('blob:')) {
      URL.revokeObjectURL(mediaToDelete.url);
    }
  };

  const handleDeleteSelectedMedias = () => {
    const selectedIndexes = Array.from(selectedMediaIndexes).sort((a, b) => b - a);
    selectedIndexes.forEach(index => {
      handleDeleteMedia(index);
    });
    setSelectedMediaIndexes(new Set());
  };

  const handleDeleteTemplate = () => {
    // Garder uniquement le template par défaut
    useVideoStore.setState({ 
      mediaFiles: mediaFiles.filter(f => f.id === defaultTemplate?.id)
    });
    // Sélectionner le template par défaut
    setSelectedTemplate(defaultTemplate?.id || null);
  };

  // Add a useEffect to log template information for debugging
  useEffect(() => {
    if (selectedTemplate) {
      console.log("Preview template:", {
        selectedId: selectedTemplate,
        isDefaultTemplate: selectedTemplate === defaultTemplate?.id,
        defaultTemplateType: defaultTemplate?.type,
        foundTemplate: templates.find(t => t.id === selectedTemplate),
        foundTemplateType: templates.find(t => t.id === selectedTemplate)?.type
      });
    }
  }, [selectedTemplate, defaultTemplate, templates]);

  // Ajouter des styles CSS pour l'animation de progression
  useEffect(() => {
    // Ajouter une keyframe pour l'animation de progression
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes progress {
        0% { width: 0%; }
        100% { width: 100%; }
      }
      
      @keyframes fadeInScale {
        0% { opacity: 0; transform: scale(0.8); }
        50% { opacity: 1; transform: scale(1.05); }
        100% { opacity: 1; transform: scale(1); }
      }
      
      @keyframes bounce {
        0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-20px); }
        60% { transform: translateY(-10px); }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Utiliser useEffect pour tout ce qui accède à localStorage ou window
  useEffect(() => {
    // Initialiser les états qui dépendent du navigateur ici
    if (isClient) {
      // Vérifier s'il y a un état de génération en cours
      const savedState = loadGenerationState();
      if (savedState && savedState.isGenerating) {
        setIsGenerating(true);
        setProgress(savedState.progress);
        setGeneratedVideos(savedState.generatedVideos || []);
        setGeneratedCount(savedState.generatedCount || 0);
        setTotalToGenerate(savedState.totalToGenerate || 0);
        setCurrentHookIndex(savedState.currentHookIndex || 0);
        setCurrentMediaIndex(savedState.currentMediaIndex || 0);
      }
    }
  }, [isClient]);

  // Ajouter un useEffect pour charger les médias sauvegardés au montage du composant
  useEffect(() => {
    const savedMedias = localStorage.getItem('selectedMedias');
    if (savedMedias) {
      try {
        const parsedMedias = JSON.parse(savedMedias);
        setSelectedMedias(parsedMedias);
      } catch (error) {
        console.error('Error loading saved medias:', error);
        localStorage.removeItem('selectedMedias');
      }
    }
  }, []);

  // Nettoyer les médias au montage du composant
  useEffect(() => {
    // Nettoyer le localStorage et réinitialiser l'état
    localStorage.removeItem('selectedMedias');
    setSelectedMedias([]);
    setSelectedMediaIndexes(new Set());

    // Nettoyer les URLs d'objets existantes
    return () => {
      selectedMedias.forEach(media => {
        if (media.url && media.url.startsWith('blob:')) {
          URL.revokeObjectURL(media.url);
        }
      });
    };
  }, []); // S'exécute uniquement au montage

  const router = useRouter();

  // Sauvegarder l'état dans localStorage quand il change
  useEffect(() => {
    if (!user || !isClient) return;
    
    const stateToSave = {
      selectedTemplate,
      selectedSongId: selectedSong?.id || null,  // Ne sauvegarder que l'ID
      hooks,
      selectedStyles: Array.from(selectedStyles),
      currentStyle,
      templateDurationRange,
      videoDurationRange,
      // Ne pas sauvegarder les médias qui peuvent être très lourds
      selectedMediaIndexes: Array.from(selectedMediaIndexes),
      textPosition,
      textOffset,
      style1Position,
      style2Position,
      style3Position,
      style4Position,
      selectedFonts,
      fontSize,
      randomFontSize,
      randomPosition,
      selectedModel,
      videosToCreate,
      contentType,
      imageTimingMin,
      imageTimingMax,
      imageCountMin,
      imageCountMax,
      enableVariation,
      wordTimestamps,  // Sauvegarder les timestamps des paroles
      textCase  // Sauvegarder le choix de casse
    };
    
    try {
      localStorage.setItem(`create-video-form-${user.id}`, JSON.stringify(stateToSave));
    } catch (e) {
      // Si le localStorage est plein, sauvegarder seulement l'essentiel
      if (e instanceof DOMException && e.code === 22) {
        console.warn('localStorage is full, saving minimal state...');
        const minimalState = {
          selectedTemplate,
          selectedSongId: selectedSong?.id || null,
          hooks,
          currentStyle,
          selectedFonts,
          fontSize,
          randomFontSize,
          selectedModel,
          videosToCreate
        };
        try {
          localStorage.setItem(`create-video-form-${user.id}`, JSON.stringify(minimalState));
        } catch (e2) {
          console.error('Could not save form state:', e2);
        }
      }
    }
  }, [
    user,
    isClient,
    selectedTemplate,
    selectedSong,
    hooks,
    selectedStyles,
    currentStyle,
    templateDurationRange,
    videoDurationRange,
    selectedMediaIndexes,
    textPosition,
    textOffset,
    style1Position,
    style2Position,
    style3Position,
    style4Position,
    selectedModel,
    videosToCreate,
    contentType,
    imageTimingMin,
    imageTimingMax,
    imageCountMin,
    imageCountMax,
    enableVariation,
    wordTimestamps,
    textCase
  ]);

  // Fonction pour convertir le numéro de style en type de police pour l'API
  function getStyleTypeForApi(styleNumber: number) {
    switch (styleNumber) {
      case 1:
        return 'normal';
      case 2:
        return 'withBackground';
      case 3:
        return 'withBackgroundBlack';
      default:
        return 'withBackground';
    }
  }

  // Fonction pour générer une image à partir d'un hook
  const generateImageFromHook = async (templateUrl: string, hook: string, style: number) => {
    try {
      const fontType = getStyleTypeForApi(style);
      console.log("Generating image with style:", style, "font type:", fontType);
      
      // Call the backend API to generate the image
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateUrl,
          hook,
          styleType: fontType,
          position: style === 1 ? style1Position.position : style === 2 ? style2Position.position : style === 3 ? style3Position.position : style4Position.position,
          offset: style === 1 ? style1Position.offset : style === 2 ? style2Position.offset : style === 3 ? style3Position.offset : style4Position.offset
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate image');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error generating image:', error);
      return null;
    }
  };

  // Render the main component
  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f3f4f0' }}>
      {/* Modal de sélection de collection pour AutoCut */}
      {showTwainCollectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold dark:text-white">Select Collection</h2>
              <button
                onClick={() => setShowTwainCollectionModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
              >
                ×
              </button>
            </div>
            
            {/* Onglets pour choisir entre Images et Videos */}
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-6">
              <button
                onClick={() => setCollectionModalTab('images')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  collectionModalTab === 'images'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                Images Collections ({imageCollections.length})
              </button>
              <button
                onClick={() => setCollectionModalTab('videos')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  collectionModalTab === 'videos'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                Videos Collections ({videoCollections.length})
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {/* Affichage conditionnel selon l'onglet sélectionné */}
              {collectionModalTab === 'images' ? (
                imageCollections
                  .slice((twainModalPage - 1) * twainCollectionsPerPage, twainModalPage * twainCollectionsPerPage)
                  .map((collection) => (
                <div
                  key={collection.id}
                  onClick={() => {
                    const imageCount = collection.images?.length || 0;
                    if (imageCount >= 22) {
                      setTwainYaGamilaState(prev => ({ ...prev, collection }));
                      setShowTwainCollectionModal(false);
                    } else {
                      toast.error(`This collection needs at least 22 images (has ${imageCount})`);
                    }
                  }}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    (collection.images?.length || 0) >= 17 
                      ? 'border-gray-200 hover:border-[#3e90fd] dark:border-gray-700 dark:hover:border-[#3e90fd]' 
                      : 'border-gray-200 opacity-50 cursor-not-allowed dark:border-gray-700'
                  }`}
                >
                  <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg mb-3 flex items-center justify-center overflow-hidden relative">
                    {collection.images && collection.images.length > 0 ? (
                      <div className="w-full h-full grid grid-cols-3 grid-rows-2 gap-0.5">
                        {/* First image - large, takes left 2/3 */}
                        {collection.images[0] && (
                          <div className="col-span-2 row-span-2">
                            <img 
                              src={collection.images[0].url} 
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        {/* Second image - top right */}
                        {collection.images[1] ? (
                          <div className="col-span-1 row-span-1">
                            <img 
                              src={collection.images[1].url} 
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="col-span-1 row-span-1 bg-gray-200"></div>
                        )}
                        {/* Third image - bottom right */}
                        {collection.images[2] ? (
                          <div className="col-span-1 row-span-1">
                            <img 
                              src={collection.images[2].url} 
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="col-span-1 row-span-1 bg-gray-200"></div>
                        )}
                        {/* Overlay for 4th and 5th images if they exist */}
                        {collection.images.length > 3 && (
                          <div className="absolute bottom-1 right-1 flex gap-1">
                            {collection.images[3] && (
                              <div className="w-6 h-6 rounded overflow-hidden border border-white/20">
                                <img 
                                  src={collection.images[3].url} 
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            {collection.images[4] && (
                              <div className="w-6 h-6 rounded overflow-hidden border border-white/20">
                                <img 
                                  src={collection.images[4].url} 
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <h3 className="font-medium text-sm mb-1 dark:text-white">{collection.name}</h3>
                  <p className={`text-xs ${(collection.images?.length || 0) >= 17 ? 'text-gray-500' : 'text-red-500'} dark:text-gray-400`}>
                    {collection.images?.length || 0} images {(collection.images?.length || 0) < 22 && '(needs 22+)'}
                  </p>
                </div>
              ))
              ) : (
                videoCollections
                  .slice((twainModalPage - 1) * twainCollectionsPerPage, twainModalPage * twainCollectionsPerPage)
                  .map((collection) => (
                <div
                  key={collection.id}
                  onClick={() => {
                    const videoCount = collection.videos?.length || 0;
                    if (videoCount >= 1) {
                      setTwainYaGamilaState(prev => ({ ...prev, collection }));
                      setShowTwainCollectionModal(false);
                    } else {
                      toast.error(`This collection needs at least 1 video (has ${videoCount})`);
                    }
                  }}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    (collection.videos?.length || 0) >= 1
                      ? 'border-gray-200 hover:border-[#3e90fd] dark:border-gray-700 dark:hover:border-[#3e90fd]' 
                      : 'border-gray-200 opacity-50 cursor-not-allowed dark:border-gray-700'
                  }`}
                >
                  <div className="aspect-square mb-3 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                    {collection.videos && collection.videos.length > 0 ? (
                      <div className="w-full h-full relative">
                        <video 
                          src={collection.videos[0].url} 
                          className="w-full h-full object-cover"
                          muted
                        />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <h3 className="font-medium text-sm mb-1 dark:text-white">{collection.name}</h3>
                  <p className={`text-xs ${(collection.videos?.length || 0) >= 1 ? 'text-gray-500' : 'text-red-500'} dark:text-gray-400`}>
                    {collection.videos?.length || 0} videos {(collection.videos?.length || 0) < 1 && '(needs 1+)'}
                  </p>
                </div>
              ))
              )}
            </div>

            {/* Pagination */}
            {((collectionModalTab === 'images' && imageCollections.length > twainCollectionsPerPage) ||
              (collectionModalTab === 'videos' && videoCollections.length > twainCollectionsPerPage)) && (
              <div className="flex justify-center items-center gap-2 my-6">
                <button
                  onClick={() => setTwainModalPage(prev => Math.max(1, prev - 1))}
                  disabled={twainModalPage === 1}
                  className="px-4 py-2 rounded-lg font-medium transition-colors disabled:bg-gray-200 disabled:text-gray-400 bg-gray-100 hover:bg-gray-200"
                >
                  Previous
                </button>

                {Array.from({
                  length: Math.ceil((collectionModalTab === 'images' ? imageCollections.length : videoCollections.length) / twainCollectionsPerPage)
                }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setTwainModalPage(page)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      twainModalPage === page
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => setTwainModalPage(prev => Math.min(
                    Math.ceil((collectionModalTab === 'images' ? imageCollections.length : videoCollections.length) / twainCollectionsPerPage),
                    prev + 1
                  ))}
                  disabled={twainModalPage === Math.ceil((collectionModalTab === 'images' ? imageCollections.length : videoCollections.length) / twainCollectionsPerPage)}
                  className="px-4 py-2 rounded-lg font-medium transition-colors disabled:bg-gray-200 disabled:text-gray-400 bg-gray-100 hover:bg-gray-200"
                >
                  Next
                </button>
              </div>
            )}

            {((collectionModalTab === 'images' && imageCollections.length === 0) ||
              (collectionModalTab === 'videos' && videoCollections.length === 0)) && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                No {collectionModalTab} collections found. Upload {collectionModalTab} to your library first.
              </div>
            )}
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowTwainCollectionModal(false)}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pour sélectionner collection Before Refrain (Auto Lyrics) */}
      {showCollectionModalBeforeRefrain && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold dark:text-white">Before Refrain Collection</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Videos for 0-12.80s</p>
              </div>
              <button
                onClick={() => setShowCollectionModalBeforeRefrain(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {videoCollections
                .slice((collectionModalPage - 1) * collectionsPerModalPage, collectionModalPage * collectionsPerModalPage)
                .map((collection) => (
                <div
                  key={collection.id}
                  onClick={() => {
                    setCollectionBeforeRefrain(collection);
                    setShowCollectionModalBeforeRefrain(false);
                    setCollectionModalPage(1);
                  }}
                  className="cursor-pointer group"
                >
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 relative">
                    {collection.videos && collection.videos.length > 0 && (
                      <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-0.5">
                        {collection.videos.slice(0, 4).map((video: any, idx: number) => (
                          <div key={idx} className="relative">
                            <video
                              src={video.url}
                              className="w-full h-full object-cover"
                              muted
                              preload="metadata"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  </div>
                  <h3 className="mt-2 text-sm font-medium dark:text-white truncate">{collection.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {collection.videos?.length || 0} videos
                  </p>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {videoCollections.length > collectionsPerModalPage && (
              <div className="flex justify-center items-center gap-2 mt-6">
                <button
                  onClick={() => setCollectionModalPage(prev => Math.max(1, prev - 1))}
                  disabled={collectionModalPage === 1}
                  className="px-4 py-2 rounded-lg font-medium transition-colors disabled:bg-gray-200 disabled:text-gray-400 bg-gray-100 hover:bg-gray-200"
                >
                  Previous
                </button>

                {Array.from({ length: Math.ceil(videoCollections.length / collectionsPerModalPage) }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCollectionModalPage(page)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      collectionModalPage === page
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => setCollectionModalPage(prev => Math.min(Math.ceil(videoCollections.length / collectionsPerModalPage), prev + 1))}
                  disabled={collectionModalPage === Math.ceil(videoCollections.length / collectionsPerModalPage)}
                  className="px-4 py-2 rounded-lg font-medium transition-colors disabled:bg-gray-200 disabled:text-gray-400 bg-gray-100 hover:bg-gray-200"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal pour sélectionner collection After Refrain (Auto Lyrics) */}
      {showCollectionModalAfterRefrain && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold dark:text-white">After Refrain Collection</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Videos for 12.80s+</p>
              </div>
              <button
                onClick={() => setShowCollectionModalAfterRefrain(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {videoCollections
                .slice((collectionModalPage - 1) * collectionsPerModalPage, collectionModalPage * collectionsPerModalPage)
                .map((collection) => (
                <div
                  key={collection.id}
                  onClick={() => {
                    setCollectionAfterRefrain(collection);
                    setShowCollectionModalAfterRefrain(false);
                    setCollectionModalPage(1);
                  }}
                  className="cursor-pointer group"
                >
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 relative">
                    {collection.videos && collection.videos.length > 0 && (
                      <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-0.5">
                        {collection.videos.slice(0, 4).map((video: any, idx: number) => (
                          <div key={idx} className="relative">
                            <video
                              src={video.url}
                              className="w-full h-full object-cover"
                              muted
                              preload="metadata"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  </div>
                  <h3 className="mt-2 text-sm font-medium dark:text-white truncate">{collection.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {collection.videos?.length || 0} videos
                  </p>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {videoCollections.length > collectionsPerModalPage && (
              <div className="flex justify-center items-center gap-2 mt-6">
                <button
                  onClick={() => setCollectionModalPage(prev => Math.max(1, prev - 1))}
                  disabled={collectionModalPage === 1}
                  className="px-4 py-2 rounded-lg font-medium transition-colors disabled:bg-gray-200 disabled:text-gray-400 bg-gray-100 hover:bg-gray-200"
                >
                  Previous
                </button>

                {Array.from({ length: Math.ceil(videoCollections.length / collectionsPerModalPage) }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCollectionModalPage(page)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      collectionModalPage === page
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => setCollectionModalPage(prev => Math.min(Math.ceil(videoCollections.length / collectionsPerModalPage), prev + 1))}
                  disabled={collectionModalPage === Math.ceil(videoCollections.length / collectionsPerModalPage)}
                  className="px-4 py-2 rounded-lg font-medium transition-colors disabled:bg-gray-200 disabled:text-gray-400 bg-gray-100 hover:bg-gray-200"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={5000} />
      <div className="px-4 xl:px-6 pt-4" suppressHydrationWarning>
        <div suppressHydrationWarning>
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold" style={{ color: '#333333' }}>Create Videos</h1>
            
            {/* Boutons de modèles */}
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedModel('twain-ya-gamila')}
                className={`px-6 py-3 rounded-lg font-medium transition-all transform hover:scale-105 ${
                  selectedModel === 'twain-ya-gamila'
                    ? 'bg-[#3e90fd] text-white'
                    : 'bg-transparent text-[#383838] border border-[#b8b8b8] hover:bg-gray-50'
                }`}
              >
                AutoCut
              </button>
              <button
                onClick={() => setSelectedModel('add-hook')}
                className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                  selectedModel === 'add-hook'
                    ? 'bg-[#3e90fd] text-white'
                    : 'bg-transparent text-[#383838] border border-[#b8b8b8] hover:bg-gray-50'
                }`}
              >
                Add Hook
              </button>
              <button
                onClick={() => setSelectedModel('versus')}
                className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                  selectedModel === 'versus'
                    ? 'bg-[#3e90fd] text-white'
                    : 'bg-transparent text-[#383838] border border-[#b8b8b8] hover:bg-gray-50'
                }`}
              >
                Foot 1.0
              </button>
              <button
                disabled
                className="px-3 py-1 text-sm font-medium rounded-lg transition-colors bg-gray-100 text-gray-400 border border-gray-300 cursor-not-allowed relative"
              >
                <span className="flex items-center gap-2">
                  FE!N clipper
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </span>
              </button>
              <button
                disabled
                className="px-3 py-1 text-sm font-medium rounded-lg transition-colors bg-gray-100 text-gray-400 border border-gray-300 cursor-not-allowed relative"
              >
                <span className="flex items-center gap-2">
                  Creed Streamer
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </span>
              </button>
            </div>
          </div>
          
          <div className="flex flex-col space-y-6 mb-8">
            <div className="flex justify-between items-center">
              
              {/* Bouton flottant pour réafficher le popup de téléchargement */}
              {generatedVideos.length > 0 && !generationComplete && !isGenerating && (
                <button 
                  onClick={() => setGenerationComplete(true)}
                  className="fixed bottom-8 right-8 bg-gradient-to-r from-[#f8d4eb] via-[#ce7acb] to-[#e9bcba] text-[#0a0a0c] font-medium px-4 py-3 rounded-lg text-sm flex items-center gap-2 shadow-lg z-40"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                  </svg>
                  Download {generatedVideos.length} Videos
                </button>
              )}
            </div>
            <div className="flex flex-row h-[calc(100vh-100px)] rounded-2xl border border-[#d0d0ce]" style={{ backgroundColor: '#e6e6e1' }}>
              {/* Left Panel - Steps */}
              <div className="w-[calc(100%-250px)] sm:flex-1 overflow-y-auto">
                <div className="p-3 space-y-4">
                  {/* Top Row - Hook Input and Templates - visible seulement en mode video (sauf Add Hook, AutoCut et template Auto Lyrics) */}
                  {contentType === 'video' && selectedModel !== 'add-hook' && selectedModel !== 'twain-ya-gamila' && autoCutTemplate !== 'auto-lyrics' && (
                    <div className="grid grid-cols-1 [@media(min-width:1000px)]:grid-cols-2 gap-4">
                    {/* Hook Input - Not for Add Hook and template Auto Lyrics */}
                    {selectedModel !== 'add-hook' && autoCutTemplate !== 'auto-lyrics' && (
                    <section className="space-y-2 bg-[#f3f4f0] dark:bg-[#0e0f15] p-3 rounded-lg border border-[#d2d2d0]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">2</div>
                          <h2 className="text-base font-bold dark:text-white">Hook</h2>
                        </div>
                        <div className="relative">
                          <input
                            type="file"
                            accept=".txt"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="hook-file"
                          />
                          <label
                            htmlFor="hook-file"
                            className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Load
                          </label>
                        </div>
                      </div>
                      <Textarea
                        value={hooks}
                        onChange={(e) => setHooks(e.target.value)}
                        placeholder="Enter your hook here or load from a text file.."
                        className="min-h-[150px] dark:bg-[#18181a] dark:text-white dark:border-[#0e0f15] dark:placeholder:text-gray-400"
                        maxLength={500}
                      />
                      
                      {/* Font Selection - Hidden for Add Hook model */}
                      {selectedModel !== 'add-hook' && (
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Font Style: {selectedFonts.length > 1 && <span className="text-[#3e90fd]">({selectedFonts.length} selected)</span>}
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {(autoCutTemplate === 'auto-lyrics' ? fontsAutoLyrics : availableFonts).map((font) => (
                              <button
                                key={font.id}
                                onClick={() => toggleFont(font.id)}
                                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                  font.id === 'all'
                                    ? isAllFontsSelected()
                                      ? 'bg-[#3e90fd] text-white border-[#3e90fd]'
                                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-[#3e90fd]/50'
                                    : selectedFonts.includes(font.id)
                                      ? 'bg-[#3e90fd] text-white border-[#3e90fd]'
                                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-[#3e90fd]/50'
                                }`}
                              >
                                {font.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Font info for Add Hook model */}
                      {selectedModel === 'add-hook' && (
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Font Style: TikTok (Default)
                          </label>
                        </div>
                      )}

                      {/* Font and Lyrics Style moved to dedicated Step 4 section for Auto Lyrics */}

                      <div className="flex gap-2 mt-4">
                        {/* Show all styles for other models */}
                        {selectedModel !== 'add-hook' && autoCutTemplate !== 'auto-lyrics' && (
                          <>
                            <div
                              onClick={() => {
                                setSelectedStyles(new Set([1]));
                                setCurrentStyle(1);
                              }}
                              className={`flex-1 flex items-center justify-center p-4 rounded-lg cursor-pointer transition-all ${
                                selectedStyles.has(1)
                                  ? "bg-[#3e90fd] text-white dark:bg-[#3e90fd]"
                                  : "bg-[#e6e6e1] hover:bg-[#e6e6e1] dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white"
                              }`}
                            >
                              <div 
                                className={`text-sm font-semibold ${
                                  selectedStyles.has(1) 
                                    ? "text-white dark:text-white" 
                                    : "text-gray-700 dark:text-white"
                                }`}
                              >
                                Border
                              </div>
                            </div>

                            <div
                              onClick={() => {
                                setSelectedStyles(new Set([2]));
                                setCurrentStyle(2);
                              }}
                              className={`flex-1 flex items-center justify-center p-4 rounded-lg cursor-pointer transition-all ${
                                selectedStyles.has(2)
                                  ? "bg-[#3e90fd] text-white dark:bg-[#3e90fd]"
                                  : "bg-[#e6e6e1] hover:bg-[#e6e6e1] dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white"
                              }`}
                            >
                              <div 
                                className={`text-sm font-semibold ${
                                  selectedStyles.has(2) 
                                    ? "text-white dark:text-white" 
                                    : "text-gray-700 dark:text-white"
                                }`}
                              >
                                White
                              </div>
                            </div>
                            
                            <div
                              onClick={() => {
                                setSelectedStyles(new Set([3]));
                                setCurrentStyle(3);
                              }}
                              className={`flex-1 flex items-center justify-center p-4 rounded-lg cursor-pointer transition-all ${
                                selectedStyles.has(3)
                                  ? "bg-[#3e90fd] text-white dark:bg-[#3e90fd]"
                                  : "bg-[#e6e6e1] hover:bg-[#e6e6e1] dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white"
                              }`}
                            >
                              <div 
                                className={`text-sm font-semibold ${
                                  selectedStyles.has(3) 
                                    ? "text-white dark:text-white" 
                                    : "text-gray-700 dark:text-white"
                                }`}
                              >
                                Black
                              </div>
                            </div>
                            
                            <div
                              onClick={() => {
                                setSelectedStyles(new Set([4]));
                                setCurrentStyle(4);
                              }}
                              className={`flex-1 flex items-center justify-center p-4 rounded-lg cursor-pointer transition-all ${
                                selectedStyles.has(4)
                                  ? "bg-[#3e90fd] text-white dark:bg-[#3e90fd]"
                                  : "bg-[#e6e6e1] hover:bg-[#e6e6e1] dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white"
                              }`}
                            >
                              <div 
                                className={`text-sm font-semibold ${
                                  selectedStyles.has(4) 
                                    ? "text-white dark:text-white" 
                                    : "text-gray-700 dark:text-white"
                                }`}
                              >
                                Normal
                              </div>
                            </div>
                          </>
                        )}
                        
                        {/* Show only White and Black for Add Hook model */}
                        {selectedModel === 'add-hook' && (
                          <>
                            <div
                              onClick={() => {
                                setSelectedStyles(new Set([2]));
                                setCurrentStyle(2);
                              }}
                              className={`flex-1 flex items-center justify-center p-4 rounded-lg cursor-pointer transition-all ${
                                selectedStyles.has(2)
                                  ? "bg-[#3e90fd] text-white dark:bg-[#3e90fd]"
                                  : "bg-[#e6e6e1] hover:bg-[#e6e6e1] dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white"
                              }`}
                            >
                              <div 
                                className={`text-sm font-semibold ${
                                  selectedStyles.has(2) 
                                    ? "text-white dark:text-white" 
                                    : "text-gray-700 dark:text-white"
                                }`}
                              >
                                White
                              </div>
                            </div>
                            
                            <div
                              onClick={() => {
                                setSelectedStyles(new Set([3]));
                                setCurrentStyle(3);
                              }}
                              className={`flex-1 flex items-center justify-center p-4 rounded-lg cursor-pointer transition-all ${
                                selectedStyles.has(3)
                                  ? "bg-[#3e90fd] text-white dark:bg-[#3e90fd]"
                                  : "bg-[#e6e6e1] hover:bg-[#e6e6e1] dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white"
                              }`}
                            >
                              <div 
                                className={`text-sm font-semibold ${
                                  selectedStyles.has(3) 
                                    ? "text-white dark:text-white" 
                                    : "text-gray-700 dark:text-white"
                                }`}
                              >
                                Black
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </section>
                    )}

                    {/* Music Section - Only for videos, not slideshows or add-hook or autocut */}
                    {contentType === 'video' && selectedModel !== 'add-hook' && selectedModel !== 'twain-ya-gamila' && (
                      <section className="space-y-2 bg-[#f3f4f0] dark:bg-[#0e0f15] p-3 rounded-lg border border-[#d2d2d0]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">3</div>
                            <h2 className="text-base font-bold dark:text-white">Music</h2>
                          </div>
                        </div>
                        {isLoadingSongs ? (
                          <div className="h-[200px] flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5465ff]"></div>
                          </div>
                        ) : songs.length === 0 ? (
                          <div className="h-[200px] flex items-center justify-start pl-4 text-gray-500 dark:text-gray-400">
                            <div>
                              <p>No music available</p>
                              <p className="text-sm mt-2">Add music in the Music page first</p>
                            </div>
                          </div>
                        ) : (
                          <ScrollArea className="flex-1 h-[210px]">
                            <div className="py-2 space-y-2">
                              {/* Without Music Option */}
                              <div
                                onClick={() => setSelectedSong(selectedSong?.id === 'no-music' ? null : { 
                                  id: 'no-music', 
                                  user_id: '', 
                                  title: 'Without music', 
                                  artist: '', 
                                  duration: 0, 
                                  url: '', 
                                  cover_url: null, 
                                  created_at: '' 
                                })}
                                className={`flex items-center gap-3 p-2 pl-3 rounded-lg cursor-pointer transition-all ${
                                  selectedSong?.id === 'no-music'
                                    ? "bg-[#3e90fd] text-white dark:bg-[#3e90fd] dark:text-white"
                                    : "bg-[#e6e6e1] hover:bg-[#e6e6e1] dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white"
                                }`}
                              >
                                <div className="relative w-10 h-10 [@media(min-width:1000px)]:w-12 [@media(min-width:1000px)]:h-12 flex-shrink-0">
                                  <div className="w-full h-full bg-gray-200 dark:bg-[#18181a] rounded-md flex items-center justify-center border-2 border-dashed border-gray-400">
                                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400">NO</span>
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium truncate ${selectedSong?.id === 'no-music' ? "text-white dark:text-white" : "text-gray-700 dark:text-white"}`}>
                                    Without music
                                  </p>
                                  <p className={`text-xs truncate ${selectedSong?.id === 'no-music' ? "text-white/80 dark:text-white/80" : "text-gray-500 dark:text-gray-300"}`}>
                                    Create without background music
                                  </p>
                                </div>
                              </div>
                              {songs.map((song) => (
                                <div
                                  key={song.id}
                                  onClick={() => setSelectedSong(selectedSong?.id === song.id ? null : song)}
                                  className={`flex items-center gap-3 p-2 pl-3 rounded-lg cursor-pointer transition-all ${
                                    selectedSong?.id === song.id
                                      ? "bg-[#3e90fd] text-white dark:bg-[#3e90fd] dark:text-white"
                                      : "bg-[#e6e6e1] hover:bg-[#e6e6e1] dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white"
                                  }`}
                                >
                                  <div className="relative w-10 h-10 [@media(min-width:1000px)]:w-12 [@media(min-width:1000px)]:h-12 flex-shrink-0">
                                    {song.cover_url ? (
                                      <Image
                                        src={song.cover_url}
                                        alt={song.title}
                                        layout="fill"
                                        className="object-cover rounded-md"
                                        sizes="(max-width: 1000px) 40px, 48px"
                                      />
                                    ) : (
                                      <div className="w-full h-full bg-gray-200 dark:bg-[#18181a] rounded-md flex items-center justify-center">
                                        <MusicIcon className="h-5 w-5 [@media(min-width:1000px)]:h-6 [@media(min-width:1000px)]:w-6 text-gray-500" />
                                      </div>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePlayPause(song);
                                      }}
                                      className={`absolute inset-0 flex items-center justify-center bg-black/30 rounded-md ${
                                        currentlyPlaying === song.id ? "opacity-100" : "opacity-0 hover:opacity-100"
                                      }`}
                                    >
                                      {currentlyPlaying === song.id ? (
                                        <PauseIcon className="h-5 w-5 [@media(min-width:1000px)]:h-6 [@media(min-width:1000px)]:w-6 text-white" />
                                      ) : (
                                        <PlayIcon className="h-5 w-5 [@media(min-width:1000px)]:h-6 [@media(min-width:1000px)]:w-6 text-white" />
                                      )}
                                    </button>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${selectedSong?.id === song.id ? "text-white dark:text-white" : "text-gray-700 dark:text-white"}`}>
                                      {song.title}
                                    </p>
                                    <p className={`text-xs truncate ${selectedSong?.id === song.id ? "text-white/80 dark:text-white/80" : "text-gray-500 dark:text-gray-300"}`}>
                                      {song.artist} • {formatDuration(song.duration)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        )}
                      </section>
                    )}

                    </div>
                  )}

                  {/* Second Row - Hooks and Logos Storage - visible seulement en mode video */}
                  {contentType === 'video' && (
                    <div className="grid grid-cols-1 [@media(min-width:1000px)]:grid-cols-2 gap-4">
                    </div>
                  )}

                  {/* Bottom Row - Templates and Videos */}
                  {contentType === 'slideshow' ? (
                    // Layout Slideshow
                    <div className="col-span-1">
                      <div className="space-y-6">
                        {/* Sélection nombre d'images */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0]">
                          <h2 className="text-lg font-bold dark:text-white">Slideshow Configuration</h2>
                          
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Number of images
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="20"
                                value={slideshowImageCount}
                                onChange={(e) => setSlideshowImageCount(parseInt(e.target.value) || 1)}
                                className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-800 dark:text-white"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Upload mode
                              </label>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setSlideshowUploadMode('ordered')}
                                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    slideshowUploadMode === 'ordered'
                                      ? 'bg-[#3e90fd] text-white'
                                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  Ordered (Image 1, Image 2...)
                                </button>
                                <button
                                  onClick={() => setSlideshowUploadMode('random')}
                                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    slideshowUploadMode === 'random'
                                      ? 'bg-[#3e90fd] text-white'
                                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  All images (random order)
                                </button>
                              </div>
                            </div>
                          </div>
                        </section>

                        {/* Hooks par image */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0]">
                          <h2 className="text-lg font-bold dark:text-white">Hooks per Image</h2>
                          
                          <div className="space-y-3">
                            {Array.from({ length: slideshowImageCount }, (_, index) => (
                              <div key={index} className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Image {index + 1} hooks (optional)
                                </label>
                                <Textarea
                                  value={slideshowHooksPerImage[index] || ''}
                                  onChange={(e) => {
                                    setSlideshowHooksPerImage(prev => ({
                                      ...prev,
                                      [index]: e.target.value
                                    }));
                                  }}
                                  placeholder="Enter hooks for this image, one per line..."
                                  className="min-h-[80px] dark:bg-gray-800 dark:text-white dark:border-gray-600"
                                />
                              </div>
                            ))}
                          </div>
                        </section>

                        {/* Upload d'images */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0]">
                          <h2 className="text-lg font-bold dark:text-white">Upload Images</h2>
                          
                          {slideshowUploadMode === 'ordered' ? (
                            <div className="space-y-4">
                              {Array.from({ length: slideshowImageCount }, (_, index) => {
                                const handleImageDrop = (files: File[]) => {
                                  if (files.length > 0) {
                                    setSlideshowImages(prev => {
                                      const newImages = [...prev];
                                      newImages[index] = files[0];
                                      return newImages;
                                    });
                                  }
                                };

                                return (
                                  <div key={index} className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                      Image {index + 1}
                                    </label>
                                    <div
                                      onClick={() => {
                                        const input = document.createElement('input');
                                        input.type = 'file';
                                        input.accept = 'image/*';
                                        input.onchange = (e) => {
                                          const files = (e.target as HTMLInputElement).files;
                                          if (files && files.length > 0) {
                                            handleImageDrop([files[0]]);
                                          }
                                        };
                                        input.click();
                                      }}
                                      onDragOver={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                      }}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const files = Array.from(e.dataTransfer.files);
                                        handleImageDrop(files);
                                      }}
                                      className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                                    >
                                      {slideshowImages[index] ? (
                                        <div className="flex items-center gap-2">
                                          <span className="text-green-600 dark:text-green-400">✓</span>
                                          <span className="text-sm">{slideshowImages[index].name}</span>
                                        </div>
                                      ) : (
                                        <p className="text-gray-500 dark:text-gray-400">Drop image here or click to upload</p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.multiple = true;
                                input.onchange = (e) => {
                                  const files = (e.target as HTMLInputElement).files;
                                  if (files) {
                                    setSlideshowImages(Array.from(files).slice(0, slideshowImageCount));
                                  }
                                };
                                input.click();
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const files = Array.from(e.dataTransfer.files);
                                setSlideshowImages(files.slice(0, slideshowImageCount));
                              }}
                              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                            >
                              {slideshowImages.length > 0 ? (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-center gap-2">
                                    <span className="text-green-600 dark:text-green-400">✓</span>
                                    <span className="text-sm">{slideshowImages.length} images uploaded</span>
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {slideshowImages.map(img => img.name).join(', ')}
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <p className="text-gray-500 dark:text-gray-400">Drop all images here or click to upload</p>
                                  <p className="text-xs text-gray-400 dark:text-gray-500">Upload up to {slideshowImageCount} images</p>
                                </div>
                              )}
                            </div>
                          )}
                        </section>
                      </div>
                    </div>
                  ) : selectedModel === 'fein-clipper' ? (
                    // Layout Max Combinaisons - steps 3–12 (10 parts)
                    <div className="col-span-1">
                      <div className="grid grid-cols-1 [@media(min-width:1000px)]:grid-cols-2 gap-4">
                        {/* Part 1 */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">3</div>
                              <h2 className="text-base font-bold dark:text-white">Part 1 <span className="text-xs font-normal text-gray-500">(00:00-00:09)</span></h2>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <input
                                type="file"
                                accept="video/*"
                                multiple
                                onChange={handleMaxCombinaisonsVideoUpload('part1')}
                                className="hidden"
                                id="part1-videos"
                              />
                              <label
                                htmlFor="part1-videos"
                                className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal"
                              >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Upload
                              </label>
                              <FolderSelector partKey="part1" />
                            </div>
                          </div>
                          <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                              {maxCombinaisonsParts.part1.length} videos
                            </div>
                            <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                              {maxCombinaisonsParts.part1.map((video, index) => (
                                <VideoThumbnail key={index} video={video} partKey="part1" index={index} onRemove={removeMaxCombinaisonsVideo} getVideoUrl={getVideoUrl} />
                              ))}
                            </div>
                          </div>
                        </section>

                        {/* Part 2 */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">4</div>
                              <h2 className="text-base font-bold dark:text-white">Part 2 <span className="text-xs font-normal text-gray-500">(00:09-00:10)</span></h2>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <input type="file" accept="video/*" multiple onChange={handleMaxCombinaisonsVideoUpload('part2')} className="hidden" id="part2-videos" />
                              <label htmlFor="part2-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Upload
                              </label>
                              <FolderSelector partKey="part2" />
                            </div>
                          </div>
                          <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{maxCombinaisonsParts.part2.length} videos</div>
                            <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                              {maxCombinaisonsParts.part2.map((video, index) => (
                                <VideoThumbnail key={index} video={video} partKey="part2" index={index} onRemove={removeMaxCombinaisonsVideo} getVideoUrl={getVideoUrl} />
                              ))}
                            </div>
                          </div>
                        </section>

                        {/* Part 3 */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">5</div>
                              <h2 className="text-base font-bold dark:text-white">Part 3 <span className="text-xs font-normal text-gray-500">(00:10-00:11)</span></h2>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <input type="file" accept="video/*" multiple onChange={handleMaxCombinaisonsVideoUpload('part3')} className="hidden" id="part3-videos" />
                              <label htmlFor="part3-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Upload
                              </label>
                              <FolderSelector partKey="part3" />
                            </div>
                          </div>
                          <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{maxCombinaisonsParts.part3.length} videos</div>
                            <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                              {maxCombinaisonsParts.part3.map((video, index) => (
                                <VideoThumbnail key={index} video={video} partKey="part3" index={index} onRemove={removeMaxCombinaisonsVideo} getVideoUrl={getVideoUrl} />
                              ))}
                            </div>
                          </div>
                        </section>

                        {/* Part 4 */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">6</div>
                              <h2 className="text-base font-bold dark:text-white">Part 4 <span className="text-xs font-normal text-gray-500">(00:11-00:11)</span></h2>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <input type="file" accept="video/*" multiple onChange={handleMaxCombinaisonsVideoUpload('part4')} className="hidden" id="part4-videos" />
                              <label htmlFor="part4-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Upload
                              </label>
                              <FolderSelector partKey="part4" />
                            </div>
                          </div>
                          <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{maxCombinaisonsParts.part4.length} videos</div>
                            <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                              {maxCombinaisonsParts.part4.map((video, index) => (
                                <VideoThumbnail key={index} video={video} partKey="part4" index={index} onRemove={removeMaxCombinaisonsVideo} getVideoUrl={getVideoUrl} />
                              ))}
                            </div>
                          </div>
                        </section>

                        {/* Part 5 */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">7</div>
                              <h2 className="text-base font-bold dark:text-white">Part 5 <span className="text-xs font-normal text-gray-500">(00:11-00:12)</span></h2>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <input type="file" accept="video/*" multiple onChange={handleMaxCombinaisonsVideoUpload('part5')} className="hidden" id="part5-videos" />
                              <label htmlFor="part5-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Upload
                              </label>
                              <FolderSelector partKey="part5" />
                            </div>
                          </div>
                          <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{maxCombinaisonsParts.part5.length} videos</div>
                            <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                              {maxCombinaisonsParts.part5.map((video, index) => (
                                <VideoThumbnail key={index} video={video} partKey="part5" index={index} onRemove={removeMaxCombinaisonsVideo} getVideoUrl={getVideoUrl} />
                              ))}
                            </div>
                          </div>
                        </section>

                        {/* Part 6 */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">8</div>
                              <h2 className="text-base font-bold dark:text-white">Part 6 <span className="text-xs font-normal text-gray-500">(00:12-00:12)</span></h2>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <input type="file" accept="video/*" multiple onChange={handleMaxCombinaisonsVideoUpload('part6')} className="hidden" id="part6-videos" />
                              <label htmlFor="part6-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Upload
                              </label>
                              <FolderSelector partKey="part6" />
                            </div>
                          </div>
                          <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{maxCombinaisonsParts.part6.length} videos</div>
                            <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                              {maxCombinaisonsParts.part6.map((video, index) => (
                                <VideoThumbnail key={index} video={video} partKey="part6" index={index} onRemove={removeMaxCombinaisonsVideo} getVideoUrl={getVideoUrl} />
                              ))}
                            </div>
                          </div>
                        </section>

                        {/* Part 7 */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">9</div>
                              <h2 className="text-base font-bold dark:text-white">Part 7 <span className="text-xs font-normal text-gray-500">(00:12-00:13)</span></h2>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <input type="file" accept="video/*" multiple onChange={handleMaxCombinaisonsVideoUpload('part7')} className="hidden" id="part7-videos" />
                              <label htmlFor="part7-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Upload
                              </label>
                              <FolderSelector partKey="part7" />
                            </div>
                          </div>
                          <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{maxCombinaisonsParts.part7.length} videos</div>
                            <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                              {maxCombinaisonsParts.part7.map((video, index) => (
                                <VideoThumbnail key={index} video={video} partKey="part7" index={index} onRemove={removeMaxCombinaisonsVideo} getVideoUrl={getVideoUrl} />
                              ))}
                            </div>
                          </div>
                        </section>

                        {/* Part 8 */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">10</div>
                              <h2 className="text-base font-bold dark:text-white">Part 8 <span className="text-xs font-normal text-gray-500">(00:13-00:14)</span></h2>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <input type="file" accept="video/*" multiple onChange={handleMaxCombinaisonsVideoUpload('part8')} className="hidden" id="part8-videos" />
                              <label htmlFor="part8-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Upload
                              </label>
                              <FolderSelector partKey="part8" />
                            </div>
                          </div>
                          <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{maxCombinaisonsParts.part8.length} videos</div>
                            <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                              {maxCombinaisonsParts.part8.map((video, index) => (
                                <VideoThumbnail key={index} video={video} partKey="part8" index={index} onRemove={removeMaxCombinaisonsVideo} getVideoUrl={getVideoUrl} />
                              ))}
                            </div>
                          </div>
                        </section>

                        {/* Part 9 */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">11</div>
                              <h2 className="text-base font-bold dark:text-white">Part 9 <span className="text-xs font-normal text-gray-500">(00:14-00:16)</span></h2>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <input type="file" accept="video/*" multiple onChange={handleMaxCombinaisonsVideoUpload('part9')} className="hidden" id="part9-videos" />
                              <label htmlFor="part9-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Upload
                              </label>
                              <FolderSelector partKey="part9" />
                            </div>
                          </div>
                          <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{maxCombinaisonsParts.part9.length} videos</div>
                            <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                              {maxCombinaisonsParts.part9.map((video, index) => (
                                <VideoThumbnail key={index} video={video} partKey="part9" index={index} onRemove={removeMaxCombinaisonsVideo} getVideoUrl={getVideoUrl} />
                              ))}
                            </div>
                          </div>
                        </section>

                        {/* Part 10 */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">12</div>
                              <h2 className="text-base font-bold dark:text-white">Part 10 <span className="text-xs font-normal text-gray-500">(00:16-00:21)</span></h2>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <input type="file" accept="video/*" multiple onChange={handleMaxCombinaisonsVideoUpload('part10')} className="hidden" id="part10-videos" />
                              <label htmlFor="part10-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Upload
                              </label>
                              <FolderSelector partKey="part10" />
                            </div>
                          </div>
                          <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{maxCombinaisonsParts.part10.length} videos</div>
                            <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                              {maxCombinaisonsParts.part10.map((video, index) => (
                                <VideoThumbnail key={index} video={video} partKey="part10" index={index} onRemove={removeMaxCombinaisonsVideo} getVideoUrl={getVideoUrl} />
                              ))}
                            </div>
                          </div>
                        </section>

                        {/* Part 11 - Logo */}
                        <section className="space-y-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-lg shadow-sm min-h-[280px] [@media(min-width:1000px)]:col-span-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 text-white font-bold text-sm">
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </div>
                              <h2 className="text-base font-bold dark:text-white">Logo (Part 11)</h2>
                              <span className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full">Optional - Will overlay on all videos</span>
                            </div>
                            <div className="relative flex items-center gap-3">
                              <input type="file" accept="image/*" onChange={handleMaxCombinaisonsVideoUpload('logo')} className="hidden" id="logo-upload" />
                              <label htmlFor="logo-upload" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Upload Logo
                              </label>
                            </div>
                          </div>
                          <div className="bg-[#e6e6e1] dark:bg-[#18181a]/50 p-3 rounded-lg">
                            {maxCombinaisonsParts.logo.length > 0 ? (
                              <div className="space-y-4">
                                {/* Logo preview avec contrôles */}
                                <div className="flex items-center justify-center">
                                  <div className="relative">
                                    <img 
                                      src={getVideoUrl(maxCombinaisonsParts.logo[0])} 
                                      className="max-h-32 max-w-full object-contain rounded-lg shadow-lg" 
                                      alt="Logo"
                                    />
                                    <button 
                                      onClick={() => removeMaxCombinaisonsVideo('logo', 0)} 
                                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg transition-colors"
                                      title="Remove logo"
                                    >
                                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                                
                                {/* Info sur la position fixe du logo */}
                                <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                                  <div className="flex items-start gap-2">
                                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M12 2l10 5v10c0 5.55-3.84 10.74-9 12-5.16-1.26-9-6.45-9-12V7l10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <div className="space-y-1">
                                      <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Logo Settings (Fixed)</p>
                                      <p className="text-xs text-purple-600 dark:text-purple-400">
                                        Size: 30% • Position: Center-Bottom
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-8">
                                <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                                  <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                                  <path d="M21 15l-5-5L8 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <p className="text-sm text-gray-500 dark:text-gray-400">No logo uploaded</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Upload a logo to customize its position and size</p>
                              </div>
                            )}
                          </div>
                        </section>

                        {/* Summary */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-center [@media(min-width:1000px)]:col-span-2">
                          <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                            Total combinations: {(() => {
                              const counts = [
                                maxCombinaisonsParts.part1.length,
                                maxCombinaisonsParts.part2.length,
                                maxCombinaisonsParts.part3.length,
                                maxCombinaisonsParts.part4.length,
                                maxCombinaisonsParts.part5.length,
                                maxCombinaisonsParts.part6.length,
                                maxCombinaisonsParts.part7.length,
                                maxCombinaisonsParts.part8.length,
                                maxCombinaisonsParts.part9.length,
                                maxCombinaisonsParts.part10.length
                              ];
                              const product = counts.reduce((acc, count) => acc * (count || 1), 1);
                              const hasAllParts = counts.every(count => count > 0);
                              return hasAllParts ? product.toLocaleString() : '0';
                            })()}
                          </div>
                          <div className="text-xs text-blue-700 dark:text-blue-300">
                            Upload at least 1 video in each part (1-10) to generate combinations
                          </div>
                          {maxCombinaisonsParts.logo.length > 0 && (
                            <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                              ✓ Logo will be added to all videos
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : selectedModel === 'creed-streamer' ? (
                    // Layout Creed Streamer - 11 parties
                    <div className="col-span-1">
                      <div className="grid grid-cols-1 [@media(min-width:1000px)]:grid-cols-2 gap-4">
                        {/* Part 1 */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">1</div>
                              <h2 className="text-base font-bold dark:text-white">Part 1 <span className="text-xs font-normal text-gray-500">(00:00-00:14s)</span></h2>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <input
                                type="file"
                                accept="video/*"
                                multiple
                                onChange={handleCreedStreamerVideoUpload('part1')}
                                className="hidden"
                                id="creed-part1-videos"
                              />
                              <label
                                htmlFor="creed-part1-videos"
                                className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal"
                              >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Upload
                              </label>
                              <CreedFolderSelector partKey="creed-part1" />
                            </div>
                          </div>
                          <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                              {creedStreamerParts.part1.length} videos
                            </div>
                            <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                              {creedStreamerParts.part1.map((video, index) => (
                                <VideoThumbnail key={index} video={video} partKey="part1" index={index} onRemove={removeCreedStreamerVideo} getVideoUrl={getVideoUrl} />
                              ))}
                            </div>
                          </div>
                        </section>

                        {/* Part 2 */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">2</div>
                              <h2 className="text-base font-bold dark:text-white">Part 2 <span className="text-xs font-normal text-gray-500">(00:14-00:14s)</span></h2>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <input type="file" accept="video/*" multiple onChange={handleCreedStreamerVideoUpload('part2')} className="hidden" id="creed-part2-videos" />
                              <label htmlFor="creed-part2-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Upload
                              </label>
                              <CreedFolderSelector partKey="creed-part2" />
                            </div>
                          </div>
                          <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{creedStreamerParts.part2.length} videos</div>
                            <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                              {creedStreamerParts.part2.map((video, index) => (
                                <VideoThumbnail key={index} video={video} partKey="part2" index={index} onRemove={removeCreedStreamerVideo} getVideoUrl={getVideoUrl} />
                              ))}
                            </div>
                          </div>
                        </section>

                        {/* Part 3 */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">3</div>
                              <h2 className="text-base font-bold dark:text-white">Part 3 <span className="text-xs font-normal text-gray-500">(00:14-00:14s)</span></h2>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <input type="file" accept="video/*" multiple onChange={handleCreedStreamerVideoUpload('part3')} className="hidden" id="creed-part3-videos" />
                              <label htmlFor="creed-part3-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Upload
                              </label>
                              <CreedFolderSelector partKey="creed-part3" />
                            </div>
                          </div>
                          <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{creedStreamerParts.part3.length} videos</div>
                            <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                              {creedStreamerParts.part3.map((video, index) => (
                                <VideoThumbnail key={index} video={video} partKey="part3" index={index} onRemove={removeCreedStreamerVideo} getVideoUrl={getVideoUrl} />
                              ))}
                            </div>
                          </div>
                        </section>

                        {/* Part 4 */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">4</div>
                              <h2 className="text-base font-bold dark:text-white">Part 4 <span className="text-xs font-normal text-gray-500">(00:14-00:15s)</span></h2>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <input type="file" accept="video/*" multiple onChange={handleCreedStreamerVideoUpload('part4')} className="hidden" id="creed-part4-videos" />
                              <label htmlFor="creed-part4-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Upload
                              </label>
                              <CreedFolderSelector partKey="creed-part4" />
                            </div>
                          </div>
                          <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{creedStreamerParts.part4.length} videos</div>
                            <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                              {creedStreamerParts.part4.map((video, index) => (
                                <VideoThumbnail key={index} video={video} partKey="part4" index={index} onRemove={removeCreedStreamerVideo} getVideoUrl={getVideoUrl} />
                              ))}
                            </div>
                          </div>
                        </section>

                        {/* Part 5 */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">5</div>
                              <h2 className="text-base font-bold dark:text-white">Part 5 <span className="text-xs font-normal text-gray-500">(00:15-00:19s)</span></h2>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <input type="file" accept="video/*" multiple onChange={handleCreedStreamerVideoUpload('part5')} className="hidden" id="creed-part5-videos" />
                              <label htmlFor="creed-part5-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Upload
                              </label>
                              <CreedFolderSelector partKey="creed-part5" />
                            </div>
                          </div>
                          <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{creedStreamerParts.part5.length} videos</div>
                            <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                              {creedStreamerParts.part5.map((video, index) => (
                                <VideoThumbnail key={index} video={video} partKey="part5" index={index} onRemove={removeCreedStreamerVideo} getVideoUrl={getVideoUrl} />
                              ))}
                            </div>
                          </div>
                        </section>

                        {/* Part 6 */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">6</div>
                              <h2 className="text-base font-bold dark:text-white">Part 6 <span className="text-xs font-normal text-gray-500">(00:19-00:19s)</span></h2>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <input type="file" accept="video/*" multiple onChange={handleCreedStreamerVideoUpload('part6')} className="hidden" id="creed-part6-videos" />
                              <label htmlFor="creed-part6-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Upload
                              </label>
                              <CreedFolderSelector partKey="creed-part6" />
                            </div>
                          </div>
                          <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{creedStreamerParts.part6.length} videos</div>
                            <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                              {creedStreamerParts.part6.map((video, index) => (
                                <VideoThumbnail key={index} video={video} partKey="part6" index={index} onRemove={removeCreedStreamerVideo} getVideoUrl={getVideoUrl} />
                              ))}
                            </div>
                          </div>
                        </section>

                        {/* Part 7 */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">7</div>
                              <h2 className="text-base font-bold dark:text-white">Part 7 <span className="text-xs font-normal text-gray-500">(00:19-00:19s)</span></h2>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <input type="file" accept="video/*" multiple onChange={handleCreedStreamerVideoUpload('part7')} className="hidden" id="creed-part7-videos" />
                              <label htmlFor="creed-part7-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Upload
                              </label>
                              <CreedFolderSelector partKey="creed-part7" />
                            </div>
                          </div>
                          <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{creedStreamerParts.part7.length} videos</div>
                            <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                              {creedStreamerParts.part7.map((video, index) => (
                                <VideoThumbnail key={index} video={video} partKey="part7" index={index} onRemove={removeCreedStreamerVideo} getVideoUrl={getVideoUrl} />
                              ))}
                            </div>
                          </div>
                        </section>

                        {/* Part 8 */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">8</div>
                              <h2 className="text-base font-bold dark:text-white">Part 8 <span className="text-xs font-normal text-gray-500">(00:19-00:20s)</span></h2>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <input type="file" accept="video/*" multiple onChange={handleCreedStreamerVideoUpload('part8')} className="hidden" id="creed-part8-videos" />
                              <label htmlFor="creed-part8-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Upload
                              </label>
                              <CreedFolderSelector partKey="creed-part8" />
                            </div>
                          </div>
                          <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{creedStreamerParts.part8.length} videos</div>
                            <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                              {creedStreamerParts.part8.map((video, index) => (
                                <VideoThumbnail key={index} video={video} partKey="part8" index={index} onRemove={removeCreedStreamerVideo} getVideoUrl={getVideoUrl} />
                              ))}
                            </div>
                          </div>
                        </section>

                        {/* Part 9 */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">9</div>
                              <h2 className="text-base font-bold dark:text-white">Part 9 <span className="text-xs font-normal text-gray-500">(00:20-00:20s)</span></h2>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <input type="file" accept="video/*" multiple onChange={handleCreedStreamerVideoUpload('part9')} className="hidden" id="creed-part9-videos" />
                              <label htmlFor="creed-part9-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Upload
                              </label>
                              <CreedFolderSelector partKey="creed-part9" />
                            </div>
                          </div>
                          <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{creedStreamerParts.part9.length} videos</div>
                            <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                              {creedStreamerParts.part9.map((video, index) => (
                                <VideoThumbnail key={index} video={video} partKey="part9" index={index} onRemove={removeCreedStreamerVideo} getVideoUrl={getVideoUrl} />
                              ))}
                            </div>
                          </div>
                        </section>

                        {/* Part 10 */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">10</div>
                              <h2 className="text-base font-bold dark:text-white">Part 10 <span className="text-xs font-normal text-gray-500">(00:20-00:20s)</span></h2>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <input type="file" accept="video/*" multiple onChange={handleCreedStreamerVideoUpload('part10')} className="hidden" id="creed-part10-videos" />
                              <label htmlFor="creed-part10-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Upload
                              </label>
                              <CreedFolderSelector partKey="creed-part10" />
                            </div>
                          </div>
                          <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{creedStreamerParts.part10.length} videos</div>
                            <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                              {creedStreamerParts.part10.map((video, index) => (
                                <VideoThumbnail key={index} video={video} partKey="part10" index={index} onRemove={removeCreedStreamerVideo} getVideoUrl={getVideoUrl} />
                              ))}
                            </div>
                          </div>
                        </section>

                        {/* Part 11 */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">11</div>
                              <h2 className="text-base font-bold dark:text-white">Part 11 <span className="text-xs font-normal text-gray-500">(00:20-00:24s)</span></h2>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <input type="file" accept="video/*" multiple onChange={handleCreedStreamerVideoUpload('part11')} className="hidden" id="creed-part11-videos" />
                              <label htmlFor="creed-part11-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Upload
                              </label>
                              <CreedFolderSelector partKey="creed-part11" />
                            </div>
                          </div>
                          <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{creedStreamerParts.part11.length} videos</div>
                            <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                              {creedStreamerParts.part11.map((video, index) => (
                                <VideoThumbnail key={index} video={video} partKey="part11" index={index} onRemove={removeCreedStreamerVideo} getVideoUrl={getVideoUrl} />
                              ))}
                            </div>
                          </div>
                        </section>

                        {/* Logo Section */}
                        <section className="space-y-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-lg shadow-sm min-h-[280px] [@media(min-width:1000px)]:col-span-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 text-white font-bold text-sm">
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </div>
                              <h2 className="text-base font-bold dark:text-white">Logo (Part 11)</h2>
                              <span className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full">Optional - Will overlay on all videos</span>
                            </div>
                            <div className="relative flex items-center gap-3">
                              <input type="file" accept="image/*" onChange={handleCreedStreamerVideoUpload('logo')} className="hidden" id="creed-logo-upload" />
                              <label htmlFor="creed-logo-upload" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Upload Logo
                              </label>
                            </div>
                          </div>
                          <div className="bg-[#e6e6e1] dark:bg-[#18181a]/50 p-3 rounded-lg">
                            {creedStreamerParts.logo.length > 0 ? (
                              <div className="space-y-4">
                                {/* Logo preview avec contrôles */}
                                <div className="flex items-center justify-center">
                                  <div className="relative">
                                    <img 
                                      src={getVideoUrl(creedStreamerParts.logo[0])} 
                                      className="max-h-32 max-w-full object-contain rounded-lg shadow-lg" 
                                      alt="Logo"
                                    />
                                    <button 
                                      onClick={() => removeCreedStreamerVideo('logo', 0)} 
                                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg transition-colors"
                                      title="Remove logo"
                                    >
                                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                                
                                {/* Info sur la position fixe du logo */}
                                <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                                  <div className="flex items-start gap-2">
                                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M12 2l10 5v10c0 5.55-3.84 10.74-9 12-5.16-1.26-9-6.45-9-12V7l10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <div className="space-y-1">
                                      <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Logo Settings (Fixed)</p>
                                      <p className="text-xs text-purple-600 dark:text-purple-400">
                                        Size: 20% • Position: Center-Bottom
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-8">
                                <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                                  <path d="M8 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <div className="text-gray-400 dark:text-gray-500 mb-1 font-medium">No logo uploaded</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Upload a logo to customize its position and size</div>
                              </div>
                            )}
                          </div>
                        </section>

                        {/* Summary */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-center [@media(min-width:1000px)]:col-span-2">
                          <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                            Total combinations: {(() => {
                              const counts = [
                                creedStreamerParts.part1.length,
                                creedStreamerParts.part2.length,
                                creedStreamerParts.part3.length,
                                creedStreamerParts.part4.length,
                                creedStreamerParts.part5.length,
                                creedStreamerParts.part6.length,
                                creedStreamerParts.part7.length,
                                creedStreamerParts.part8.length,
                                creedStreamerParts.part9.length,
                                creedStreamerParts.part10.length,
                                creedStreamerParts.part11.length
                              ];
                              const product = counts.reduce((acc, count) => acc * (count || 1), 1);
                              const hasAllParts = counts.every(count => count > 0);
                              return hasAllParts ? product.toLocaleString() : '0';
                            })()}
                          </div>
                          <div className="text-xs text-blue-700 dark:text-blue-300">
                            Upload at least 1 video in each part (1-11) to generate combinations
                          </div>
                          {creedStreamerParts.logo.length > 0 && (
                            <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                              ✓ Logo will be added to all videos
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : selectedModel === 'versus' ? (
                    // Layout Versus - steps 3–10
                    <div className="col-span-1">
                      <div className="grid grid-cols-1 [@media(min-width:1000px)]:grid-cols-2 gap-4">
                        {/* Step 3 - Arrives stadium */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">3</div>
                              <h2 className="text-base font-bold dark:text-white">Arrives stadium</h2>
                          </div>
                          <div className="relative flex items-center gap-3">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{versusEnabled.arrivesStadium ? 'Enabled' : 'Disabled'}</span>
                            <input
                              type="file"
                              accept="video/*"
                              multiple
                              onChange={handleVersusVideoUpload('arrivesStadium')}
                              className="hidden"
                              id="arrives-stadium-videos"
                            />
                            <label
                              htmlFor="arrives-stadium-videos"
                              className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Upload
                            </label>
                          </div>
                        </div>

                        {/* Final duration moved to Step 7 (Celebrations) */}

                        <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-sm dark:text-white">Upload Arrives stadium</h3>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                            {versusParts.arrivesStadium.length} videos
                          </div>
                          <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                            {versusParts.arrivesStadium.map((video, index) => (
                              <div key={index} className="relative aspect-[9/16] rounded overflow-hidden border border-gray-200 dark:border-gray-600">
                                <video
                                  src={URL.createObjectURL(video)}
                                  className="w-full h-full object-cover"
                                  muted
                                />
                                <button
                                  onClick={() => removeVersusVideo('arrivesStadium', index)}
                                  className="absolute top-0.5 right-0.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 opacity-80 hover:opacity-100 transition-opacity"
                                  title="Remove video"
                                >
                                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </section>

                       {/* Step 4 - Training */}
                      <section className="space-y-3 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">4</div>
                            <h2 className="text-base font-bold dark:text-white">Training</h2>
                          </div>
                          <div className="relative flex items-center gap-3">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{versusEnabled.training ? 'Enabled' : 'Disabled'}</span>
                            <input type="file" accept="video/*" multiple onChange={handleVersusVideoUpload('training')} className="hidden" id="training-videos" />
                            <label htmlFor="training-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Upload
                            </label>
                          </div>
                        </div>
                        <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-sm dark:text-white">Upload Training</h3>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{versusParts.training.length} videos</div>
                          <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                            {versusParts.training.map((video, index) => (
                              <div key={index} className="relative aspect-[9/16] rounded overflow-hidden border border-gray-200 dark:border-gray-600">
                                <video src={URL.createObjectURL(video)} className="w-full h-full object-cover" muted />
                                <button onClick={() => removeVersusVideo('training', index)} className="absolute top-0.5 right-0.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 opacity-80 hover:opacity-100 transition-opacity" title="Remove video">
                                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </section>

                       {/* Step 5 - Entry */}
                      <section className="space-y-3 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">5</div>
                            <h2 className="text-base font-bold dark:text-white">Entry</h2>
                          </div>
                          <div className="relative flex items-center gap-3">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{versusEnabled.entry ? 'Enabled' : 'Disabled'}</span>
                            <input type="file" accept="video/*" multiple onChange={handleVersusVideoUpload('entry')} className="hidden" id="entry-videos" />
                            <label htmlFor="entry-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Upload
                            </label>
                          </div>
                        </div>
                        <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-sm dark:text-white">Upload Entry</h3>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{versusParts.entry.length} videos</div>
                          <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                            {versusParts.entry.map((video, index) => (
                              <div key={index} className="relative aspect-[9/16] rounded overflow-hidden border border-gray-200 dark:border-gray-600">
                                <video src={URL.createObjectURL(video)} className="w-full h-full object-cover" muted />
                                <button onClick={() => removeVersusVideo('entry', index)} className="absolute top-0.5 right-0.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 opacity-80 hover:opacity-100 transition-opacity" title="Remove video">
                                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </section>

                       {/* Step 6 - Lineup */}
                      <section className="space-y-3 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">6</div>
                            <h2 className="text-base font-bold dark:text-white">Lineup</h2>
                          </div>
                          <div className="relative flex items-center gap-3">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{versusEnabled.lineup ? 'Enabled' : 'Disabled'}</span>
                            <input type="file" accept="video/*" multiple onChange={handleVersusVideoUpload('lineup')} className="hidden" id="lineup-videos" />
                            <label htmlFor="lineup-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Upload
                            </label>
                          </div>
                        </div>
                        <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-sm dark:text-white">Upload Lineup</h3>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{versusParts.lineup.length} videos</div>
                          <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                            {versusParts.lineup.map((video, index) => (
                              <div key={index} className="relative aspect-[9/16] rounded overflow-hidden border border-gray-200 dark:border-gray-600">
                                <video src={URL.createObjectURL(video)} className="w-full h-full object-cover" muted />
                                <button onClick={() => removeVersusVideo('lineup', index)} className="absolute top-0.5 right-0.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 opacity-80 hover:opacity-100 transition-opacity" title="Remove video">
                                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </section>

                       {/* Step 7 - Face cam */}
                      <section className="space-y-3 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">7</div>
                            <h2 className="text-base font-bold dark:text-white">Face cam</h2>
                          </div>
                          <div className="relative flex items-center gap-3">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{versusEnabled.faceCam ? 'Enabled' : 'Disabled'}</span>
                            <input type="file" accept="video/*" multiple onChange={handleVersusVideoUpload('faceCam')} className="hidden" id="face-cam-videos" />
                            <label htmlFor="face-cam-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Upload
                            </label>
                          </div>
                        </div>
                        <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-sm dark:text-white">Upload Face cam</h3>
                            {/* No final duration controls in Versus: duration = sum of clip durations */}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{versusParts.faceCam.length} videos</div>
                          <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                            {versusParts.faceCam.map((video, index) => (
                              <div key={index} className="relative aspect-[9/16] rounded overflow-hidden border border-gray-200 dark:border-gray-600">
                                <video src={URL.createObjectURL(video)} className="w-full h-full object-cover" muted />
                                <button onClick={() => removeVersusVideo('faceCam', index)} className="absolute top-0.5 right-0.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 opacity-80 hover:opacity-100 transition-opacity" title="Remove video">
                                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </section>

                       {/* Step 8 - Skills */}
                       <section className="space-y-3 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">8</div>
                            <h2 className="text-base font-bold dark:text-white">Skills</h2>
                          </div>
                          <div className="relative flex items-center gap-3">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{versusEnabled.skills ? 'Enabled' : 'Disabled'}</span>
                            <input type="file" accept="video/*" multiple onChange={handleVersusVideoUpload('skills')} className="hidden" id="skills-videos" />
                            <label htmlFor="skills-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Upload
                            </label>
                          </div>
                        </div>
                        <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-sm dark:text-white">Upload Skills</h3>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{versusParts.skills.length} videos</div>
                          <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                            {versusParts.skills.map((video, index) => (
                              <div key={index} className="relative aspect-[9/16] rounded overflow-hidden border border-gray-200 dark:border-gray-600">
                                <video src={URL.createObjectURL(video)} className="w-full h-full object-cover" muted />
                                <button onClick={() => removeVersusVideo('skills', index)} className="absolute top-0.5 right-0.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 opacity-80 hover:opacity-100 transition-opacity" title="Remove video">
                                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                       </section>

                       {/* Step 9 - Goals */}
                       <section className="space-y-3 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">9</div>
                            <h2 className="text-base font-bold dark:text-white">Goals</h2>
                          </div>
                          <div className="relative flex items-center gap-3">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{versusEnabled.goals ? 'Enabled' : 'Disabled'}</span>
                            <input type="file" accept="video/*" multiple onChange={handleVersusVideoUpload('goals')} className="hidden" id="goals-videos" />
                            <label htmlFor="goals-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Upload
                            </label>
                          </div>
                        </div>
                        <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-sm dark:text-white">Upload Goals</h3>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{versusParts.goals.length} videos</div>
                          <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                            {versusParts.goals.map((video, index) => (
                              <div key={index} className="relative aspect-[9/16] rounded overflow-hidden border border-gray-200 dark:border-gray-600">
                                <video src={URL.createObjectURL(video)} className="w-full h-full object-cover" muted />
                                <button onClick={() => removeVersusVideo('goals', index)} className="absolute top-0.5 right-0.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 opacity-80 hover:opacity-100 transition-opacity" title="Remove video">
                                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                       </section>

                       {/* Step 10 - Celebrations */}
                       <section className="space-y-3 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] min-h-[280px]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">10</div>
                            <h2 className="text-base font-bold dark:text-white">Celebrations</h2>
                          </div>
                          <div className="relative flex items-center gap-3">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{versusEnabled.celebrations ? 'Enabled' : 'Disabled'}</span>
                            <input type="file" accept="video/*" multiple onChange={handleVersusVideoUpload('celebrations')} className="hidden" id="celebrations-videos" />
                            <label htmlFor="celebrations-videos" className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Upload
                            </label>
                          </div>
                        </div>
                        <div className="bg-[#e6e6e1] dark:bg-[#18181a] p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-sm dark:text-white">Upload Celebrations</h3>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">{versusParts.celebrations.length} videos</div>
                          <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                            {versusParts.celebrations.map((video, index) => (
                              <div key={index} className="relative aspect-[9/16] rounded overflow-hidden border border-gray-200 dark:border-gray-600">
                                <video src={URL.createObjectURL(video)} className="w-full h-full object-cover" muted />
                                <button onClick={() => removeVersusVideo('celebrations', index)} className="absolute top-0.5 right-0.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 opacity-80 hover:opacity-100 transition-opacity" title="Remove video">
                                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                       </section>

                       {/* Summary */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-center [@media(min-width:1000px)]:col-span-2">
                        <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                          Total: {getVersusCombinationCount(versusParts, versusEnabled) > 0 ? getTotalVersusVideos(versusParts) : 0} videos across enabled parts
                        </div>
                       <div className="text-xs text-blue-700 dark:text-blue-300">
                          {(() => {
                            const product = getVersusCombinationCount(versusParts, versusEnabled);
                            return product > 0
                              ? `${product.toLocaleString()} combinations possible`
                              : 'Upload at least 1 video per used part to see combinations';
                          })()}
                        </div>
                      </div>
                      </div>
                    </div>
                  ) : selectedModel === 'twain-ya-gamila' || selectedModel === 'add-hook' || selectedModel === 'tiktok-creative' ? (
                    // Layout AutoCut et TikTok Creative
                    <div className="col-span-1">
                      <div className="grid grid-cols-1 gap-4">
                        {/* Step 1 - Template Selection (only for AutoCut, not Add Hook) */}
                        {selectedModel !== 'add-hook' && (
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] w-full">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">1</div>
                              <h2 className="text-base font-bold dark:text-white">Choose Template</h2>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {/* Horizontal scrolling template grid */}
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                              {/* TikTok Creative Template */}
                              <div className="flex-shrink-0 flex flex-col items-center gap-2">
                                <button
                                  onClick={() => setAutoCutTemplate('tiktok-creative')}
                                  className={`w-20 h-20 rounded-lg transition-all overflow-hidden ${
                                    autoCutTemplate === 'tiktok-creative'
                                      ? 'border-4 border-[#3e90fd] bg-[#3e90fd]/10'
                                      : 'border-2 border-gray-300 dark:border-gray-600 hover:border-[#3e90fd]/50'
                                  }`}
                                >
                                  <img
                                    src="/autocut-templates/tiktok-creative.jpg"
                                    alt="TikTok Creative Template"
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                                <span className={`text-xs font-medium text-center leading-tight w-20 break-words ${
                                  autoCutTemplate === 'tiktok-creative'
                                    ? 'text-black'
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}>
                                  TikTok Creative
                                </span>
                              </div>

                              {/* One shoot Template */}
                              <div className="flex-shrink-0 flex flex-col items-center gap-2">
                                <button
                                  onClick={() => setAutoCutTemplate('one-shoot')}
                                  className={`w-20 h-20 rounded-lg transition-all overflow-hidden ${
                                    autoCutTemplate === 'one-shoot'
                                      ? 'border-4 border-[#3e90fd] bg-[#3e90fd]/10'
                                      : 'border-2 border-gray-300 dark:border-gray-600 hover:border-[#3e90fd]/50'
                                  }`}
                                >
                                  <img
                                    src="/autocut-templates/one-shoot.jpg"
                                    alt="One shoot Template"
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                                <span className={`text-xs font-medium text-center leading-tight w-20 break-words ${
                                  autoCutTemplate === 'one-shoot'
                                    ? 'text-black'
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}>
                                  One shoot
                                </span>
                              </div>

                              {/* For a living Template */}
                              <div className="flex-shrink-0 flex flex-col items-center gap-2">
                                <button
                                  onClick={() => setAutoCutTemplate('for-a-living')}
                                  className={`w-20 h-20 rounded-lg transition-all overflow-hidden ${
                                    autoCutTemplate === 'for-a-living'
                                      ? 'border-4 border-[#3e90fd] bg-[#3e90fd]/10'
                                      : 'border-2 border-gray-300 dark:border-gray-600 hover:border-[#3e90fd]/50'
                                  }`}
                                >
                                  <img
                                    src="/Malcom Twain - For a living.jpg"
                                    alt="For a living Template"
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                                <span className={`text-xs font-medium text-center leading-tight w-20 break-words ${
                                  autoCutTemplate === 'for-a-living'
                                    ? 'text-black'
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}>
                                  For a living
                                </span>
                              </div>

                              {/* Auto Lyrics Template */}
                              <div className="flex-shrink-0 flex flex-col items-center gap-2">
                                <button
                                  onClick={() => setAutoCutTemplate('auto-lyrics')}
                                  className={`w-20 h-20 rounded-lg transition-all overflow-hidden ${
                                    autoCutTemplate === 'auto-lyrics'
                                      ? 'border-4 border-[#3e90fd] bg-[#3e90fd]/10'
                                      : 'border-2 border-gray-300 dark:border-gray-600 hover:border-[#3e90fd]/50'
                                  }`}
                                >
                                  <img
                                    src="/autocut-templates/2000.jpg"
                                    alt="Auto Lyrics - For the living"
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                                <span className={`text-xs font-medium text-center leading-tight w-20 break-words ${
                                  autoCutTemplate === 'auto-lyrics'
                                    ? 'text-black'
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}>
                                  Auto Lyrics
                                </span>
                              </div>
                            </div>
                          </div>
                        </section>
                        )}

                        {/* Choose Montage Type - Only for Auto Lyrics */}
                        {selectedModel === 'twain-ya-gamila' && autoCutTemplate === 'auto-lyrics' && (
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">1.5</div>
                              <h2 className="text-base font-bold dark:text-white">Choose Montage Type</h2>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {/* Horizontal scrolling montage grid */}
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                              {/* For a living Montage */}
                              <div className="flex-shrink-0 flex flex-col items-center gap-2">
                                <button
                                  onClick={() => setMontageType('for-a-living')}
                                  className={`w-20 h-20 rounded-lg transition-all overflow-hidden ${
                                    montageType === 'for-a-living'
                                      ? 'border-4 border-[#3e90fd] bg-[#3e90fd]/10'
                                      : 'border-2 border-gray-300 dark:border-gray-600 hover:border-[#3e90fd]/50'
                                  }`}
                                >
                                  <img
                                    src="/Malcom Twain - For a living.jpg"
                                    alt="For a living Montage"
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                                <span className={`text-xs font-medium text-center leading-tight w-20 break-words ${
                                  montageType === 'for-a-living'
                                    ? 'text-black'
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}>
                                  For a living
                                </span>
                              </div>

                              {/* Baby don't lie Montage */}
                              <div className="flex-shrink-0 flex flex-col items-center gap-2">
                                <button
                                  onClick={() => setMontageType('baby-dont-lie')}
                                  className={`w-20 h-20 rounded-lg transition-all overflow-hidden ${
                                    montageType === 'baby-dont-lie'
                                      ? 'border-4 border-[#3e90fd] bg-[#3e90fd]/10'
                                      : 'border-2 border-gray-300 dark:border-gray-600 hover:border-[#3e90fd]/50'
                                  }`}
                                >
                                  <img
                                    src="/Sony Twain - Baby don't lie.jpeg"
                                    alt="Baby don't lie Montage"
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                                <span className={`text-xs font-medium text-center leading-tight w-20 break-words ${
                                  montageType === 'baby-dont-lie'
                                    ? 'text-black'
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}>
                                  Baby don't lie
                                </span>
                              </div>

                              {/* Solo video Montage */}
                              <div className="flex-shrink-0 flex flex-col items-center gap-2">
                                <button
                                  onClick={() => setMontageType('solo-video')}
                                  className={`w-20 h-20 rounded-lg transition-all overflow-hidden ${
                                    montageType === 'solo-video'
                                      ? 'border-4 border-[#3e90fd] bg-[#3e90fd]/10'
                                      : 'border-2 border-gray-300 dark:border-gray-600 hover:border-[#3e90fd]/50'
                                  }`}
                                >
                                  <img
                                    src="/autocut-templates/one-shoot.jpg"
                                    alt="Solo video Montage"
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                                <span className={`text-xs font-medium text-center leading-tight w-20 break-words ${
                                  montageType === 'solo-video'
                                    ? 'text-black'
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}>
                                  Solo video
                                </span>
                              </div>
                            </div>
                          </div>
                        </section>
                        )}

                        {/* Collection Selection */}
                        <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">{selectedModel === 'add-hook' ? '1' : '2'}</div>
                              <div>
                                <h2 className="text-base font-bold dark:text-white">
                                  Select Collections
                                </h2>
                                {selectedModel === 'add-hook' && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Choose images/videos → Generate hook template → Apply to videos
                                  </p>
                                )}
                                {autoCutTemplate === 'auto-lyrics' && (
                                  <div className="mt-2">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                      {useOneCollection ? 'Use 1 collection for the entire video' : 'Use 2 collections: Before Refrain (0-12.80s) & After Refrain (12.80s+)'}
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => setUseOneCollection(false)}
                                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                          !useOneCollection
                                            ? 'bg-[#3e90fd] text-white'
                                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                        }`}
                                      >
                                        2 Collections
                                      </button>
                                      <button
                                        onClick={() => setUseOneCollection(true)}
                                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                          useOneCollection
                                            ? 'bg-[#3e90fd] text-white'
                                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                        }`}
                                      >
                                        1 Collection
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            {autoCutTemplate !== 'auto-lyrics' ? (
                              <button
                                onClick={() => setShowTwainCollectionModal(true)}
                                className="px-4 py-2 text-sm font-medium rounded-lg bg-[#3e90fd] text-white hover:bg-[#3e90fd]/90 transition-colors"
                              >
                                {twainYaGamilaState.collection ? 'Change Collection' : 'Select Collection'}
                              </button>
                            ) : useOneCollection ? (
                              <button
                                onClick={() => setShowCollectionModalBeforeRefrain(true)}
                                className="px-4 py-2 text-sm font-medium rounded-lg bg-[#3e90fd] text-white hover:bg-[#3e90fd]/90 transition-colors"
                              >
                                {collectionBeforeRefrain ? 'Change Collection' : 'Select Collection'}
                              </button>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setShowCollectionModalBeforeRefrain(true)}
                                  className="px-4 py-2 text-sm font-medium rounded-lg bg-[#3e90fd] text-white hover:bg-[#3e90fd]/90 transition-colors"
                                >
                                  {collectionBeforeRefrain ? 'Change Before' : 'Before Refrain'}
                                </button>
                                <button
                                  onClick={() => setShowCollectionModalAfterRefrain(true)}
                                  className="px-4 py-2 text-sm font-medium rounded-lg bg-[#3e90fd] text-white hover:bg-[#3e90fd]/90 transition-colors"
                                >
                                  {collectionAfterRefrain ? 'Change After' : 'After Refrain'}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Afficher la collection normale (non Auto Lyrics) */}
                          {autoCutTemplate !== 'auto-lyrics' && twainYaGamilaState.collection && (
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                              <div className="flex items-start gap-3">
                                <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                  {/* Affichage pour collections d'images */}
                                  {twainYaGamilaState.collection.images && twainYaGamilaState.collection.images.length > 0 && (
                                    <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-0.5">
                                      {twainYaGamilaState.collection.images.slice(0, 4).map((img: any, idx: number) => (
                                        <img 
                                          key={idx}
                                          src={img.url} 
                                          alt=""
                                          className="w-full h-full object-cover"
                                        />
                                      ))}
                                    </div>
                                  )}
                                  {/* Affichage pour collections de vidéos */}
                                  {twainYaGamilaState.collection.videos && twainYaGamilaState.collection.videos.length > 0 && (
                                    <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-0.5">
                                      {twainYaGamilaState.collection.videos.slice(0, 4).map((video: any, idx: number) => (
                                        <div key={idx} className="relative w-full h-full">
                                          <video 
                                            src={video.url} 
                                            className="w-full h-full object-cover"
                                            muted
                                            preload="metadata"
                                          />
                                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                            </svg>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {/* Fallback si pas d'images ni de vidéos */}
                                  {(!twainYaGamilaState.collection.images || twainYaGamilaState.collection.images.length === 0) && 
                                   (!twainYaGamilaState.collection.videos || twainYaGamilaState.collection.videos.length === 0) && (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <h3 className="font-semibold text-sm dark:text-white">{twainYaGamilaState.collection.name}</h3>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {twainYaGamilaState.collection.images?.length || 0} images{twainYaGamilaState.collection.videos?.length ? ` • ${twainYaGamilaState.collection.videos.length} videos` : ''}
                                    {selectedModel === 'twain-ya-gamila' && ' • Random selection for videos'}
                                  </p>
                                  <div className="flex gap-1 mt-2">
                                    {/* Afficher les 5 premières images */}
                                    {twainYaGamilaState.collection.images?.slice(0, 5).map((img: any, idx: number) => (
                                      <div key={`img-${idx}`} className="w-10 h-10 rounded overflow-hidden">
                                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                                      </div>
                                    ))}
                                    {/* Afficher les 5 premières vidéos si pas d'images ou s'il reste de la place */}
                                    {twainYaGamilaState.collection.videos?.slice(0, Math.max(0, 5 - (twainYaGamilaState.collection.images?.length || 0))).map((video: any, idx: number) => (
                                      <div key={`video-${idx}`} className="relative w-10 h-10 rounded overflow-hidden">
                                        <video src={video.url} className="w-full h-full object-cover" muted preload="metadata" />
                                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                          </svg>
                                        </div>
                                      </div>
                                    ))}
                                    {twainYaGamilaState.collection.images?.length > 5 && (
                                      <div className="w-10 h-10 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-500">
                                        +{twainYaGamilaState.collection.images.length - 5}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Afficher les 2 collections pour Auto Lyrics */}
                          {autoCutTemplate === 'auto-lyrics' && (
                            <div className="space-y-3">
                              {/* Collection Before Refrain */}
                              {collectionBeforeRefrain && (
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border-l-4 border-blue-500">
                                  <div className="flex items-start gap-3">
                                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                      {collectionBeforeRefrain.videos && collectionBeforeRefrain.videos.length > 0 && (
                                        <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-0.5">
                                          {collectionBeforeRefrain.videos.slice(0, 4).map((video: any, idx: number) => (
                                            <div key={idx} className="relative w-full h-full">
                                              <video
                                                src={video.url}
                                                className="w-full h-full object-cover"
                                                muted
                                                preload="metadata"
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">BEFORE REFRAIN</span>
                                        <span className="text-xs text-gray-500">(0-12.80s)</span>
                                      </div>
                                      <h3 className="font-semibold text-sm dark:text-white mt-1">{collectionBeforeRefrain.name}</h3>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {collectionBeforeRefrain.videos?.length || 0} videos
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Collection After Refrain */}
                              {collectionAfterRefrain && (
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border-l-4 border-purple-500">
                                  <div className="flex items-start gap-3">
                                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                      {collectionAfterRefrain.videos && collectionAfterRefrain.videos.length > 0 && (
                                        <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-0.5">
                                          {collectionAfterRefrain.videos.slice(0, 4).map((video: any, idx: number) => (
                                            <div key={idx} className="relative w-full h-full">
                                              <video
                                                src={video.url}
                                                className="w-full h-full object-cover"
                                                muted
                                                preload="metadata"
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">AFTER REFRAIN</span>
                                        <span className="text-xs text-gray-500">(12.80s+)</span>
                                      </div>
                                      <h3 className="font-semibold text-sm dark:text-white mt-1">{collectionAfterRefrain.name}</h3>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {collectionAfterRefrain.videos?.length || 0} videos
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </section>

                        {/* Hook and Music Sections - For AutoCut at Steps 3 & 4 - Side by Side (Auto Lyrics only shows Music) */}
                        {selectedModel === 'twain-ya-gamila' && (
                          <div className={`grid grid-cols-1 gap-4 ${autoCutTemplate !== 'auto-lyrics' ? '[@media(min-width:1000px)]:grid-cols-2' : ''}`}>
                            {/* Hook Section - Step 3 (hidden for Auto Lyrics) */}
                            {autoCutTemplate !== 'auto-lyrics' && (
                            <section className="space-y-2 bg-[#f3f4f0] dark:bg-[#0e0f15] p-3 rounded-lg border border-[#d2d2d0]">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">3</div>
                                  <h2 className="text-base font-bold dark:text-white">Hook</h2>
                                </div>
                                <div className="relative">
                                  <input
                                    type="file"
                                    accept=".txt"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    id="hook-file-autocut"
                                  />
                                  <label
                                    htmlFor="hook-file-autocut"
                                    className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal"
                                  >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    Load
                                  </label>
                                </div>
                              </div>
                              <Textarea
                                value={hooks}
                                onChange={(e) => setHooks(e.target.value)}
                                placeholder="Enter your hook here or load from a text file.."
                                className="min-h-[120px] dark:bg-[#18181a] dark:text-white dark:border-[#0e0f15] dark:placeholder:text-gray-400"
                                maxLength={500}
                              />

                              {/* Font Selection - All fonts for AutoCut */}
                              <div className="mt-3">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Font Style: {selectedFonts.length > 1 && <span className="text-[#3e90fd]">({selectedFonts.length} selected)</span>}
                                </label>
                                <div className="flex flex-wrap gap-2">
                                  {(autoCutTemplate === 'auto-lyrics' ? fontsAutoLyrics : availableFonts).map((font) => (
                                    <button
                                      key={font.id}
                                      onClick={() => toggleFont(font.id)}
                                      className={`px-2 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                                        font.id === 'all' 
                                          ? isAllFontsSelected()
                                            ? 'bg-[#3e90fd] text-white border-[#3e90fd]'
                                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-[#3e90fd]/50'
                                          : selectedFonts.includes(font.id)
                                            ? 'bg-[#3e90fd] text-white border-[#3e90fd]'
                                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-[#3e90fd]/50'
                                      }`}
                                    >
                                      {font.name}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Border and Normal styles only for AutoCut */}
                              <div className="grid grid-cols-2 gap-2 mt-3">
                                <div
                                  onClick={() => {
                                    setSelectedStyles(new Set([1]));
                                    setCurrentStyle(1);
                                  }}
                                  className={`flex items-center justify-center p-3 rounded-lg cursor-pointer transition-all ${
                                    selectedStyles.has(1)
                                      ? "bg-[#3e90fd] text-white dark:bg-[#3e90fd]"
                                      : "bg-[#e6e6e1] hover:bg-[#e6e6e1] dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white"
                                  }`}
                                >
                                  <div 
                                    className={`text-xs font-semibold ${
                                      selectedStyles.has(1) 
                                        ? "text-white dark:text-white" 
                                        : "text-gray-700 dark:text-white"
                                    }`}
                                  >
                                    Border
                                  </div>
                                </div>
                                
                                <div
                                  onClick={() => {
                                    setSelectedStyles(new Set([4]));
                                    setCurrentStyle(4);
                                  }}
                                  className={`flex items-center justify-center p-3 rounded-lg cursor-pointer transition-all ${
                                    selectedStyles.has(4)
                                      ? "bg-[#3e90fd] text-white dark:bg-[#3e90fd]"
                                      : "bg-[#e6e6e1] hover:bg-[#e6e6e1] dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white"
                                  }`}
                                >
                                  <div 
                                    className={`text-xs font-semibold ${
                                      selectedStyles.has(4) 
                                        ? "text-white dark:text-white" 
                                        : "text-gray-700 dark:text-white"
                                    }`}
                                  >
                                    Normal
                                  </div>
                                </div>
                              </div>
                            </section>
                            )}

                            {/* Music Section - Step 4 (Step 3 for Auto Lyrics since Hook is hidden) */}
                            <section className="space-y-2 bg-[#f3f4f0] dark:bg-[#0e0f15] p-3 rounded-lg border border-[#d2d2d0]">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">{autoCutTemplate === 'auto-lyrics' ? '3' : '4'}</div>
                                  <h2 className="text-base font-bold dark:text-white">Music</h2>
                                </div>
                              </div>
                              {isLoadingSongs ? (
                                <div className="h-[200px] flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5465ff]"></div>
                                </div>
                              ) : songs.length === 0 ? (
                                <div className="h-[200px] flex items-center justify-start pl-4 text-gray-500 dark:text-gray-400">
                                  <div>
                                    <p>No music available</p>
                                    <p className="text-sm mt-2">Add music in the Music page first</p>
                                  </div>
                                </div>
                              ) : (
                                <ScrollArea className="flex-1 h-[210px]">
                                  <div className="py-2 space-y-2">
                                    {/* Without Music Option */}
                                    <div
                                      onClick={() => setSelectedSong(selectedSong?.id === 'no-music' ? null : { 
                                        id: 'no-music', 
                                        user_id: '', 
                                        title: 'Without music', 
                                        artist: '', 
                                        duration: 0, 
                                        url: '', 
                                        cover_url: null, 
                                        created_at: '' 
                                      })}
                                      className={`flex items-center gap-3 p-2 pl-3 rounded-lg cursor-pointer transition-all ${
                                        selectedSong?.id === 'no-music'
                                          ? "bg-[#3e90fd] text-white dark:bg-[#3e90fd] dark:text-white"
                                          : "bg-[#e6e6e1] hover:bg-[#e6e6e1] dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white"
                                      }`}
                                    >
                                      <div className="relative w-10 h-10 [@media(min-width:1000px)]:w-12 [@media(min-width:1000px)]:h-12 flex-shrink-0">
                                        <div className="w-full h-full bg-gray-200 dark:bg-[#18181a] rounded-md flex items-center justify-center border-2 border-dashed border-gray-400">
                                          <span className="text-xs font-bold text-gray-600 dark:text-gray-400">NO</span>
                                        </div>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium truncate ${selectedSong?.id === 'no-music' ? "text-white dark:text-white" : "text-gray-700 dark:text-white"}`}>
                                          Without music
                                        </p>
                                        <p className={`text-xs truncate ${selectedSong?.id === 'no-music' ? "text-white/80 dark:text-white/80" : "text-gray-500 dark:text-gray-300"}`}>
                                          Create without background music
                                        </p>
                                      </div>
                                    </div>
                                    {songs.map((song) => (
                                      <div
                                        key={song.id}
                                        onClick={() => setSelectedSong(selectedSong?.id === song.id ? null : song)}
                                        className={`flex items-center gap-3 p-2 pl-3 rounded-lg cursor-pointer transition-all ${
                                          selectedSong?.id === song.id
                                            ? "bg-[#3e90fd] text-white dark:bg-[#3e90fd] dark:text-white"
                                            : "bg-[#e6e6e1] hover:bg-[#e6e6e1] dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white"
                                        }`}
                                      >
                                        <div className="relative w-10 h-10 [@media(min-width:1000px)]:w-12 [@media(min-width:1000px)]:h-12 flex-shrink-0">
                                          {song.cover_url ? (
                                            <Image
                                              src={song.cover_url}
                                              alt={song.title}
                                              layout="fill"
                                              className="object-cover rounded-md"
                                              sizes="(max-width: 1000px) 40px, 48px"
                                            />
                                          ) : (
                                            <div className="w-full h-full bg-gray-200 dark:bg-[#18181a] rounded-md flex items-center justify-center">
                                              <MusicIcon className="h-5 w-5 [@media(min-width:1000px)]:h-6 [@media(min-width:1000px)]:w-6 text-gray-500" />
                                            </div>
                                          )}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handlePlayPause(song);
                                            }}
                                            className={`absolute inset-0 flex items-center justify-center bg-black/30 rounded-md ${
                                              currentlyPlaying === song.id ? "opacity-100" : "opacity-0 hover:opacity-100"
                                            }`}
                                          >
                                            {currentlyPlaying === song.id ? (
                                              <PauseIcon className="h-5 w-5 [@media(min-width:1000px)]:h-6 [@media(min-width:1000px)]:w-6 text-white" />
                                            ) : (
                                              <PlayIcon className="h-5 w-5 [@media(min-width:1000px)]:h-6 [@media(min-width:1000px)]:w-6 text-white" />
                                            )}
                                          </button>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className={`text-sm font-medium truncate ${selectedSong?.id === song.id ? "text-white dark:text-white" : "text-gray-700 dark:text-white"}`}>
                                            {song.title}
                                          </p>
                                          <p className={`text-xs truncate ${selectedSong?.id === song.id ? "text-white/80 dark:text-white/80" : "text-gray-500 dark:text-gray-300"}`}>
                                            {song.artist} • {formatDuration(song.duration)}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </ScrollArea>
                              )}
                            </section>
                          </div>
                        )}

                        {/* Font & Style Settings - Step 4 for Auto Lyrics only */}
                        {autoCutTemplate === 'auto-lyrics' && (
                          <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0]">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">4</div>
                                <h2 className="text-base font-bold dark:text-white">Font & Style Settings</h2>
                              </div>
                            </div>

                            <div className="space-y-4">
                              {/* Font Selection */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Font Style
                                </label>
                                <div className="flex flex-wrap gap-2">
                                  {fontsAutoLyrics.map((font) => (
                                    <button
                                      key={font.id}
                                      onClick={() => setSelectedFonts([font.id])}
                                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                        selectedFonts.includes(font.id)
                                          ? 'bg-[#3e90fd] text-white border-[#3e90fd]'
                                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-[#3e90fd]/50'
                                      }`}
                                    >
                                      {font.name}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Font Style (Border/Normal) - for all fonts */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Font Style
                                </label>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      setCurrentStyle(1);
                                      setSelectedStyles(new Set([1]));
                                    }}
                                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                      currentStyle === 1
                                        ? 'bg-[#3e90fd] text-white border-[#3e90fd]'
                                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-[#3e90fd]/50'
                                    }`}
                                  >
                                    Border
                                  </button>
                                  <button
                                    onClick={() => {
                                      setCurrentStyle(4);
                                      setSelectedStyles(new Set([4]));
                                    }}
                                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                      currentStyle === 4
                                        ? 'bg-[#3e90fd] text-white border-[#3e90fd]'
                                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-[#3e90fd]/50'
                                    }`}
                                  >
                                    Normal
                                  </button>
                                </div>
                              </div>

                              {/* Lyrics Display Style */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Lyrics Display Mode
                                </label>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => setLyricsStyle('words')}
                                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                      lyricsStyle === 'words'
                                        ? 'bg-[#3e90fd] text-white border-[#3e90fd]'
                                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-[#3e90fd]/50'
                                    }`}
                                  >
                                    Word by Word
                                  </button>
                                  <button
                                    onClick={() => setLyricsStyle('multi-line')}
                                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                      lyricsStyle === 'multi-line'
                                        ? 'bg-[#3e90fd] text-white border-[#3e90fd]'
                                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-[#3e90fd]/50'
                                    }`}
                                  >
                                    Sentence at Once
                                  </button>
                                  <button
                                    onClick={() => setLyricsStyle('stacked')}
                                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                      lyricsStyle === 'stacked'
                                        ? 'bg-[#3e90fd] text-white border-[#3e90fd]'
                                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-[#3e90fd]/50'
                                    }`}
                                  >
                                    Stacked Lines
                                  </button>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                  {lyricsStyle === 'words' && 'Each word appears one by one'}
                                  {lyricsStyle === 'multi-line' && 'Entire sentence appears at once'}
                                  {lyricsStyle === 'stacked' && 'Multiple lines stacked vertically'}
                                </p>
                              </div>

                              {/* Text Colors */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Text Colors
                                </label>
                                <div className="space-y-3">
                                  {/* Color Picker */}
                                  <div className="flex gap-2 items-center">
                                    <input
                                      type="color"
                                      value={currentColorPicker}
                                      onChange={(e) => setCurrentColorPicker(e.target.value)}
                                      className="w-12 h-12 rounded-lg border-2 border-gray-300 dark:border-gray-600 cursor-pointer"
                                    />
                                    <button
                                      onClick={() => {
                                        if (!textColors.find(c => c.color === currentColorPicker)) {
                                          setTextColors([...textColors, { color: currentColorPicker, enabled: true }]);
                                        }
                                      }}
                                      className="px-4 py-2 bg-[#3e90fd] text-white rounded-lg hover:bg-[#3e90fd]/90 transition-colors text-sm font-medium"
                                    >
                                      Add Color
                                    </button>
                                  </div>

                                  {/* Saved Colors */}
                                  <div className="flex flex-wrap gap-2">
                                    {textColors.map((colorObj, index) => (
                                      <div
                                        key={index}
                                        className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={colorObj.enabled}
                                          onChange={(e) => {
                                            const newColors = [...textColors];
                                            newColors[index].enabled = e.target.checked;
                                            setTextColors(newColors);
                                          }}
                                          className="w-4 h-4 rounded border-gray-300 text-[#3e90fd] focus:ring-[#3e90fd]"
                                        />
                                        <div
                                          className="w-8 h-8 rounded border-2 border-gray-300 dark:border-gray-600"
                                          style={{ backgroundColor: colorObj.color }}
                                        />
                                        <span className="text-xs font-mono text-gray-700 dark:text-gray-300">
                                          {colorObj.color.toUpperCase()}
                                        </span>
                                        <button
                                          onClick={() => {
                                            setTextColors(textColors.filter((_, i) => i !== index));
                                          }}
                                          className="ml-1 text-red-500 hover:text-red-700 text-sm"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {textColors.filter(c => c.enabled).length} color(s) selected for video generation
                                  </p>
                                </div>
                              </div>
                            </div>
                          </section>
                        )}

                        {/* Hook Section - Only for Add Hook at Step 2 */}
                        {selectedModel === 'add-hook' && (
                          <section className="space-y-2 bg-[#f3f4f0] dark:bg-[#0e0f15] p-3 rounded-lg border border-[#d2d2d0]">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">2</div>
                                <div>
                                  <h2 className="text-base font-bold dark:text-white">Hook</h2>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Generate template from first image, then apply to videos
                                  </p>
                                </div>
                              </div>
                              <div className="relative">
                                <input
                                  type="file"
                                  accept=".txt"
                                  onChange={handleFileUpload}
                                  className="hidden"
                                  id="hook-file-add-hook"
                                />
                                <label
                                  htmlFor="hook-file-add-hook"
                                  className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal"
                                >
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                  Load
                                </label>
                              </div>
                            </div>
                            <Textarea
                              value={hooks}
                              onChange={(e) => setHooks(e.target.value)}
                              placeholder="Enter your hook here or load from a text file.."
                              className="min-h-[150px] dark:bg-[#18181a] dark:text-white dark:border-[#0e0f15] dark:placeholder:text-gray-400"
                              maxLength={500}
                            />
                            
                            {/* Font Selection - Fixed to TikTok for Add Hook */}
                            <div className="mt-4">
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                Font Style: TikTok (Default)
                              </label>
                            </div>

                            {/* Styles - Only White and Black for Add Hook */}
                            <div className="flex gap-2 mt-4">
                              <div
                                onClick={() => {
                                  setSelectedStyles(new Set([2]));
                                  setCurrentStyle(2);
                                }}
                                className={`flex-1 flex items-center justify-center p-4 rounded-lg cursor-pointer transition-all ${
                                  selectedStyles.has(2)
                                    ? "bg-[#3e90fd] text-white dark:bg-[#3e90fd]"
                                    : "bg-[#e6e6e1] hover:bg-[#e6e6e1] dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white"
                                }`}
                              >
                                <div 
                                  className={`text-sm font-semibold ${
                                    selectedStyles.has(2) 
                                      ? "text-white dark:text-white" 
                                      : "text-gray-700 dark:text-white"
                                  }`}
                                >
                                  White
                                </div>
                              </div>
                              
                              <div
                                onClick={() => {
                                  setSelectedStyles(new Set([3]));
                                  setCurrentStyle(3);
                                }}
                                className={`flex-1 flex items-center justify-center p-4 rounded-lg cursor-pointer transition-all ${
                                  selectedStyles.has(3)
                                    ? "bg-[#3e90fd] text-white dark:bg-[#3e90fd]"
                                    : "bg-[#e6e6e1] hover:bg-[#e6e6e1] dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white"
                                }`}
                              >
                                <div 
                                  className={`text-sm font-semibold ${
                                    selectedStyles.has(3) 
                                      ? "text-white dark:text-white" 
                                      : "text-gray-700 dark:text-white"
                                  }`}
                                >
                                  Black
                                </div>
                              </div>
                            </div>
                          </section>
                        )}

                        {/* Video Generation Settings and Number of Videos - Steps 4 & 5 - Side by Side (inverted order) */}
                        <div className="grid grid-cols-1 [@media(min-width:1000px)]:grid-cols-2 gap-4">
                          {/* Video Generation Settings - Step 4 (was Step 5) */}
                          {contentType === 'video' && selectedModel !== 'add-hook' && (autoCutTemplate !== 'one-shoot' || selectedModel !== 'twain-ya-gamila') && (
                            <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0]">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">4</div>
                                  <h2 className="text-base font-bold dark:text-white">Video Generation Settings</h2>
                                </div>
                              </div>

                              {/* Contrôle de la durée finale intelligente */}
                              <div className="space-y-3">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Final video duration (seconds):
                                </label>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <input
                                    type="number"
                                    min="5"
                                    max="60"
                                    step="1"
                                    value={Math.round(imageTimingMin / 1000)}
                                    onChange={(e) => {
                                      const seconds = Math.max(5, Math.min(60, parseInt(e.target.value) || 8));
                                      setImageTimingMin(seconds * 1000);
                                      if (seconds > Math.round(imageTimingMax / 1000)) {
                                        setImageTimingMax(seconds * 1000);
                                      }
                                    }}
                                    className="w-16 px-2 py-1 text-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md"
                                  />
                                  <span className="text-xs text-gray-500 dark:text-gray-400">-</span>
                                  <input
                                    type="number"
                                    min="5"
                                    max="60"
                                    step="1"
                                    value={Math.round(imageTimingMax / 1000)}
                                    onChange={(e) => {
                                      const seconds = Math.max(5, Math.min(60, parseInt(e.target.value) || 12));
                                      setImageTimingMax(seconds * 1000);
                                      if (seconds < Math.round(imageTimingMin / 1000)) {
                                        setImageTimingMin(seconds * 1000);
                                      }
                                    }}
                                    className="w-16 px-2 py-1 text-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md"
                                  />
                                  <span className="text-xs text-gray-500 dark:text-gray-400">seconds</span>
                                </div>

                                {/* Presets rapides */}
                                <div className="flex gap-2 flex-wrap">
                                  <button
                                    onClick={() => {setImageTimingMin(8000); setImageTimingMax(12000);}}
                                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                  >
                                    ⚡ Fast (8-12s)
                                  </button>
                                  <button
                                    onClick={() => {setImageTimingMin(12000); setImageTimingMax(18000);}}
                                    className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                                  >
                                    🎯 Medium (12-18s)
                                  </button>
                                  <button
                                    onClick={() => {setImageTimingMin(15000); setImageTimingMax(30000);}}
                                    className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                                  >
                                    🎵 Slow
                                  </button>
                                </div>
                              </div>
                            </section>
                          )}

                          {/* Number of Videos - Step 5 (was Step 4) */}
                          <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0]">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">
                                  {selectedModel === 'add-hook' ? '4' : '5'}
                                </div>
                                <h2 className="text-base font-bold dark:text-white">
                                  {selectedModel === 'add-hook' 
                                    ? `Number of ${twainYaGamilaState.collection?.videos?.length > 0 && (!twainYaGamilaState.collection?.images || twainYaGamilaState.collection.images.length === 0) ? 'Videos' : 'Images'} to Process`
                                    : 'Number of Videos'}
                                </h2>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {selectedModel === 'add-hook' && (
                                <button
                                  onClick={() => {
                                    const hasVideos = twainYaGamilaState.collection?.videos?.length > 0 && (!twainYaGamilaState.collection?.images || twainYaGamilaState.collection.images.length === 0);
                                    const collectionCount = hasVideos 
                                      ? (twainYaGamilaState.collection?.videos?.length || 0)
                                      : (twainYaGamilaState.collection?.images?.length || 0);
                                    setTwainYaGamilaState(prev => ({ ...prev, videosToGenerate: collectionCount }));
                                  }}
                                  className="px-3 py-1.5 text-sm bg-[#3e90fd] hover:bg-[#3e90fd]/90 text-white rounded-lg transition-colors"
                                  title={`Set to all ${twainYaGamilaState.collection?.videos?.length > 0 && (!twainYaGamilaState.collection?.images || twainYaGamilaState.collection.images.length === 0) ? 'videos' : 'images'} in collection`}
                                >
                                  All ({(() => {
                                    const hasVideos = twainYaGamilaState.collection?.videos?.length > 0 && (!twainYaGamilaState.collection?.images || twainYaGamilaState.collection.images.length === 0);
                                    return hasVideos 
                                      ? (twainYaGamilaState.collection?.videos?.length || 0)
                                      : (twainYaGamilaState.collection?.images?.length || 0);
                                  })()})
                                </button>
                              )}
                              <button
                                onClick={() => setTwainYaGamilaState(prev => ({ ...prev, videosToGenerate: Math.max(1, prev.videosToGenerate - 1) }))}
                                className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                max={selectedModel === 'add-hook' ? (twainYaGamilaState.collection?.images?.length || 100000) : 100000}
                                value={twainYaGamilaState.videosToGenerate}
                                onChange={(e) => {
                                  const maxValue = selectedModel === 'add-hook' ? (twainYaGamilaState.collection?.images?.length || 100000) : 100000;
                                  const value = Math.min(maxValue, Math.max(1, parseInt(e.target.value) || 1));
                                  setTwainYaGamilaState(prev => ({ ...prev, videosToGenerate: value }));
                                }}
                                className="w-20 px-2 py-1 text-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md"
                              />
                              <button
                                onClick={() => {
                                  const maxValue = selectedModel === 'add-hook' ? (twainYaGamilaState.collection?.images?.length || 100000) : 100000;
                                  setTwainYaGamilaState(prev => ({ ...prev, videosToGenerate: Math.min(maxValue, prev.videosToGenerate + 1) }));
                                }}
                                className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center"
                              >
                                +
                              </button>
                              <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                                {selectedModel === 'add-hook' 
                                  ? (twainYaGamilaState.collection?.videos?.length > 0 && (!twainYaGamilaState.collection?.images || twainYaGamilaState.collection.images.length === 0) ? 'videos' : 'images')
                                  : 'videos'}
                              </span>
                            </div>
                          </section>

                          {/* Video Generation Settings already shown above as Step 4 - removed duplicate */}
                          {false && contentType === 'video' && selectedModel !== 'add-hook' && (autoCutTemplate !== 'one-shoot' || selectedModel !== 'twain-ya-gamila') && (
                            <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0]">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">5</div>
                                  <h2 className="text-base font-bold dark:text-white">Video Generation Settings</h2>
                                </div>
                              </div>
                              
                              {/* Contrôle de la durée finale intelligente */}
                              <div className="space-y-3">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Final video duration (seconds):
                                </label>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <input
                                    type="number"
                                    min="5"
                                    max="60"
                                    step="1"
                                    value={Math.round(imageTimingMin / 1000)}
                                    onChange={(e) => {
                                      const seconds = Math.max(5, Math.min(60, parseInt(e.target.value) || 8));
                                      setImageTimingMin(seconds * 1000);
                                      if (seconds > Math.round(imageTimingMax / 1000)) {
                                        setImageTimingMax(seconds * 1000);
                                      }
                                    }}
                                    className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-[#e6e6e1] dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                  />
                                  <span className="text-sm text-gray-500">to</span>
                                  <input
                                    type="number"
                                    min="5"
                                    max="60"
                                    step="1"
                                    value={Math.round(imageTimingMax / 1000)}
                                    onChange={(e) => {
                                      const seconds = Math.max(Math.round(imageTimingMin / 1000), Math.min(60, parseInt(e.target.value) || 15));
                                      setImageTimingMax(seconds * 1000);
                                    }}
                                    className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-[#e6e6e1] dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                  />
                                  <span className="text-sm text-gray-500">s</span>
                                </div>
                                
                                {/* Presets rapides */}
                                <div className="flex gap-1 flex-wrap">
                                  {autoCutTemplate === 'auto-lyrics' && selectedSong && (
                                    <button
                                      onClick={() => {
                                        const songDuration = Math.round(selectedSong.duration);
                                        setImageTimingMin(songDuration * 1000);
                                        setImageTimingMax(songDuration * 1000);
                                      }}
                                      className="px-2 py-1 text-xs bg-pink-100 text-pink-700 rounded hover:bg-pink-200 transition-colors font-medium"
                                    >
                                      🎵 Song time ({Math.floor(selectedSong.duration / 60)}:{String(Math.round(selectedSong.duration % 60)).padStart(2, '0')})
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {setImageTimingMin(5000); setImageTimingMax(10000);}}
                                    className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                                  >
                                    🔥 Quick
                                  </button>
                                  <button
                                    onClick={() => {setImageTimingMin(7000); setImageTimingMax(12000);}}
                                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                  >
                                    ⚡ Standard
                                  </button>
                                  <button
                                    onClick={() => {setImageTimingMin(15000); setImageTimingMax(30000);}}
                                    className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                                  >
                                    🎵 Slow
                                  </button>
                                </div>
                              </div>
                            </section>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Layout normal - Étapes 3 et 4 séparées
                    <div className="grid grid-cols-1 [@media(min-width:1000px)]:grid-cols-2 gap-4">
                    {/* Templates Section - Moved to position 3 */}
                    <section className="space-y-2 bg-[#f3f4f0] dark:bg-[#0e0f15] p-3 rounded-lg border border-[#d2d2d0]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">3</div>
                          <h2 className="text-base font-bold dark:text-white">Part 1</h2>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">10MB max</span>
                          <div className="relative">
                            <input
                              type="file"
                              accept="image/*,video/*"
                              onChange={handleTemplateUpload}
                              className="hidden"
                              id="template-file"
                              disabled={isUploadingTemplate}
                            />
                            <label
                              htmlFor="template-file"
                              className={`px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal ${
                              isUploadingTemplate ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              {isUploadingTemplate ? 'Uploading...' : 'Upload'}
                            </label>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-4 mb-4">
                        <div className="flex-1">
                          <div className="flex justify-center mt-auto pt-4 mb-2">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="2"
                                max="29"
                                value={templateDurationRange.min}
                                onChange={(e) => {
                                  const newMin = Number(e.target.value);
                                  if (newMin >= 2 && newMin < templateDurationRange.max) {
                                    setTemplateDurationRange(prev => ({
                                      min: newMin,
                                      max: prev.max
                                    }));
                                  }
                                }}
                                className="w-12 h-7 px-1 border border-gray-300 dark:border-[#0e0f15] dark:bg-[#18181a] dark:text-white rounded-md text-center text-sm"
                              />
                              <span className="text-gray-500 dark:text-gray-400 text-xs">-</span>
                              <input
                                type="number"
                                min="3"
                                max="30"
                                value={templateDurationRange.max}
                                onChange={(e) => {
                                  const newMax = Number(e.target.value);
                                  if (newMax <= 30 && newMax > templateDurationRange.min) {
                                    setTemplateDurationRange(prev => ({
                                      min: prev.min,
                                      max: newMax
                                    }));
                                  }
                                }}
                                className="w-12 h-7 px-1 border border-gray-300 dark:border-[#0e0f15] dark:bg-[#18181a] dark:text-white rounded-md text-center text-sm"
                              />
                              <span className="text-xs text-gray-600 dark:text-gray-300 ml-1">Seconds</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-center gap-1">
                          <div className="flex flex-col items-center gap-2">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={(e) => handleTemplateImagePosition('top', e)}
                                className={`flex flex-col items-center px-3 py-2 rounded-lg ${
                                  templateImagePosition === 'top' 
                                    ? 'bg-[#3e90fd] text-white dark:bg-[#3e90fd] dark:text-white' 
                                    : 'bg-black/10 hover:bg-black/20 text-gray-700 dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white'
                                } transition-colors`}
                                title="Afficher le haut de l'image/vidéo"
                              >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M4 5h16M4 9h16M10 13h4m-4 4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </button>
                              <button
                                onClick={(e) => handleTemplateImagePosition('center', e)}
                                className={`flex flex-col items-center px-3 py-2 rounded-lg ${
                                  templateImagePosition === 'center' 
                                    ? 'bg-[#3e90fd] text-white dark:bg-[#3e90fd] dark:text-white' 
                                    : 'bg-black/10 hover:bg-black/20 text-gray-700 dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white'
                                } transition-colors`}
                                title="Centrer l'image/vidéo"
                              >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M4 9h16M4 12h16M4 15h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </button>
                              <button
                                onClick={(e) => handleTemplateImagePosition('bottom', e)}
                                className={`flex flex-col items-center px-3 py-2 rounded-lg ${
                                  templateImagePosition === 'bottom' 
                                    ? 'bg-[#3e90fd] text-white dark:bg-[#3e90fd] dark:text-white' 
                                    : 'bg-black/10 hover:bg-black/20 text-gray-700 dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white'
                                } transition-colors`}
                                title="Afficher le bas de l'image/vidéo"
                              >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M10 7h4m-4 4h4M4 15h16M4 19h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="pb-0.3"></div>
                      </div>
                      {templates.length === 0 && !defaultTemplate ? (
                        <div className="h-[200px] flex items-center justify-center text-center text-gray-500 dark:text-gray-400">
                          <div>
                            <p>No media uploaded</p>
                            <p className="text-sm mt-2">Upload 1 video or 1 image to continue</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-2 max-w-[170px] mx-auto">
                            {defaultTemplate && (
                              <div
                                key={defaultTemplate.id}
                                onClick={() => setSelectedTemplate(defaultTemplate.id)}
                                className={`relative aspect-[9/16] rounded-lg overflow-hidden cursor-pointer border-2 ${
                                  selectedTemplate === defaultTemplate.id
                                    ? "bg-[#3e90fd]/10 border-[#5465ff] ring-2 ring-[#5465ff]"
                                    : "border-gray-200 hover:border-gray-300 dark:border-[#0e0f15] dark:hover:border-[#27272A]"
                                }`}
                              >
                                <div className="relative w-full h-full">
                                  <TemplateImage 
                                    template={{ 
                                      url: defaultTemplate.url,
                                      type: defaultTemplate.type || 'image'
                                    }} 
                                    alt="Default Template" 
                                    position={templateImagePosition}
                                  />
                                </div>
                              </div>
                            )}
                            {lastUploadedTemplate.map((template) => (
                              <div
                                key={template.id}
                                onClick={() => setSelectedTemplate(template.id)}
                                className={`relative aspect-[9/16] rounded-lg overflow-hidden cursor-pointer border-2 group ${
                                  selectedTemplate === template.id
                                    ? "bg-[#3e90fd]/10 border-[#5465ff] ring-2 ring-[#5465ff]"
                                    : "border-gray-200 hover:border-gray-300 dark:border-[#0e0f15] dark:hover:border-[#27272A]"
                                }`}
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTemplate();
                                  }}
                                  className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
                                  title="Delete template"
                                >
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </button>
                                <div className="relative w-full h-full">
                                  <TemplateImage 
                                    template={{ 
                                      url: template.url,
                                      type: template.type
                                    }} 
                                    alt={`Template ${template.id}`} 
                                    position={templateImagePosition}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </section>

                    {/* Videos Upload - 2 collections pour Auto Lyrics */}
                    {autoCutTemplate === 'auto-lyrics' ? (
                      <>
                        {/* Collection 1: Before Refrain (0-12.80s) */}
                        <section className="space-y-2 bg-[#f3f4f0] dark:bg-[#0e0f15] p-3 rounded-lg border border-[#d2d2d0]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">4</div>
                              <h2 className="text-base font-bold dark:text-white">Before Refrain (0-12.80s)</h2>
                            </div>
                            <div className="flex items-center gap-2">
                              <div {...getRootPropsBeforeRefrain()}>
                                <input {...getInputPropsBeforeRefrain()} />
                                <button className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors text-sm font-normal flex items-center gap-2">
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                  Upload
                                </button>
                              </div>
                              {selectedMediasBeforeRefrain.length > 0 && (
                                <span className="text-sm text-gray-500 dark:text-gray-400">{selectedMediasBeforeRefrain.length}/50</span>
                              )}
                            </div>
                          </div>
                          {selectedMediasBeforeRefrain.length === 0 ? (
                            <div className="h-[200px] flex items-center justify-center text-center text-gray-500 dark:text-gray-400">
                              <div>
                                <p>No media uploaded</p>
                                <p className="text-sm mt-2">Upload videos for before refrain (50 max)</p>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4">
                              <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={toggleAllMediasBeforeRefrain}
                                    className="text-xs text-[#5465ff] hover:underline dark:text-[#f8d4eb]"
                                  >
                                    {selectedMediaIndexesBeforeRefrain.size === selectedMediasBeforeRefrain.length
                                      ? "Deselect All"
                                      : "Select All"}
                                  </button>
                                </div>
                              </div>
                              <ScrollArea className="h-[200px] w-full">
                                <div className="grid grid-cols-5 gap-2 p-1 min-w-[200px]">
                                  {selectedMediasBeforeRefrain.map((media, index) => (
                                    <div
                                      key={index}
                                      onClick={() => toggleMediaSelectionBeforeRefrain(index)}
                                      className={`relative w-10 aspect-[9/16] rounded-lg overflow-hidden cursor-pointer border-2 group ${
                                        selectedMediaIndexesBeforeRefrain.has(index)
                                          ? "bg-[#3e90fd]/10 border-[#5465ff] ring-2 ring-[#5465ff] dark:bg-[#3e90fd]/10 dark:border-[#5465ff] dark:ring-[#5465ff]"
                                          : "border-transparent hover:border-gray-500 dark:hover:border-gray-300"
                                      }`}
                                    >
                                      <div className="relative w-full h-full">
                                        {media.url && media.type === 'video' ? (
                                          <video
                                            src={media.url}
                                            className="w-full h-full object-cover"
                                            preload="metadata"
                                            muted
                                            loop
                                          />
                                        ) : media.url ? (
                                          <Image
                                            src={media.url}
                                            alt={`Media ${index + 1}`}
                                            className="w-full h-full object-cover"
                                            layout="fill"
                                          />
                                        ) : null}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            </div>
                          )}
                        </section>

                        {/* Collection 2: After Refrain (12.80s+) */}
                        <section className="space-y-2 bg-[#f3f4f0] dark:bg-[#0e0f15] p-3 rounded-lg border border-[#d2d2d0]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">5</div>
                              <h2 className="text-base font-bold dark:text-white">After Refrain (12.80s+)</h2>
                            </div>
                            <div className="flex items-center gap-2">
                              <div {...getRootPropsAfterRefrain()}>
                                <input {...getInputPropsAfterRefrain()} />
                                <button className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors text-sm font-normal flex items-center gap-2">
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                  Upload
                                </button>
                              </div>
                              {selectedMediasAfterRefrain.length > 0 && (
                                <span className="text-sm text-gray-500 dark:text-gray-400">{selectedMediasAfterRefrain.length}/50</span>
                              )}
                            </div>
                          </div>
                          {selectedMediasAfterRefrain.length === 0 ? (
                            <div className="h-[200px] flex items-center justify-center text-center text-gray-500 dark:text-gray-400">
                              <div>
                                <p>No media uploaded</p>
                                <p className="text-sm mt-2">Upload videos for after refrain (50 max)</p>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4">
                              <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={toggleAllMediasAfterRefrain}
                                    className="text-xs text-[#5465ff] hover:underline dark:text-[#f8d4eb]"
                                  >
                                    {selectedMediaIndexesAfterRefrain.size === selectedMediasAfterRefrain.length
                                      ? "Deselect All"
                                      : "Select All"}
                                  </button>
                                </div>
                              </div>
                              <ScrollArea className="h-[200px] w-full">
                                <div className="grid grid-cols-5 gap-2 p-1 min-w-[200px]">
                                  {selectedMediasAfterRefrain.map((media, index) => (
                                    <div
                                      key={index}
                                      onClick={() => toggleMediaSelectionAfterRefrain(index)}
                                      className={`relative w-10 aspect-[9/16] rounded-lg overflow-hidden cursor-pointer border-2 group ${
                                        selectedMediaIndexesAfterRefrain.has(index)
                                          ? "bg-[#3e90fd]/10 border-[#5465ff] ring-2 ring-[#5465ff] dark:bg-[#3e90fd]/10 dark:border-[#5465ff] dark:ring-[#5465ff]"
                                          : "border-transparent hover:border-gray-500 dark:hover:border-gray-300"
                                      }`}
                                    >
                                      <div className="relative w-full h-full">
                                        {media.url && media.type === 'video' ? (
                                          <video
                                            src={media.url}
                                            className="w-full h-full object-cover"
                                            preload="metadata"
                                            muted
                                            loop
                                          />
                                        ) : media.url ? (
                                          <Image
                                            src={media.url}
                                            alt={`Media ${index + 1}`}
                                            className="w-full h-full object-cover"
                                            layout="fill"
                                          />
                                        ) : null}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            </div>
                          )}
                        </section>
                      </>
                    ) : (
                      <>
                      {/* Videos Upload - Moved to position 4 */}
                      <section className="space-y-2 bg-[#f3f4f0] dark:bg-[#0e0f15] p-3 rounded-lg border border-[#d2d2d0]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">4</div>
                            <h2 className="text-base font-bold dark:text-white">Part 2</h2>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div {...getRootProps()}>
                            <input {...getInputProps()} />
                            <button className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors text-sm font-normal flex items-center gap-2">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Upload
                            </button>
                          </div>
                          {selectedMedias.length > 0 && (
                            <span className="text-sm text-gray-500 dark:text-gray-400">{selectedMedias.length}/50</span>
                          )}
                        </div>
                      <div className="flex-1">
                        <div className="flex justify-center mt-auto pt-4 mb-2">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="2"
                              max="29"
                              value={videoDurationRange.min}
                              onChange={(e) => {
                                const newMin = Number(e.target.value);
                                if (newMin >= 2 && newMin < videoDurationRange.max) {
                                  setVideoDurationRange(prev => ({
                                    min: newMin,
                                    max: prev.max
                                  }));
                                }
                              }}
                              className="w-12 h-7 px-1 border border-gray-300 dark:border-[#0e0f15] dark:bg-[#18181a] dark:text-white rounded-md text-center text-sm"
                            />
                            <span className="text-gray-500 dark:text-gray-400 text-xs">-</span>
                            <input
                              type="number"
                              min="3"
                              max="30"
                              value={videoDurationRange.max}
                              onChange={(e) => {
                                const newMax = Number(e.target.value);
                                if (newMax <= 30 && newMax > videoDurationRange.min) {
                                  setVideoDurationRange(prev => ({
                                    min: prev.min,
                                    max: newMax
                                  }));
                                }
                              }}
                              className="w-12 h-7 px-1 border border-gray-300 dark:border-[#0e0f15] dark:bg-[#18181a] dark:text-white rounded-md text-center text-sm"
                            />
                            <span className="text-xs text-gray-600 dark:text-gray-300 ml-1">Seconds</span>
                          </div>
                        </div>
                      </div>
                      {selectedMedias.length === 0 ? (
                        <div className="h-[200px] flex items-center justify-center text-center text-gray-500 dark:text-gray-400">
                          <div>
                            <p>No media uploaded</p>
                            <p className="text-sm mt-2">Upload videos or images to continue (50 max)</p>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              {selectedMediaIndexes.size >= 2 && (
                                <button
                                  onClick={handleDeleteSelectedMedias}
                                  className="text-red-500 hover:text-red-600 transition-colors"
                                  title="Delete selected medias"
                                >
                                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </button>
                              )}
                              <button
                                onClick={toggleAllMedias}
                                className="text-xs text-[#5465ff] hover:underline dark:text-[#f8d4eb]"
                              >
                                {selectedMediaIndexes.size === selectedMedias.length
                                  ? "Deselect All"
                                  : "Select All"}
                              </button>
                            </div>
                          </div>
                          <ScrollArea className="h-[200px] w-full">
                            <div className="grid grid-cols-5 gap-2 p-1 min-w-[200px]">
                              {selectedMedias.map((media, index) => (
                                <div
                                  key={index}
                                  onClick={() => toggleMediaSelection(index)}
                                  className={`relative w-10 aspect-[9/16] rounded-lg overflow-hidden cursor-pointer border-2 group ${
                                    selectedMediaIndexes.has(index)
                                      ? "bg-[#3e90fd]/10 border-[#5465ff] ring-2 ring-[#5465ff] dark:bg-[#3e90fd]/10 dark:border-[#5465ff] dark:ring-[#5465ff]"
                                      : "border-transparent hover:border-gray-500 dark:hover:border-gray-300"
                                  }`}
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteMedia(index);
                                    }}
                                    className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
                                    title="Delete media"
                                  >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  </button>
                                  <div className="relative w-full h-full">
                                    {media.url ? (
                                      <div className="relative w-full h-full">
                                        {media.type === 'video' ? (
                                          <video 
                                            id={`video-${index}`}
                                            src={media.url} 
                                            className="w-full h-full object-cover"
                                            preload="metadata"
                                            autoPlay
                                            muted
                                            loop
                                          />
                                        ) : (
                                          <Image 
                                            src={media.url}
                                            alt={`Media ${index + 1}`}
                                            className="w-full h-full object-cover"
                                            layout="fill"
                                          />
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-center p-2">
                                        <p className="text-xs font-medium truncate dark:text-white">{media.file.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                          {media.type === 'video' ? formatDuration(media.duration) : '5s'}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                      </section>
                      </>
                    )}
                  </div>
                  )}

                  {/* Create Videos Button */}
                  <div className="flex flex-col items-center justify-center mt-8 mb-4">
                    {contentType === 'slideshow' && (
                      <div className="flex flex-col items-center gap-3 mb-4">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <label htmlFor="slideshows-count" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Number of slideshows:
                            </label>
                            <input
                              id="slideshows-count"
                              type="number"
                              min="1"
                              max={getSlideshowCombinationCount(slideshowImages, slideshowHooksPerImage, slideshowImageCount, slideshowUploadMode)}
                              value={slideshowsToCreate}
                              onChange={(e) => setSlideshowsToCreate(Math.max(1, Math.min(
                                getSlideshowCombinationCount(slideshowImages, slideshowHooksPerImage, slideshowImageCount, slideshowUploadMode),
                                parseInt(e.target.value) || 1
                              )))}
                              className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-[#e6e6e1] dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Max: {getSlideshowCombinationCount(slideshowImages, slideshowHooksPerImage, slideshowImageCount, slideshowUploadMode).toLocaleString()} combinations
                          </div>
                        </div>
                        {getSlideshowCombinationCount(slideshowImages, slideshowHooksPerImage, slideshowImageCount, slideshowUploadMode) > 1 && (
                          <div className="text-xs text-center text-gray-500 dark:text-gray-400 max-w-md">
                            {slideshowUploadMode === 'random' 
                              ? 'Combinations based on image permutations and hooks per image'
                              : 'Combinations based on hooks per image'
                            }
                          </div>
                        )}
                      </div>
                    )}

                        {/* Auto Lyrics Editor - Separate section */}
                        {selectedModel === 'twain-ya-gamila' && autoCutTemplate === 'auto-lyrics' && (
                          <section className="space-y-4 bg-[#f3f4f0] dark:bg-[#0e0f15] p-4 rounded-lg border border-[#d2d2d0] w-full">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">6</div>
                                <h2 className="text-base font-bold dark:text-white">Auto Lyrics Editor</h2>
                              </div>
                            </div>

                            <div className="space-y-3 p-3 bg-white dark:bg-gray-800 rounded-lg">
                              {/* Lyrics Display for Auto Lyrics template */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Transcribe Lyrics (Optional)</label>
                                  <div className="flex gap-2">
                                    {wordTimestamps.length > 0 && (
                                      <button
                                        onClick={() => setShowTimestampEditor(true)}
                                        className="px-3 py-1.5 bg-[#3e90fd] text-white border border-[#3e90fd] rounded-lg hover:bg-[#2d7fe3] transition-colors flex items-center gap-2 text-sm font-normal"
                                      >
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                        Edit
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="min-h-[150px] p-3 bg-[#f3f4f0] dark:bg-[#18181a] border border-[#d2d2d0] dark:border-[#0e0f15] rounded-lg">
                                  {hooks ? (
                                    <p className="text-sm text-gray-700 dark:text-white whitespace-pre-wrap">{hooks}</p>
                                  ) : (
                                    <p className="text-sm text-gray-400 dark:text-gray-500">
                                      Lyrics will appear here after detection...
                                    </p>
                                  )}
                                </div>
                                {wordTimestamps.length > 0 && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    ✓ {wordTimestamps.length} words with timestamps detected
                                  </p>
                                )}
                              </div>
                            </div>
                          </section>
                        )}

                        {/* Reload videos from linked folders button */}
                        {(Object.keys(feinFolderMappings).some(key => feinFolderMappings[key]) || Object.keys(creedFolderMappings).some(key => creedFolderMappings[key])) && (
                          <div className="w-full mb-4">
                          <button
                            onClick={() => {
                              // Recharger les vidéos des dossiers liés
                              const loadFolderVideos = async () => {
                                if (!user?.id) return;
                                
                                setLoadingFolderVideos(true);
                                
                                try {
                                  const { getUserClips } = await import('@/lib/supabase');
                                  
                                  if (selectedModel === 'fein-clipper') {
                                    // Charger les vidéos FE!N
                                    for (let i = 1; i <= 10; i++) {
                                      const partKey = `part${i}`;
                                      const folderId = feinFolderMappings[partKey];
                                      
                                      if (folderId) {
                                        const clips = await getUserClips(user.id, folderId);
                                        
                                        const files = clips.map(clip => {
                                          const file = new File([], clip.file_name || `clip_${clip.id}.mp4`, {
                                            type: 'video/mp4'
                                          });
                                          (file as any).clipUrl = clip.path;
                                          (file as any).clipId = clip.id;
                                          return file;
                                        });
                                        
                                        const validFiles = files.filter(f => f !== null) as File[];
                                        
                                        setMaxCombinaisonsParts(prev => ({
                                          ...prev,
                                          [partKey]: validFiles
                                        }));
                                        
                                        console.log(`FE!N Partie ${i}: ${validFiles.length} vidéos chargées`);
                                      }
                                    }
                                    toast.success('Vidéos FE!N rechargées depuis les dossiers liés');
                                  } else if (selectedModel === 'creed-streamer') {
                                    // Charger les vidéos Creed Streamer
                                    for (let i = 1; i <= 11; i++) {
                                      const partKey = `creed-part${i}`;
                                      const folderId = creedFolderMappings[partKey];
                                      
                                      if (folderId) {
                                        const clips = await getUserClips(user.id, folderId);
                                        
                                        const files = clips.map(clip => {
                                          const file = new File([], clip.file_name || `clip_${clip.id}.mp4`, {
                                            type: 'video/mp4'
                                          });
                                          (file as any).clipUrl = clip.path;
                                          (file as any).clipId = clip.id;
                                          return file;
                                        });
                                        
                                        const validFiles = files.filter(f => f !== null) as File[];
                                        
                                        setCreedStreamerParts(prev => ({
                                          ...prev,
                                          [`part${i}`]: validFiles
                                        }));
                                        
                                        console.log(`Creed Partie ${i}: ${validFiles.length} vidéos chargées`);
                                      }
                                    }
                                    toast.success('Vidéos Creed Streamer rechargées depuis les dossiers liés');
                                  }
                                } catch (e) {
                                  console.error('Erreur lors du chargement des vidéos:', e);
                                  toast.error('Erreur lors du chargement des vidéos');
                                } finally {
                                  setLoadingFolderVideos(false);
                                }
                              };
                              
                              loadFolderVideos();
                            }}
                            disabled={loadingFolderVideos}
                            className="px-4 py-2 text-sm bg-[#f44e17] text-white rounded-lg hover:bg-[#f44e17]/90 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                          >
                            {loadingFolderVideos ? (
                              <>
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Loading...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Reload from folders
                              </>
                            )}
                          </button>
                          </div>
                        )}

                    {/* Detect Lyrics Button - Only for Auto Lyrics template */}
                    {autoCutTemplate === 'auto-lyrics' && (
                      <button
                        onClick={extractLyricsFromAudio}
                        disabled={isExtractingLyrics || !selectedSong || selectedSong.id === 'no-music'}
                        className="w-64 h-12 px-4 py-3 bg-[#3e90fd] text-white rounded-lg hover:bg-[#2d7fe3] transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold text-lg mb-4"
                      >
                        {isExtractingLyrics ? (
                          <>
                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Extracting lyrics...
                          </>
                        ) : (
                          <>
                            <MusicIcon className="w-5 h-5" />
                            Detect Lyrics
                          </>
                        )}
                      </button>
                    )}

                    <Button
                      onClick={handleCreateVideos}
                      disabled={
                        contentType === 'slideshow'
                          ? (slideshowImages.length === 0 || isGenerating)
                          : selectedModel === 'fein-clipper'
                          ? (() => {
                              const partsArray = [
                                maxCombinaisonsParts.part1,
                                maxCombinaisonsParts.part2,
                                maxCombinaisonsParts.part3,
                                maxCombinaisonsParts.part4,
                                maxCombinaisonsParts.part5,
                                maxCombinaisonsParts.part6,
                                maxCombinaisonsParts.part7,
                                maxCombinaisonsParts.part8,
                                maxCombinaisonsParts.part9,
                                maxCombinaisonsParts.part10
                              ];
                              const hasAllParts = partsArray.every(part => part.length > 0);
                              return !hasAllParts || !selectedSong || isGenerating;
                            })()
                          : selectedModel === 'creed-streamer'
                            ? (() => {
                                const partsArray = [
                                  creedStreamerParts.part1,
                                  creedStreamerParts.part2,
                                  creedStreamerParts.part3,
                                  creedStreamerParts.part4,
                                  creedStreamerParts.part5,
                                  creedStreamerParts.part6,
                                  creedStreamerParts.part7,
                                  creedStreamerParts.part8,
                                  creedStreamerParts.part9,
                                  creedStreamerParts.part10,
                                  creedStreamerParts.part11
                                ];
                                const hasAllParts = partsArray.every(part => part.length > 0);
                                return !hasAllParts || !selectedSong || isGenerating;
                              })()
                            : autoCutTemplate === 'auto-lyrics'
                              ? (!collectionBeforeRefrain ||
                                 (!useOneCollection && !collectionAfterRefrain) ||
                                 !selectedSong || isGenerating || !wordTimestamps || wordTimestamps.length === 0 ||
                                 (collectionBeforeRefrain?.videos?.length || 0) === 0 ||
                                 (!useOneCollection && (collectionAfterRefrain?.videos?.length || 0) === 0))
                            : selectedModel === 'twain-ya-gamila'
                              ? (!twainYaGamilaState.collection || !selectedSong || isGenerating ||
                                ((twainYaGamilaState.collection.images?.length || 0) < 22 && (twainYaGamilaState.collection.videos?.length || 0) < 1))
                            : selectedModel === 'add-hook'
                              ? (!twainYaGamilaState.collection || !hooks || hooks.trim() === "" || isGenerating ||
                                ((twainYaGamilaState.collection.images?.length || 0) < 1 && (twainYaGamilaState.collection.videos?.length || 0) < 1))
                            : selectedModel === 'versus'
                             ? (getVersusCombinationCount(versusParts, versusEnabled) === 0 || !selectedSong || isGenerating)
                            : (!selectedTemplate || selectedMediaIndexes.size === 0 || !selectedSong || !hooks || isGenerating)
                      }
                      className="w-64 h-12 text-lg font-semibold bg-[#f44e17] hover:bg-[#f44e17]/90 text-white rounded-lg"
                    >
                      {isGenerating ? (
                        <div className="flex items-center justify-center w-full">
                          <span>Generating...</span>
                        </div>
                      ) : contentType === 'slideshow' ? (
                        `Create ${slideshowsToCreate} Slideshow${slideshowsToCreate > 1 ? 's' : ''}`
                      ) : selectedModel === 'fein-clipper' ? (
                        (() => {
                          const counts = [
                            maxCombinaisonsParts.part1.length,
                            maxCombinaisonsParts.part2.length,
                            maxCombinaisonsParts.part3.length,
                            maxCombinaisonsParts.part4.length,
                            maxCombinaisonsParts.part5.length,
                            maxCombinaisonsParts.part6.length,
                            maxCombinaisonsParts.part7.length,
                            maxCombinaisonsParts.part8.length,
                            maxCombinaisonsParts.part9.length,
                            maxCombinaisonsParts.part10.length
                          ];
                          const hasAllParts = counts.every(count => count > 0);
                          const logoText = maxCombinaisonsParts.logo.length > 0 ? ' (with logo)' : '';
                          return hasAllParts ? `Create ${videosToCreate} Video${videosToCreate > 1 ? 's' : ''}${logoText}` : 'Create Videos';
                        })()
                      ) : selectedModel === 'creed-streamer' ? (
                        (() => {
                          const counts = [
                            creedStreamerParts.part1.length,
                            creedStreamerParts.part2.length,
                            creedStreamerParts.part3.length,
                            creedStreamerParts.part4.length,
                            creedStreamerParts.part5.length,
                            creedStreamerParts.part6.length,
                            creedStreamerParts.part7.length,
                            creedStreamerParts.part8.length,
                            creedStreamerParts.part9.length,
                            creedStreamerParts.part10.length,
                            creedStreamerParts.part11.length
                          ];
                          const hasAllParts = counts.every(count => count > 0);
                          const logoText = creedStreamerParts.logo.length > 0 ? ' (with logo)' : '';
                          return hasAllParts ? `Create ${videosToCreate} Video${videosToCreate > 1 ? 's' : ''}${logoText}` : 'Create Videos';
                        })()
                      ) : selectedModel === 'twain-ya-gamila' || selectedModel === 'add-hook' ? (
                        `Create ${twainYaGamilaState.videosToGenerate} Video${twainYaGamilaState.videosToGenerate > 1 ? 's' : ''}`
                      ) : selectedModel === 'add-hook' ? (
                        `Create ${twainYaGamilaState.videosToGenerate} Video${twainYaGamilaState.videosToGenerate > 1 ? 's' : ''} with Hooks`
                      ) : selectedModel === 'versus' ? (
                        `Create ${getVersusCombinationCount(versusParts, versusEnabled).toLocaleString()} Versus Videos`
                      ) : (
                        `Create ${hooks.split('\n').filter(line => line.trim() !== '').length} Videos`
                      )}
                    </Button>
                  </div>

                  {/* Progress bar pendant la génération */}
                  {isGenerating && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                      <div className="bg-[#e6e6e1] dark:bg-[#18181a] rounded-lg shadow-xl p-8 max-w-md w-full mx-4 transform transition-all">
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h3 className="text-xl font-semibold dark:text-white">Generating Videos</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-300">Please wait while your videos are being created</p>
                          </div>
                          <div className="text-right">
                            <span className="text-3xl font-bold text-[#5465ff]">{Math.round(progress)}%</span>
                          </div>
                        </div>
                        
                        <div className="relative w-full h-6 bg-gray-100 dark:bg-[#0e0f15] rounded-full overflow-hidden mb-4">
                          <div
                            className="absolute left-0 top-0 h-full bg-[#3e90fd] transition-all duration-300 rounded-full"
                            style={{ 
                              width: `${progress}%`,
                              transition: progress < 90 ? 'width 0.5s ease-in-out' : 'none'
                            }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-[#3e90fd] rounded-full animate-pulse" />
                            <span>Processing video {generatedCount + 1} of {totalToGenerate}</span>
                          </div>
                          <span className="font-medium">{generatedCount}/{totalToGenerate} videos</span>
                        </div>
                        
                        {/* Estimation du temps restant basée sur la taille des fichiers */}
                        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                          {progress < 90 ? (
                            <div className="text-center">
                              {progress === 0 ? (
                                "Calculating estimated time..."
                              ) : (
                                <>
                                  Estimated time remaining: {Math.ceil(
                                    ((totalToGenerate - generatedCount) * 
                                    (selectedTemplate ? 
                                      estimateProcessingTime(
                                        (templates.find(t => t.id === selectedTemplate) as any)?.size ?? 1024 * 1024,
                                        selectedMedias.reduce((avg, media, _, { length }) => 
                                          avg + (media.file?.size || 0) / length, 0
                                        )
                                      ) : BASE_PROCESSING_TIME)
                                    ) / 60
                                  )} minutes
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="text-center">
                              Finalizing video generation...
                            </div>
                          )}
                        </div>
                        
                        {/* Bouton Cancel */}
                        <div className="mt-6 flex justify-center">
                          <button
                            onClick={() => {
                              setIsGenerating(false);
                              setProgress(0);
                              setGeneratedCount(0);
                              setTotalToGenerate(0);
                              setGeneratedVideos([]);
                              setCurrentHookIndex(0);
                              setCurrentMediaIndex(0);
                            }}
                            className="px-6 py-2 !bg-[#e6e6e1] text-black border border-gray-300 rounded-lg hover:!bg-gray-100 transition-colors duration-200 font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Animation de fin */}
                  {showCompletionAnimation && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                      <div className="bg-[#e6e6e1] dark:bg-[#18181a] rounded-lg shadow-xl p-8 max-w-md w-full mx-4 transform transition-all" style={{ animation: 'fadeInScale 0.5s ease-out' }}>
                        <div className="flex flex-col items-center justify-center">
                          <div className="w-24 h-24 rounded-full bg-[#3e90fd] flex items-center justify-center mb-6" style={{ animation: 'bounce 2s ease' }}>
                            <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                            </svg>
                          </div>
                          <h3 className="text-2xl font-bold text-center mb-2 dark:text-white">Generation Complete!</h3>
                          <p className="text-center text-gray-500 dark:text-gray-300 mb-4">All your videos have been successfully created</p>
                          <div className="w-full bg-gray-100 dark:bg-[#0e0f15] rounded-full h-2 mb-4">
                            <div className="bg-[#3e90fd] h-2 rounded-full" style={{ animation: 'progress 1s ease-in-out forwards' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Option de téléchargement après génération */}
                  {generationComplete && !isGenerating && generatedVideos.length > 0 && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                      <div className="bg-[#18181A] rounded-lg shadow-xl p-8 max-w-2xl w-full mx-4 border border-gray-700">
                        <div className="flex flex-col items-center justify-center">
                          <h3 className="text-2xl font-bold text-center mb-4 text-white">
                            Your {generatedVideos.length} {selectedModel === 'add-hook' ? 'media' : 'videos'} {generatedVideos.length === 1 ? 'is' : 'are'} ready !
                          </h3>
                          <p className="text-center text-gray-300 mb-6">What would you like to do next ?</p>
                          
                          {/* Preview section */}
                          <div className="w-full mb-4 relative">
                            <div className="aspect-[9/16] bg-black rounded-lg overflow-hidden max-w-[280px] mx-auto max-h-[440px]">
                              {(() => {
                                const currentMedia = generatedVideos[currentPreviewIndex] || '';
                                const isImage = currentMedia.toLowerCase().includes('.jpg') || currentMedia.toLowerCase().includes('.jpeg') || currentMedia.toLowerCase().includes('.png') || currentMedia.toLowerCase().includes('.gif');
                                
                                if (isImage) {
                                  return (
                                    <img 
                                      className="w-full h-full object-contain"
                                      src={currentMedia}
                                      alt={`Generated media ${currentPreviewIndex + 1}`}
                                    />
                                  );
                                } else {
                                  return (
                                    <video 
                                      className="w-full h-full object-contain"
                                      src={currentMedia}
                                      controls
                                      autoPlay
                                      loop
                                      muted
                                    />
                                  );
                                }
                              })()}
                            </div>
                            
                            {/* Navigation controls */}
                            {generatedVideos.length > 1 && (
                              <div className="absolute top-1/2 left-0 right-0 -mt-5 flex justify-between px-4">
                                <button 
                                  onClick={() => setCurrentPreviewIndex(prev => (prev === 0 ? generatedVideos.length - 1 : prev - 1))}
                                  className="bg-black/50 hover:bg-black/70 text-white rounded-full p-1"
                                  aria-label="Previous video"
                                >
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                                  </svg>
                                </button>
                                <button 
                                  onClick={() => setCurrentPreviewIndex(prev => (prev === generatedVideos.length - 1 ? 0 : prev + 1))}
                                  className="bg-black/50 hover:bg-black/70 text-white rounded-full p-1"
                                  aria-label="Next video"
                                >
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                              </div>
                            )}
                            
                            {/* Pagination indicator */}
                            {generatedVideos.length > 1 && (
                              <div className="flex justify-center gap-1 mt-1">
                                {generatedVideos.map((_, index) => (
                                  <button 
                                    key={index}
                                    onClick={() => setCurrentPreviewIndex(index)}
                                    className={`h-1.5 rounded-full transition-all ${
                                      index === currentPreviewIndex 
                                        ? 'w-4 bg-[#3e90fd]' 
                                        : 'w-1.5 bg-gray-500'
                                    }`}
                                    aria-label={`Go to video ${index + 1}`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col gap-3 w-full">
                            {/* Add Hook Template Button - Only for Add Hook model */}
                            {selectedModel === 'add-hook' && twainYaGamilaState.collection?.videos && twainYaGamilaState.collection.videos.length > 0 && (
                              <div className="flex flex-row gap-2 w-full">
                                <button
                                  onClick={async () => {
                                    try {
                                      setIsGenerating(true);
                                      
                                      // D'abord créer une image hook transparente
                                      const hookText = addHookState.hooks[0]; // Prendre le premier hook
                                      if (!hookText) {
                                        toast.error('No hook text available');
                                        return;
                                      }
                                      
                                      // Préparer les headers d'auth
                                      const authHeaders: Record<string, string> = {
                                        'Content-Type': 'application/json'
                                      };
                                      
                                      if (user?.id) {
                                        try {
                                          const { data: { session } } = await supabaseClient.auth.getSession();
                                          if (session?.access_token) {
                                            authHeaders['Authorization'] = `Bearer ${session.access_token}`;
                                          }
                                        } catch (e) {
                                          console.warn('Could not get auth session');
                                        }
                                      }
                                      
                                      console.log('Creating transparent hook image...');
                                      
                                      // Créer l'image hook transparente
                                      const hookImageResponse = await fetch('/api/create-hook-image', {
                                        method: 'POST',
                                        headers: authHeaders,
                                        body: JSON.stringify({
                                          hookText: hookText,
                                          style: addHookState.fontStyle,
                                          position: addHookState.position,
                                          offset: addHookState.offset,
                                          template: autoCutTemplate === 'auto-lyrics' ? 'auto-lyrics' : 'default'
                                        }),
                                      });
                                      
                                      if (!hookImageResponse.ok) {
                                        const errorText = await hookImageResponse.text();
                                        console.error('Hook image creation error:', errorText);
                                        toast.error('Failed to create hook image');
                                        return;
                                      }
                                      
                                      const hookImageResult = await hookImageResponse.json();
                                      console.log('Hook image created:', hookImageResult.hookImageUrl);
                                      
                                      // Préparer les vidéos de la collection
                                      const collectionVideos = twainYaGamilaState.collection!.videos || [];
                                      const videosData = collectionVideos.map(video => ({ url: video.url, type: 'video' }));
                                      
                                      console.log('Applying hook overlay to videos:', {
                                        hookImageUrl: hookImageResult.hookImageUrl,
                                        videosCount: videosData.length
                                      });
                                      
                                      // Appliquer l'image hook sur les vidéos
                                      const response = await fetch('/api/create-video/add-hook-template', {
                                        method: 'POST',
                                        headers: authHeaders,
                                        body: JSON.stringify({
                                          templateImageUrl: hookImageResult.hookImageUrl,
                                          videos: videosData,
                                          videoCount: Math.min(5, videosData.length) // Limiter à 5 vidéos pour commencer
                                        }),
                                      });
                                      
                                      if (response.ok) {
                                        const result = await response.json();
                                        console.log('Hook overlay videos generated:', result);
                                        
                                        // Ajouter les nouvelles vidéos à la liste
                                        const newVideos = result.videos.map((v: any) => v.url);
                                        setGeneratedVideos(prev => [...prev, ...newVideos]);
                                        
                                        toast.success(`Generated ${result.videos.length} videos with hook overlay!`);
                                      } else {
                                        const errorText = await response.text();
                                        console.error('Hook overlay generation error:', errorText);
                                        toast.error('Failed to apply hook overlay to videos');
                                      }
                                    } catch (error) {
                                      console.error('Error applying hook overlay:', error);
                                      toast.error('Error applying hook overlay to videos');
                                    } finally {
                                      setIsGenerating(false);
                                    }
                                  }}
                                  disabled={isGenerating}
                                  className="flex-1 px-4 py-2.5 text-sm bg-[#3e90fd] text-white rounded-lg font-medium hover:bg-[#3e90fd]/90 transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                  </svg>
                                  {isGenerating ? 'Applying Template...' : 'Apply to Videos'}
                                </button>
                              </div>
                            )}
                            
                            <div className="flex flex-row gap-2 w-full">
                              <button
                                onClick={handleDownloadAll}
                                className="flex-1 px-4 py-2.5 text-sm bg-[#f44e17] text-[#fafafa] rounded-lg font-medium hover:bg-[#f44e17]/90 transition-colors duration-200 flex items-center justify-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                                </svg>
                                Download All
                              </button>
                            </div>
                            <div className="flex flex-row gap-2 w-full">
                              <button
                                onClick={() => router.push('/generated-videos')}
                                className="flex-1 px-4 py-2.5 text-sm bg-[#fafafa] text-[#0B0A0D] rounded-lg font-medium hover:bg-[#f5f5f5] transition-colors duration-200"
                              >
                                My Generated Videos
                              </button>
                              <button
                                onClick={() => {
                                  setGenerationComplete(false);
                                }}
                                className="flex-1 px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-white rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-[#18191C] transition-colors duration-200"
                              >
                                Close
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Video Preview Modal */}
                  {previewVideo && (
                    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                      <div className="relative w-full max-w-4xl">
                        <button
                          onClick={() => setPreviewVideo(null)}
                          className="absolute -top-10 right-0 text-white hover:text-gray-300"
                        >
                          Close
                        </button>
                        <video
                          className="w-full rounded-lg"
                          src={previewVideo}
                          controls
                          autoPlay
                        >
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    </div>
                  )}

                  {/* Download Modal */}
                  {showDownloadModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                      <div className="bg-[#e6e6e1] dark:bg-[#18181a] rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-semibold dark:text-white">Vidéos générées</h3>
                          <button
                            onClick={() => setShowDownloadModal(false)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-[#18191C] rounded-lg dark:text-white"
                          >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto">
                          <div className="grid gap-4">
                            {generatedVideos.map((videoFileName, index) => (
                              <div
                                key={videoFileName}
                                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#0e0f15] rounded-lg"
                              >
                                <span className="font-medium dark:text-white">Vidéo {index + 1}</span>
                                <button
                                  onClick={() => handleDownloadVideo(videoFileName)}
                                  className="px-4 py-2 bg-[#f44e17] text-white rounded-lg hover:bg-[#f44e17]/90 transition-colors"
                                >
                                  Télécharger
                                </button>
                      </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-4">
                          <button
                            onClick={() => setShowDownloadModal(false)}
                            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            Fermer
                          </button>
                          <button
                            onClick={handleDownloadAll}
                            className="px-6 py-3 bg-[#f44e17] text-white rounded-lg hover:bg-[#f44e17]/90 transition-colors"
                          >
                            Tout télécharger ({generatedVideos.length} vidéos)
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Panel - Preview */}
              <div className="w-[250px] sm:w-[250px] md:w-[300px] lg:w-[350px] xl:w-[400px] p-3 sm:p-4 xl:p-6 bg-[#e6e6e1] dark:bg-[#18181A] flex-col items-center justify-center border-l border-gray-200 dark:border-[#0e0f15] flex rounded-r-2xl">
                
                {/* Font Size Controls */}
                <div className="w-full max-w-[220px] md:max-w-[280px] xl:max-w-[320px] mb-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Font Size
                      </label>
                      <button
                        onClick={() => setRandomFontSize(!randomFontSize)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                          randomFontSize
                            ? 'bg-[#3e90fd] text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        Random
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">S</span>
                      <div className="flex-1 relative">
                        <input
                          type="range"
                          min="50"
                          max="250"
                          value={fontSize}
                          onChange={(e) => setFontSize(Number(e.target.value))}
                          disabled={randomFontSize}
                          className={`w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer ${
                            randomFontSize ? 'opacity-50' : ''
                          }`}
                          style={{
                            background: randomFontSize
                              ? undefined
                              : `linear-gradient(to right, #3e90fd 0%, #3e90fd ${((fontSize - 50) / 200) * 100}%, #e5e7eb ${((fontSize - 50) / 200) * 100}%, #e5e7eb 100%)`
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">L</span>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 min-w-[35px]">
                        {randomFontSize ? 'Auto' : `${fontSize}px`}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="w-full max-w-[220px] md:max-w-[280px] xl:max-w-[320px]">
                  <div className="aspect-[9/16] rounded-2xl bg-[#e6e6e1] dark:bg-[#18181A] shadow-lg overflow-hidden relative">
                    {(selectedTemplate || ((selectedModel === 'twain-ya-gamila' || selectedModel === 'add-hook') && twainYaGamilaState.collection)) ? (
                      <>
                        {(selectedModel === 'twain-ya-gamila' || selectedModel === 'add-hook') && twainYaGamilaState.collection ? (
                          <>
                            {/* Afficher la première image si disponible */}
                            {twainYaGamilaState.collection.images && twainYaGamilaState.collection.images.length > 0 ? (
                              <img
                                src={twainYaGamilaState.collection.images[0].url}
                                alt="Collection Preview"
                                className="absolute inset-0 w-full h-full object-cover"
                              />
                            ) : twainYaGamilaState.collection.videos && twainYaGamilaState.collection.videos.length > 0 ? (
                              /* Afficher la première vidéo si pas d'images */
                              <video
                                src={twainYaGamilaState.collection.videos[0].url}
                                className="absolute inset-0 w-full h-full object-cover"
                                muted
                                autoPlay
                                loop
                                playsInline
                              />
                            ) : (
                              /* Fallback si collection vide */
                              <img
                                src="/preview.jpg"
                                alt="Default Preview"
                                className="absolute inset-0 w-full h-full object-cover"
                              />
                            )}
                          </>
                        ) : (
                          <TemplateImage 
                            template={{ 
                              url: selectedTemplate === defaultTemplate?.id 
                                ? defaultTemplate.url 
                                : templates.find(t => t.id === selectedTemplate)?.url || "",
                              type: selectedTemplate === defaultTemplate?.id
                                ? defaultTemplate.type || 'image'
                                : templates.find(t => t.id === selectedTemplate)?.type || 'image'
                            }} 
                            alt="Preview" 
                            position={templateImagePosition}
                          />
                        )}
                        {hooks && (
                          <canvas
                            ref={canvasRef}
                            className="absolute inset-0 w-full h-full"
                            style={{ pointerEvents: 'none' }}
                          />
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full relative">
                        <Image
                          src="/preview.jpg"
                          alt="Preview background"
                          layout="fill"
                          objectFit="cover"
                          className="absolute inset-0"
                        />
                        {/* Logo Overlay for FE!N clipper */}
                        {selectedModel === 'fein-clipper' && maxCombinaisonsParts.logo.length > 0 && (
                          <div className="absolute inset-0 pointer-events-none">
                            <img
                              src={getVideoUrl(maxCombinaisonsParts.logo[0])}
                              alt="Logo"
                              className="absolute"
                              style={{
                                width: '30%',
                                height: 'auto',
                                maxWidth: '300px',
                                bottom: '80px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                              }}
                            />
                          </div>
                        )}
                        {/* Logo Overlay for Creed Streamer */}
                        {selectedModel === 'creed-streamer' && creedStreamerParts.logo.length > 0 && (
                          <div className="absolute inset-0 pointer-events-none">
                            <img
                              src={getVideoUrl(creedStreamerParts.logo[0])}
                              alt="Logo"
                              className="absolute"
                              style={{
                                width: '30%',
                                height: 'auto',
                                maxWidth: '300px',
                                bottom: '80px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                              }}
                            />
                          </div>
                        )}
                        <div className="relative w-full h-full">
                          <canvas
                            ref={canvasRef}
                            className="absolute inset-0 w-full h-full"
                            style={{ pointerEvents: 'none' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Text Position Controls */}
                  <div className="flex flex-col items-center gap-4 mt-2">
                    {/* Random Position Button */}
                    <div className="flex justify-center mb-2">
                      <button
                        onClick={() => setRandomPosition(!randomPosition)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          randomPosition
                            ? 'bg-[#3e90fd] text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        Random Position
                      </button>
                    </div>
                    
                    {/* Position Buttons - Hidden when random position is active */}
                    <div className={`flex justify-center gap-2 ${randomPosition ? 'opacity-50 pointer-events-none' : ''}`}>
                      {/* Fine Position Control - Left of position buttons */}
                      <div className="flex gap-2 items-center mr-3">
                        <button
                          onClick={() => {
                            if (currentStyle === 1) {
                              setStyle1Position(prev => ({ ...prev, offset: Math.max(prev.offset - 5, -50) }));
                            } else if (currentStyle === 2) {
                              setStyle2Position(prev => ({ ...prev, offset: Math.max(prev.offset - 5, -50) }));
                            } else if (currentStyle === 3) {
                              setStyle3Position(prev => ({ ...prev, offset: Math.max(prev.offset - 5, -50) }));
                            } else {
                              setStyle4Position(prev => ({ ...prev, offset: Math.max(prev.offset - 5, -50) }));
                            }
                          }}
                          className="w-8 h-8 rounded-lg bg-[#e6e6e1] hover:bg-[#e6e6e1]/80 dark:bg-[#0e0f15] dark:hover:bg-[#18191C] dark:text-white flex items-center justify-center transition-all"
                          aria-label="Move text up"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 20V4m0 0l-6 6m6-6l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            if (currentStyle === 1) {
                              setStyle1Position(prev => ({ ...prev, offset: Math.min(prev.offset + 5, 50) }));
                            } else if (currentStyle === 2) {
                              setStyle2Position(prev => ({ ...prev, offset: Math.min(prev.offset + 5, 50) }));
                            } else if (currentStyle === 3) {
                              setStyle3Position(prev => ({ ...prev, offset: Math.min(prev.offset + 5, 50) }));
                            } else {
                              setStyle4Position(prev => ({ ...prev, offset: Math.min(prev.offset + 5, 50) }));
                            }
                          }}
                          className="w-8 h-8 rounded-lg bg-[#e6e6e1] hover:bg-[#e6e6e1]/80 dark:bg-[#0e0f15] dark:hover:bg-[#18191C] dark:text-white flex items-center justify-center transition-all"
                          aria-label="Move text down"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 4v16m0 0l-6-6m6 6l6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>

                      {/* Position Buttons */}
                      <button
                        onClick={() => {
                          if (currentStyle === 1) {
                            setStyle1Position({ position: 'top', offset: 0 });
                          } else if (currentStyle === 2) {
                            setStyle2Position({ position: 'top', offset: 0 });
                          } else if (currentStyle === 3) {
                            setStyle3Position({ position: 'top', offset: 0 });
                          } else {
                            setStyle4Position({ position: 'top', offset: 0 });
                          }
                        }}
                        className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all ${
                          (currentStyle === 1 ? style1Position.position : currentStyle === 2 ? style2Position.position : currentStyle === 3 ? style3Position.position : style4Position.position) === 'top'
                            ? 'bg-[#3e90fd] text-[#fafafa] dark:bg-[#3e90fd] dark:text-[#fafafa]'
                            : 'bg-[#e6e6e1] hover:bg-[#e6e6e1]/80 dark:bg-[#0e0f15] dark:hover:bg-[#18191C] dark:text-white'
                        }`}
                      >
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 5h16M4 9h16M10 13h4m-4 4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          if (currentStyle === 1) {
                            setStyle1Position({ position: 'middle', offset: 0 });
                          } else if (currentStyle === 2) {
                            setStyle2Position({ position: 'middle', offset: 0 });
                          } else if (currentStyle === 3) {
                            setStyle3Position({ position: 'middle', offset: 0 });
                          } else {
                            setStyle4Position({ position: 'middle', offset: 0 });
                          }
                        }}
                        className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all ${
                          (currentStyle === 1 ? style1Position.position : currentStyle === 2 ? style2Position.position : currentStyle === 3 ? style3Position.position : style4Position.position) === 'middle'
                            ? 'bg-[#3e90fd] text-[#fafafa] dark:bg-[#3e90fd] dark:text-[#fafafa]'
                            : 'bg-[#e6e6e1] hover:bg-[#e6e6e1]/80 dark:bg-[#0e0f15] dark:hover:bg-[#18191C] dark:text-white'
                        }`}
                      >
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 9h16M4 12h16M4 15h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          if (currentStyle === 1) {
                            setStyle1Position({ position: 'bottom', offset: 0 });
                          } else if (currentStyle === 2) {
                            setStyle2Position({ position: 'bottom', offset: 0 });
                          } else if (currentStyle === 3) {
                            setStyle3Position({ position: 'bottom', offset: 0 });
                          } else {
                            setStyle4Position({ position: 'bottom', offset: 0 });
                          }
                        }}
                        className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all ${
                          (currentStyle === 1 ? style1Position.position : currentStyle === 2 ? style2Position.position : currentStyle === 3 ? style3Position.position : style4Position.position) === 'bottom'
                            ? 'bg-[#3e90fd] text-[#fafafa] dark:bg-[#3e90fd] dark:text-[#fafafa]'
                            : 'bg-[#e6e6e1] hover:bg-[#e6e6e1]/80 dark:bg-[#0e0f15] dark:hover:bg-[#18191C] dark:text-white'
                        }`}
                      >
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M10 7h4m-4 4h4M4 15h16M4 19h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>

                    {/* Test Hook button */}
                    <div className="flex gap-2 items-center">
                      {hooks && (
                        <Button
                          onClick={async () => {
                            try {
                              const hookText = getFirstHook();
                              
                              // Ne pas créer de preview si le hook est vide
                              if (hookText.trim() === "") {
                                toast.info("Veuillez d'abord saisir un hook");
                                return;
                              }
                              
                              // Capturer directement le canvas de la preview
                              if (canvasRef.current) {
                                const canvas = canvasRef.current;
                                canvas.toBlob((blob) => {
                                  if (blob) {
                                    const url = URL.createObjectURL(blob);
                                    window.open(url, '_blank');
                                  }
                                });
                              }
                            } catch (error) {
                              console.error('Error creating hook preview:', error);
                            }
                          }}
                          className="bg-transparent border border-[#b8b8b8] text-[#383838] hover:bg-gray-50"
                          size="sm"
                        >
                          Test Hook
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Word-by-Word Timestamp Editor Modal */}
      {showTimestampEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Lyrics</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Edits here sync with the timing view below. New words keep their spot when possible, and we estimate timings for anything added or split.
                </p>
              </div>
              <button
                onClick={() => setShowTimestampEditor(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Edit Lyrics Textarea */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <Textarea
                value={
                  textCase === 'uppercase'
                    ? hooks.toUpperCase()
                    : textCase === 'lowercase'
                      ? hooks.toLowerCase()
                      : hooks
                }
                onChange={(e) => setHooks(e.target.value)}
                className="min-h-[100px] dark:bg-gray-900 dark:text-white dark:border-gray-600"
                placeholder="Edit lyrics here..."
              />

              {/* Text Case Options */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Text Case
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTextCase('actual')}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      textCase === 'actual'
                        ? 'bg-[#3e90fd] text-white border-[#3e90fd]'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-[#3e90fd]/50'
                    }`}
                  >
                    Actual
                  </button>
                  <button
                    onClick={() => setTextCase('uppercase')}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      textCase === 'uppercase'
                        ? 'bg-[#3e90fd] text-white border-[#3e90fd]'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-[#3e90fd]/50'
                    }`}
                  >
                    UPPERCASE
                  </button>
                  <button
                    onClick={() => setTextCase('lowercase')}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      textCase === 'lowercase'
                        ? 'bg-[#3e90fd] text-white border-[#3e90fd]'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-[#3e90fd]/50'
                    }`}
                  >
                    lowercase
                  </button>
                </div>
              </div>
            </div>

            {/* Word-by-Word Timestamps */}
            <div className="flex-1 overflow-y-auto p-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Word-by-Word Timestamps</h4>
              <div className="space-y-2">
                {wordTimestamps.map((word, index) => {
                  // Appliquer la transformation de casse pour l'affichage
                  const displayText = textCase === 'uppercase'
                    ? word.text.toUpperCase()
                    : textCase === 'lowercase'
                      ? word.text.toLowerCase()
                      : word.text;

                  return (
                  <div key={index} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-2 rounded-lg">
                    <button
                      onClick={() => {
                        const newTimestamps = [...wordTimestamps];
                        newTimestamps.splice(index, 0, { text: '', start: word.start, end: word.start + 0.1 });
                        setWordTimestamps(newTimestamps);
                      }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>

                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="number"
                        step="0.01"
                        value={word.start.toFixed(2)}
                        onChange={(e) => {
                          const newTimestamps = [...wordTimestamps];
                          newTimestamps[index].start = parseFloat(e.target.value);
                          setWordTimestamps(newTimestamps);
                        }}
                        className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                      <span className="text-gray-400">→</span>
                      <input
                        type="number"
                        step="0.01"
                        value={word.end.toFixed(2)}
                        onChange={(e) => {
                          const newTimestamps = [...wordTimestamps];
                          newTimestamps[index].end = parseFloat(e.target.value);
                          setWordTimestamps(newTimestamps);
                        }}
                        className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                      <input
                        type="text"
                        value={displayText}
                        onChange={(e) => {
                          const newTimestamps = [...wordTimestamps];
                          newTimestamps[index].text = e.target.value;
                          setWordTimestamps(newTimestamps);
                          // Update hooks text
                          setHooks(wordTimestamps.map(w => w.text).join(' '));
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>

                    <button
                      onClick={() => {
                        const newTimestamps = wordTimestamps.filter((_, i) => i !== index);
                        setWordTimestamps(newTimestamps);
                        setHooks(newTimestamps.map(w => w.text).join(' '));
                      }}
                      className="text-red-400 hover:text-red-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>

                    <button
                      onClick={() => {
                        const newTimestamps = [...wordTimestamps];
                        newTimestamps.splice(index + 1, 0, { text: '', start: word.end, end: word.end + 0.1 });
                        setWordTimestamps(newTimestamps);
                      }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
              {lyricsSaveStatus === 'saved' && (
                <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </span>
              )}
              {lyricsSaveStatus !== 'saved' && (
                <div className="flex-1" />
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSaveLyrics}
                  disabled={lyricsSaveStatus === 'saving'}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {lyricsSaveStatus === 'saving' ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      Save
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowTimestampEditor(false)}
                  className="px-4 py-2 bg-[#3e90fd] text-white rounded-lg hover:bg-[#2d7fe3] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

