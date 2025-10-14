"use client";

import { useVideoStore } from "@/store/videoStore";
import { Pencil, Scissors, Trash2, Upload, Play, Pause, X, Clock, Music, Loader } from "lucide-react";
import Image from "next/image";
import { useState, useCallback, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { saveSong, deleteSong, updateSongDetails, getUserSongs, type UserSong } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// Fonction pour formater la durée en minutes:secondes
function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export default function MusicPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { selectedSongs, addSong, removeSong, updateSong, clearSongs, cachedSongs, setCachedSongs } = useVideoStore();
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [editingSong, setEditingSong] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingFiles, setUploadingFiles] = useState<{[filename: string]: boolean}>({});
  const [editForm, setEditForm] = useState({
    artist: '',
    title: '',
    coverUrl: ''
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Vérifier si l'utilisateur est autorisé (plus besoin de vérifier l'email spécifique)
  useEffect(() => {
    // Tout utilisateur authentifié est maintenant autorisé à accéder à cette page
    // Suppression de la vérification d'email spécifique
  }, [user, router]);

  // Load user's songs on mount
  useEffect(() => {
    const loadUserSongs = async () => {
      if (!user || !user.id) return;
      
      try {
        setIsLoading(true);
        
        // Toujours charger les données fraîches depuis Supabase
        const songs = await getUserSongs(user.id);
        clearSongs();
        
        // Ajouter au store
        songs.forEach(song => {
          const songData = {
            id: song.id,
            url: song.url,
            title: song.title,
            artist: song.artist ?? undefined,
            duration: song.duration,
            coverUrl: song.cover_url ?? undefined,
            cover_url: song.cover_url ?? undefined
          };
          addSong(songData);
        });
        
        // Mettre à jour le cache avec les données fraîches
        setCachedSongs(songs);
      } catch (error) {
        console.error('Error loading songs:', error);
        toast.error('Failed to load your songs');
      } finally {
        setIsLoading(false);
      }
    };

    loadUserSongs();
  }, [user, addSong, clearSongs, setCachedSongs]);

  const handlePlay = (songId: string, url: string) => {
    if (isPlaying === songId) {
      audioRef.current?.pause();
      setIsPlaying(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(url);
      audioRef.current.play();
      setIsPlaying(songId);
    }
  };

  const handleEdit = (songId: string) => {
    const song = selectedSongs.find(s => s.id === songId);
    if (song) {
      setEditForm({
        artist: song.artist || '',
        title: song.title || song.id,
        coverUrl: song.coverUrl || ''
      });
      setEditingSong(songId);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingSong || !user || !user.id) return;

    try {
      setIsSaving(true);
      const updatedSong = await updateSongDetails(editingSong, {
        title: editForm.title,
        artist: editForm.artist,
        cover_url: editForm.coverUrl
      });

      updateSong(editingSong, {
        title: editForm.title,
        artist: editForm.artist,
        coverUrl: editForm.coverUrl
      });

      setEditingSong(null);
      toast.success('Song details updated');
    } catch (error) {
      console.error('Error updating song:', error);
      toast.error('Failed to update song details');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (songId: string) => {
    if (!window.confirm('Are you sure you want to delete this song?')) return;

    try {
      if (isPlaying === songId && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(null);
      }

      // Supprimer d'abord du store local pour une réponse immédiate de l'UI
      removeSong(songId);
      
      // Puis supprimer de la base de données
      await deleteSong(songId);
      
      // Mettre à jour le cache après la suppression
      if (user) {
        const songs = await getUserSongs(user.id);
        setCachedSongs(songs);
      }
      
      toast.success('Song deleted successfully');
    } catch (error) {
      console.error('Error deleting song:', error);
      toast.error('Failed to delete song');
      
      // Si l'opération échoue, recharger les données pour restaurer l'état correct
      if (user) {
        const songs = await getUserSongs(user.id);
        clearSongs();
        songs.forEach(song => {
          addSong({
            id: song.id,
            url: song.url,
            title: song.title,
            artist: song.artist ?? undefined,
            duration: song.duration,
            coverUrl: song.cover_url ?? undefined,
          });
        });
        setCachedSongs(songs);
      }
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user || !user.id) {
      toast.error('Please sign in to upload songs');
      return;
    }

    // Initialiser l'état de chargement pour chaque fichier
    const newUploadingFiles = {...uploadingFiles};
    acceptedFiles.forEach(file => {
      newUploadingFiles[file.name] = true;
    });
    setUploadingFiles(newUploadingFiles);

    for (const file of acceptedFiles) {
      try {
        // Parse artist and title from filename
        const filename = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
        const [artist = "", title = filename] = filename.split(" - ");
        
        // Créer un FormData pour l'analyse
        const formData = new FormData();
        formData.append('file', file);
        
        // Utiliser notre endpoint API pour analyser le fichier audio
        const response = await fetch('/api/analyze-audio', {
          method: 'POST',
          body: formData,
        });
        
        const result = await response.json();
        
        if (!result.success) {
          toast.error(`Failed to analyze ${file.name}: ${result.error}`);
          // Marquer ce fichier comme terminé (avec erreur)
          setUploadingFiles(prev => ({...prev, [file.name]: false}));
          continue;
        }
        
        const duration = result.duration;
        
        if (duration > 60) {
          toast.error(`${file.name} exceeds the 1-minute limit (${Math.round(duration)} seconds)`);
          // Marquer ce fichier comme terminé (avec erreur)
          setUploadingFiles(prev => ({...prev, [file.name]: false}));
          continue;
        }
        
        // Vérifier la taille du fichier avant de continuer
        const fileSizeMB = file.size / (1024 * 1024);
        if (fileSizeMB > 50) {
          toast.error(`${file.name} is too large (${fileSizeMB.toFixed(2)} MB). Maximum file size is 50 MB.`);
          // Marquer ce fichier comme terminé (avec erreur)
          setUploadingFiles(prev => ({...prev, [file.name]: false}));
          continue;
        }
        
        // Créer un dataURL pour stocker l'audio
        const reader = new FileReader();
        reader.onload = async () => {
          const url = reader.result as string;
          
          try {
            // Save to Supabase
            const savedSong = await saveSong({
              user_id: user.id,
              title: title.trim(),
              artist: artist.trim(),
              duration: duration,
              url: url,
              cover_url: null
            });

            if (!savedSong) {
              throw new Error('Failed to save song data');
            }

            // Add to local store
            const songData = {
              id: savedSong.id,
              url: savedSong.url,
              title: savedSong.title,
              artist: savedSong.artist ?? undefined,
              duration: savedSong.duration,
              coverUrl: savedSong.cover_url ?? undefined,
              cover_url: savedSong.cover_url ?? undefined
            };
            addSong(songData);

            toast.success(`${file.name} uploaded successfully (${Math.round(duration)} seconds)`);
          } catch (error) {
            console.error('Error saving song:', error);
            if (error instanceof Error) {
              toast.error(`Failed to upload ${file.name}: ${error.message}`);
            } else {
              toast.error(`Failed to upload ${file.name}`);
            }
          } finally {
            // Marquer ce fichier comme terminé (avec succès ou erreur)
            setUploadingFiles(prev => ({...prev, [file.name]: false}));
          }
        };
        
        reader.onerror = () => {
          toast.error(`Failed to read file: ${file.name}`);
          // Marquer ce fichier comme terminé (avec erreur)
          setUploadingFiles(prev => ({...prev, [file.name]: false}));
        };
        
        reader.readAsDataURL(file);
        
      } catch (error) {
        console.error('Error processing file:', error);
        if (error instanceof Error) {
          toast.error(`Failed to process ${file.name}: ${error.message}`);
        } else {
          toast.error(`Failed to process ${file.name}`);
        }
        // Marquer ce fichier comme terminé (avec erreur)
        setUploadingFiles(prev => ({...prev, [file.name]: false}));
      }
    }
  }, [user, addSong, uploadingFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/wav': ['.wav'],
      'audio/mpeg': ['.mp3'],
    },
    multiple: true
  });

  const onEditCoverDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        setEditForm(prev => ({ ...prev, coverUrl: url }));
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps: getCoverDropProps, getInputProps: getCoverInputProps } = useDropzone({
    onDrop: onEditCoverDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    },
    multiple: false
  });

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f3f4f0' }}>
      <div className="p-4 xl:p-6">
        <div className="pt-8 xl:pt-8">
          <h1 className="text-2xl font-semibold mb-6" style={{ color: '#333333' }}>Music</h1>
        
          <div className="flex flex-col items-center">
        <div className="flex flex-col space-y-6 mb-8 w-full max-w-4xl">
          <div className="flex items-center justify-start gap-4">
            <div {...getRootProps()} className="relative cursor-pointer">
              <input {...getInputProps()} />
              <button 
                className={`flex items-center justify-center gap-2 bg-[#f44e17] text-white rounded-xl py-2 px-4 hover:bg-[#f44e17]/90 transition-colors text-sm dark:bg-[#f44e17] dark:hover:bg-[#f44e17]/90 dark:text-white ${
                  !user ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={!user}
              >
                <Upload className="w-4 h-4" />
                <span>Upload Music</span>
              </button>
              {isDragActive && (
                <div className="absolute inset-0 -m-4 rounded-xl bg-black/90 flex items-center justify-center text-white text-sm">
                  Drop your audio files here (1 min max)
                </div>
              )}
            </div>
            
            {/* Informations */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground dark:text-gray-300">
              <Clock className="w-4 h-4" />
              <p>1 minute max</p>
            </div>
            <div className="h-4 w-px bg-gray-300 dark:bg-gray-700"></div>
            <p className="text-sm text-muted-foreground dark:text-gray-300">{selectedSongs.length} / 50 music files used</p>
          </div>
        </div>

        {/* Contenu principal */}
        <div className="w-full max-w-4xl">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-500 mx-auto mb-4"></div>
              <p className="text-black/60 dark:text-[#fafafa]">Loading your songs...</p>
            </div>
          ) : selectedSongs.length === 0 && Object.values(uploadingFiles).filter(Boolean).length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="max-w-md">
                <div className="mb-6">
                  <Music className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500" />
                </div>
                <h2 className="text-2xl font-semibold mb-4 dark:text-white">No songs yet</h2>
                <p className="text-muted-foreground dark:text-gray-300">
                  Upload your first song to get started
                  {!user && (
                    <span className="block mt-2">Please sign in to upload and save your songs.</span>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Affichage des fichiers en cours de téléchargement */}
              {Object.entries(uploadingFiles)
                .filter(([_, isUploading]) => isUploading)
                .map(([filename]) => (
                  <div key={filename} className="bg-white dark:bg-[#0a0a0c] rounded-xl p-4 mb-4 flex items-center gap-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-500"></div>
                    <div>
                      <p className="font-medium dark:text-white">{filename}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Uploading and processing...</p>
                    </div>
                  </div>
                ))}
                
              {/* Grille de musique */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {selectedSongs.map((song) => (
                  <div key={song.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow rounded-lg overflow-hidden">
                    <div className="group relative aspect-square rounded-t-lg bg-[#1a1a1a] overflow-hidden">
                      {song.coverUrl || song.cover_url ? (
                        <>
                          <Image
                            src={song.coverUrl || song.cover_url || ''}
                            alt={`${song.title || song.id} cover`}
                            fill
                            className="object-cover"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(song.id);
                              }}
                              className="absolute top-2 left-2 w-8 h-8 rounded-full bg-[#3e90fd] hover:bg-[#3e90fd]/90 transition-colors flex items-center justify-center text-white z-20"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(song.id);
                              }}
                              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center text-white z-20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlay(song.id, song.url);
                                }}
                                className="w-12 h-12 rounded-full bg-white/30 hover:bg-white/50 transition-colors flex items-center justify-center text-white pointer-events-auto"
                              >
                                {isPlaying === song.id ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Music className="h-12 w-12 text-gray-400" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(song.id);
                              }}
                              className="absolute top-2 left-2 w-8 h-8 rounded-full bg-[#3e90fd] hover:bg-[#3e90fd]/90 transition-colors flex items-center justify-center text-white z-20"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(song.id);
                              }}
                              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center text-white z-20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlay(song.id, song.url);
                                }}
                                className="w-12 h-12 rounded-full bg-white/30 hover:bg-white/50 transition-colors flex items-center justify-center text-white pointer-events-auto"
                              >
                                {isPlaying === song.id ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-2 bg-white rounded-b-lg">
                      <p className="text-base font-medium text-gray-900 truncate text-center tracking-normal">{song.title || 'Untitled'}</p>
                      <p className="text-sm font-medium text-gray-600 truncate text-center tracking-normal">{song.artist || 'Unknown artist'}</p>
                      <p className="text-sm font-medium text-gray-500 mt-1 text-center tracking-normal">{formatDuration(song.duration)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal d'édition */}
      {editingSong && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0a0a0c] rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold dark:text-white">Edit Song</h3>
              <button 
                onClick={() => setEditingSong(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3e90fd] bg-white dark:bg-[#18181A] text-gray-900 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Artist</label>
                <input
                  type="text"
                  value={editForm.artist}
                  onChange={(e) => setEditForm({...editForm, artist: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3e90fd] bg-white dark:bg-[#18181A] text-gray-900 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cover Image</label>
                <div 
                  {...getCoverDropProps()} 
                  className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-[#18181A] transition-colors"
                >
                  <input {...getCoverInputProps()} />
                  
                  {editForm.coverUrl ? (
                    <div className="relative w-32 h-32 mx-auto">
                      <Image
                        src={editForm.coverUrl}
                        alt="Cover preview"
                        fill
                        className="object-cover rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="text-gray-500 dark:text-gray-400">
                      <Upload className="w-12 h-12 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                      <p>Drop an image here or click to browse</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setEditingSong(null)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#18181A] transition-colors"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="px-4 py-2 bg-[#3e90fd] text-white rounded-lg hover:bg-[#3e90fd]/90 transition-colors flex items-center justify-center"
                >
                  {isSaving ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}