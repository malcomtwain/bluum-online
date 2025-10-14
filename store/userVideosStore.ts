import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserVideo {
  id: string;
  path: string;
  fileName: string;
  createdAt: number; // timestamp
  expiresAt: number; // timestamp
  isTemporary?: boolean; // indication que la vidéo est temporaire
  selected?: boolean; // pour la sélection multiple
}

interface UserVideosStore {
  videos: UserVideo[];
  selectedVideos: string[]; // IDs des vidéos sélectionnées
  addVideo: (path: string, expiresAt?: number) => void;
  removeVideo: (id: string) => void;
  clearExpiredVideos: () => void;
  triggerCleanup: () => Promise<void>;
  
  // Nouvelles fonctions pour la sélection multiple
  toggleVideoSelection: (id: string) => void;
  selectAllVideos: () => void;
  deselectAllVideos: () => void;
  removeSelectedVideos: () => void;
  getSelectedVideoPaths: () => { path: string; fileName: string }[]; // Pour le téléchargement en masse
}

// Durée de conservation des vidéos: 15 minutes
const EXPIRATION_TIME = 15 * 60 * 1000; // 15 minutes en millisecondes

export const useUserVideosStore = create<UserVideosStore>()(
  persist(
    (set, get) => ({
      videos: [],
      selectedVideos: [],
      
      addVideo: (path: string, expiresAt?: number) => {
        const now = Date.now();
        
        // Extraire le nom de fichier en fonction du type d'URL
        let fileName = '';
        const isTemporary = path.includes('/temp-videos/');
        
        // Extraire le nom de fichier depuis le path
        try {
          const urlParts = path.split('/');
          fileName = urlParts[urlParts.length - 1]; // Prendre le dernier segment
          
          // Si le nom n'est pas extrait, utiliser un nom par défaut
          if (!fileName || fileName === '') {
            fileName = `video_${now}.mp4`;
          }
        } catch (error) {
          // En cas d'erreur, utiliser un nom générique
          fileName = `video_${now}.mp4`;
        }
        
        // Vérifier si la vidéo existe déjà
        const existingVideo = get().videos.find(v => v.path === path);
        if (existingVideo) {
          // Mettre à jour la date d'expiration si la vidéo existe déjà
          set(state => ({
            videos: state.videos.map(video => 
              video.id === existingVideo.id 
                ? { ...video, expiresAt: expiresAt || now + EXPIRATION_TIME }
                : video
            )
          }));
          return;
        }
        
        // Ajouter une nouvelle vidéo
        const newVideo: UserVideo = {
          id: Math.random().toString(36).substring(2, 15),
          path,
          fileName,
          createdAt: now,
          expiresAt: expiresAt || now + EXPIRATION_TIME,
          isTemporary,
          selected: false
        };
        
        set(state => ({
          videos: [...state.videos, newVideo]
        }));
        
        // Si c'est une nouvelle vidéo temporaire, programmer automatiquement un nettoyage
        if (isTemporary) {
          // Déclencher un nettoyage après la durée d'expiration
          setTimeout(() => {
            get().triggerCleanup();
          }, EXPIRATION_TIME + 1000); // +1s pour être sûr
        }
      },
      
      removeVideo: (id: string) => {
        // Supprimer également de la liste des sélectionnés
        set(state => ({
          videos: state.videos.filter(video => video.id !== id),
          selectedVideos: state.selectedVideos.filter(selectedId => selectedId !== id)
        }));
      },
      
      clearExpiredVideos: () => {
        const now = Date.now();
        set(state => {
          // Filtrer les vidéos non expirées
          const updatedVideos = state.videos.filter(video => video.expiresAt > now);
          // Mettre à jour la liste des vidéos sélectionnées
          const updatedSelectedVideos = state.selectedVideos.filter(
            selectedId => updatedVideos.some(video => video.id === selectedId)
          );
          
          return {
            videos: updatedVideos,
            selectedVideos: updatedSelectedVideos
          };
        });
      },
      
      triggerCleanup: async () => {
        try {
          // Appeler l'API de nettoyage
          const response = await fetch('/api/cleanup-temp');
          
          // Nettoyer également le store local
          get().clearExpiredVideos();
          
          console.log('Nettoyage des fichiers temporaires déclenché');
          return await response.json();
        } catch (error) {
          console.error('Erreur lors du nettoyage:', error);
          // Nettoyer quand même le store local
          get().clearExpiredVideos();
        }
      },
      
      // Nouvelles implémentations pour la sélection multiple
      toggleVideoSelection: (id: string) => {
        set(state => {
          const isSelected = state.selectedVideos.includes(id);
          
          if (isSelected) {
            // Désélectionner la vidéo
            return {
              selectedVideos: state.selectedVideos.filter(selectedId => selectedId !== id)
            };
          } else {
            // Sélectionner la vidéo
            return {
              selectedVideos: [...state.selectedVideos, id]
            };
          }
        });
      },
      
      selectAllVideos: () => {
        set(state => ({
          selectedVideos: state.videos.map(video => video.id)
        }));
      },
      
      deselectAllVideos: () => {
        set({ selectedVideos: [] });
      },
      
      removeSelectedVideos: () => {
        set(state => ({
          videos: state.videos.filter(video => !state.selectedVideos.includes(video.id)),
          selectedVideos: []
        }));
      },
      
      getSelectedVideoPaths: () => {
        const { videos, selectedVideos } = get();
        return videos
          .filter(video => selectedVideos.includes(video.id))
          .map(video => ({ path: video.path, fileName: video.fileName }));
      }
    }),
    {
      name: 'bluum-user-videos',
      partialize: (state) => ({ videos: state.videos, selectedVideos: state.selectedVideos }),
    }
  )
);

// Fonction pour nettoyer automatiquement les vidéos expirées
export const initUserVideosCleanup = () => {
  // Nettoyer les vidéos expirées au démarrage
  useUserVideosStore.getState().clearExpiredVideos();
  
  // Déclencher une fois le nettoyage des fichiers temporaires au démarrage
  useUserVideosStore.getState().triggerCleanup();
  
  // Configurer un intervalle pour nettoyer régulièrement
  const intervalId = setInterval(() => {
    useUserVideosStore.getState().clearExpiredVideos();
    // Déclencher également le nettoyage des fichiers sur le serveur
    useUserVideosStore.getState().triggerCleanup();
  }, 5 * 60 * 1000); // Vérifier toutes les 5 minutes
  
  return () => clearInterval(intervalId);
}; 