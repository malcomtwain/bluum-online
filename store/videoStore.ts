import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-hot-toast';
import { UserSong } from '@/lib/supabase';

interface Position {
  x: number;
  y: number;
  scale: number;
}

interface MediaFile {
  id: string;
  type: 'video' | 'image';
  url: string;
  duration: number;
  persisted?: boolean;
}

interface Song {
  id: string;
  url: string;
  coverUrl?: string | null;
  artist?: string | null;
  title?: string;
  duration?: number;
  user_id?: string;
  cover_url?: string | null;
  created_at?: string;
}

interface Hook {
  id: string;
  text: string;
  position: {
    x: number;
    y: number;
  };
}

interface GeneratedImage {
  id: string;
  url: string;
  hook: string;
  font: 'withBackground' | 'withBackgroundBlack' | 'normal';
}

interface GeneratedVideo {
  id: string;
  url: string;
  template: string;
  media: string;
  hook: string;
  font: 'withBackground' | 'withBackgroundBlack' | 'normal';
}

interface VideoStore {
  // Template state
  templateImage: string | null;
  templatePosition: Position;
  templateDuration: number;
  setTemplateImage: (url: string) => void;
  setTemplatePosition: (position: Position) => void;
  setTemplateDuration: (duration: number) => void;

  // Media files state
  mediaFiles: MediaFile[];
  addMediaFile: (file: Omit<MediaFile, 'id'>) => void;
  removeMediaFile: (id: string) => void;
  removeMediaFiles: (ids: string[]) => void;

  // Music state
  selectedSongs: Song[];
  cachedSongs: UserSong[];
  addSong: (song: Partial<Song> & { url: string }) => void;
  removeSong: (id: string) => void;
  updateSong: (id: string, updates: Partial<Song>) => void;
  clearSongs: () => void;
  setCachedSongs: (songs: UserSong[]) => void;

  // Hooks state
  hooks: Hook[];
  selectedFonts: {
    withBackground: boolean;
    withBackgroundBlack: boolean;
    normal: boolean;
  };
  addHook: (hook: Omit<Hook, 'id'>) => void;
  removeHook: (id: string) => void;
  updateHookPosition: (id: string, position: { x: number; y: number }) => void;
  toggleFont: (font: 'withBackground' | 'withBackgroundBlack' | 'normal') => void;

  // Generated content state
  generatedImages: GeneratedImage[];
  generatedVideos: GeneratedVideo[];
  addGeneratedImage: (image: Omit<GeneratedImage, 'id'>) => void;
  addGeneratedVideo: (video: Omit<GeneratedVideo, 'id'>) => void;
  clearGeneratedContent: () => void;

  // Reset state
  reset: () => void;
}

const initialState = {
  templateImage: null,
  templatePosition: { x: 0, y: 0, scale: 1 },
  templateDuration: 3,
  mediaFiles: [],
  selectedSongs: [],
  cachedSongs: [],
  hooks: [],
  selectedFonts: {
    withBackground: true,
    withBackgroundBlack: false,
    normal: false,
  },
  generatedImages: [],
  generatedVideos: [],
};

const MAX_FILES = 10; // Maximum 10 fichiers au total (vidéos ou images)
const MAX_URL_LENGTH = 20 * 1024 * 1024; // 20MB maximum par fichier

// Helper function to safely store data in localStorage
const safeSetItem = (key: string, value: any) => {
  try {
    // Clean up the data before storing
    const cleanData = {
      ...value,
      mediaFiles: value.mediaFiles.map((file: MediaFile) => ({
        ...file,
        // If URL is too long, mark it as not persisted
        persisted: file.url.length <= MAX_URL_LENGTH,
        // Only store URL if it's not too long
        url: file.url.length > MAX_URL_LENGTH ? null : file.url
      }))
    };

    localStorage.setItem(key, JSON.stringify(cleanData));
  } catch (error) {
    if (error instanceof Error) {
      console.warn('Storage failed:', error.message);
      
      // If quota exceeded, try to clear some space
      if (error.name === 'QuotaExceededError') {
        try {
          // Remove all stored URLs to save space
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (data.mediaFiles) {
            data.mediaFiles = data.mediaFiles.map((file: MediaFile) => ({
              ...file,
              persisted: false,
              url: null
            }));
            localStorage.setItem(key, JSON.stringify(data));
          }
        } catch (e) {
          console.error('Failed to clean up storage:', e);
        }
      }
    }
  }
};

// Helper to handle media files with persistence info
interface PersistedMediaFile extends MediaFile {
  persisted?: boolean;
}

