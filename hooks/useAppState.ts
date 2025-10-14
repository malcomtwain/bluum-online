import { create } from 'zustand';

interface AppState {
  // Project
  currentProjectId: string | null;
  projectName: string;
  
  // Part 1
  templateImage: string | null;
  templatePosition: { x: number; y: number; scale: number };
  templateDuration: number;
  
  // Part 2
  mediaFiles: { id: string; type: 'image' | 'video'; url: string; duration: number }[];
  
  // Music
  selectedSongs: { id: string; url: string }[];
  
  // Hooks
  hooks: { id: string; text: string; position: { x: number; y: number } }[];
  selectedFonts: { withBackground: boolean; withBackgroundBlack: boolean; normal: boolean };
  
  // Generated content
  generatedImages: { id: string; url: string; hook: string; font: string }[];
  generatedVideos: { id: string; url: string; template: string; media: string; hook: string; font: string }[];
  
  // Actions
  setCurrentProject: (projectId: string, name: string) => void;
  setTemplateImage: (url: string) => void;
  setTemplatePosition: (position: { x: number; y: number; scale: number }) => void;
  setTemplateDuration: (duration: number) => void;
  addMediaFile: (file: { type: 'image' | 'video'; url: string; duration: number }) => void;
  removeMediaFile: (id: string) => void;
  addSong: (song: { url: string }) => void;
  removeSong: (id: string) => void;
  addHook: (hook: { text: string; position: { x: number; y: number } }) => void;
  removeHook: (id: string) => void;
  toggleFont: (font: 'withBackground' | 'withBackgroundBlack' | 'normal') => void;
  addGeneratedImage: (image: { url: string; hook: string; font: string }) => void;
  addGeneratedVideo: (video: { url: string; template: string; media: string; hook: string; font: string }) => void;
  reset: () => void;
}

const initialState = {
  currentProjectId: null,
  projectName: '',
  templateImage: null,
  templatePosition: { x: 0, y: 0, scale: 1 },
  templateDuration: 3,
  mediaFiles: [],
  selectedSongs: [],
  hooks: [],
  selectedFonts: { withBackground: true, withBackgroundBlack: false, normal: false },
  generatedImages: [],
  generatedVideos: [],
};

export const useAppState = create<AppState>((set, get) => {
  return {
    ...initialState,

    setCurrentProject: (projectId: string, name: string) => {
      set({ currentProjectId: projectId, projectName: name });
    },

    setTemplateImage: (url) => {
      set({ templateImage: url });
    },

    setTemplatePosition: (position) => {
      set({ templatePosition: position });
    },

    setTemplateDuration: (duration) => {
      set({ templateDuration: duration });
    },

    addMediaFile: (file) => {
      set((state) => ({
        mediaFiles: [...state.mediaFiles, { id: crypto.randomUUID(), ...file }]
      }));
    },

    removeMediaFile: (id) => {
      set((state) => ({
        mediaFiles: state.mediaFiles.filter(file => file.id !== id)
      }));
    },

    addSong: (song) => {
      set((state) => ({
        selectedSongs: [...state.selectedSongs, { id: crypto.randomUUID(), ...song }]
      }));
    },

    removeSong: (id) => {
      set((state) => ({
        selectedSongs: state.selectedSongs.filter(song => song.id !== id)
      }));
    },

    addHook: (hook) => {
      set((state) => ({
        hooks: [...state.hooks, { id: crypto.randomUUID(), ...hook }]
      }));
    },

    removeHook: (id) => {
      set((state) => ({
        hooks: state.hooks.filter(hook => hook.id !== id)
      }));
    },

    toggleFont: (font) => {
      set((state) => ({
        selectedFonts: {
          ...state.selectedFonts,
          [font]: !state.selectedFonts[font]
        }
      }));
    },

    addGeneratedImage: (image) => {
      set((state) => ({
        generatedImages: [...state.generatedImages, { id: crypto.randomUUID(), ...image }]
      }));
    },

    addGeneratedVideo: (video) => {
      set((state) => ({
        generatedVideos: [...state.generatedVideos, { id: crypto.randomUUID(), ...video }]
      }));
    },

    reset: () => {
      set(initialState);
    },
  };
}); 