export const useVideoStore = create<VideoStore>((set) => {
  // Load initial state from localStorage if available
  const savedState = typeof window !== 'undefined' ? localStorage.getItem('bluum-storage') : null;
  const persistedState = savedState ? { ...initialState, ...JSON.parse(savedState) } : initialState;

  // Clean up any null URLs from persisted state
  if (persistedState.mediaFiles) {
    persistedState.mediaFiles = persistedState.mediaFiles
      .filter((file: PersistedMediaFile) => file.url !== null && file.url !== '')
      .map((file: PersistedMediaFile) => ({
        ...file,
        persisted: true
      }));
  }

  const setState = (newState: Partial<VideoStore>) => {
    set((state) => {
      const updatedState = { ...state, ...newState };
      if (typeof window !== 'undefined') {
        safeSetItem('bluum-storage', {
          mediaFiles: updatedState.mediaFiles,
          templateImage: updatedState.templateImage,
          templatePosition: updatedState.templatePosition,
          templateDuration: updatedState.templateDuration,
          hooks: updatedState.hooks,
          selectedFonts: updatedState.selectedFonts,
          generatedImages: updatedState.generatedImages,
          generatedVideos: updatedState.generatedVideos
        });
      }
      return updatedState;
    });
  };

  return {
    ...persistedState,

    setTemplateImage: (url: string) => setState({ templateImage: url }),
    
    setTemplatePosition: (position: Position) => setState({ templatePosition: position }),
    
    setTemplateDuration: (duration: number) => setState({ templateDuration: duration }),

    addMediaFile: (file: Omit<MediaFile, 'id'>) => {
      const state = useVideoStore.getState();
      
      // Vérifier le nombre total de fichiers
      const totalFiles = state.mediaFiles?.length || 0;
      if (totalFiles >= MAX_FILES) {
        toast.error(`Vous ne pouvez pas uploader plus de ${MAX_FILES} fichiers au total`);
        return;
      }

      // Vérifier la taille du fichier
      if (file.url.length > MAX_URL_LENGTH) {
        toast.error(`Le fichier est trop grand. Maximum 20MB par fichier.`);
        return;
      }

      setState({
        mediaFiles: [...(state.mediaFiles || []), { 
          ...file, 
          id: uuidv4(),
          persisted: true // Toujours true car on vérifie la taille avant
        }],
      });
    },

    removeMediaFile: (id: string) => {
      const state = useVideoStore.getState();
      setState({
        mediaFiles: state.mediaFiles?.filter((file) => file.id !== id) || [],
      });
    },

    removeMediaFiles: (ids: string[]) => {
      const state = useVideoStore.getState();
      setState({
        mediaFiles: state.mediaFiles?.filter((file) => !ids.includes(file.id)) || [],
      });
    },

    addSong: (song: Partial<Song> & { url: string }) => {
      const state = useVideoStore.getState();
      setState({
        selectedSongs: [...(state.selectedSongs || []), { ...song, id: song.id || uuidv4() }],
      });
    },

    removeSong: (id: string) => {
      const state = useVideoStore.getState();
      setState({
        selectedSongs: state.selectedSongs?.filter((song) => song.id !== id) || [],
      });
    },

    updateSong: (id: string, updates: Partial<Song>) => {
      const state = useVideoStore.getState();
      setState({
        selectedSongs: state.selectedSongs?.map((song) =>
          song.id === id ? { ...song, ...updates } : song
        ) || [],
      });
    },

    clearSongs: () => setState({ selectedSongs: [] }),

    setCachedSongs: (songs: UserSong[]) => setState({ cachedSongs: songs }),

    addHook: (hook: Omit<Hook, 'id'>) => {
      const state = useVideoStore.getState();
      setState({
        hooks: [...(state.hooks || []), { ...hook, id: uuidv4() }],
      });
    },

    removeHook: (id: string) => {
      const state = useVideoStore.getState();
      setState({
        hooks: state.hooks?.filter((hook) => hook.id !== id) || [],
      });
    },

    updateHookPosition: (id: string, position: { x: number; y: number }) => {
      const state = useVideoStore.getState();
      setState({
        hooks: state.hooks?.map((hook) =>
          hook.id === id ? { ...hook, position } : hook
        ) || [],
      });
    },

    toggleFont: (font: 'withBackground' | 'withBackgroundBlack' | 'normal') => {
      const state = useVideoStore.getState();
      setState({
        selectedFonts: {
          ...(state.selectedFonts || { withBackground: true, withBackgroundBlack: false, normal: false }),
          [font]: !state.selectedFonts?.[font],
        },
      });
    },

    addGeneratedImage: (image: Omit<GeneratedImage, 'id'>) => {
      const state = useVideoStore.getState();
      setState({
        generatedImages: [...(state.generatedImages || []), { ...image, id: uuidv4() }],
      });
    },

    addGeneratedVideo: (video: Omit<GeneratedVideo, 'id'>) => {
      const state = useVideoStore.getState();
      setState({
        generatedVideos: [...(state.generatedVideos || []), { ...video, id: uuidv4() }],
      });
    },

    clearGeneratedContent: () => setState({
      generatedImages: [],
      generatedVideos: [],
    }),

    reset: () => setState(initialState),
  };
}); 