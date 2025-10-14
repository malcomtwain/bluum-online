"use client";

import React, { useState, useEffect } from 'react';
import { 
  Plus, HelpCircle, Video, Download, Trash2, X, CheckSquare, 
  Square, DownloadCloud, Loader, Share2, FolderPlus, Move,
  Folder, Grid, Eye, Filter, SortDesc, Calendar, Image
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { downloadVideosAsZip } from '@/utils/zipDownloader';
import { TikTokPublishModal } from '@/components/TikTokPublishModal';
import { 
  getUserGeneratedVideos, 
  deleteGeneratedVideo, 
  deleteGeneratedVideos,
  type GeneratedVideo
} from '@/lib/generated-media-db';
import {
  getUserCollections,
  moveVideoToCollection,
  type MediaCollection
} from '@/lib/media-collections';

type MediaItem = GeneratedVideo & { 
  media_type: 'video'
};

export default function GeneratedVideosPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  // États principaux
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [allMedia, setAllMedia] = useState<MediaItem[]>([]);
  const [filteredMedia, setFilteredMedia] = useState<MediaItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [collections, setCollections] = useState<MediaCollection[]>([]);
  
  // États UI
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingItem, setDownloadingItem] = useState<string | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [tiktokModalOpen, setTiktokModalOpen] = useState(false);
  const [selectedVideoForTiktok, setSelectedVideoForTiktok] = useState<{ path: string; id: string } | null>(null);
  
  // Filtres et tri
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');
  const [showOnlyWithoutCollection, setShowOnlyWithoutCollection] = useState(true);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 18; // 3 lignes avec 6 colonnes = 18 items par page
  const totalPages = Math.ceil(filteredMedia.length / itemsPerPage);

  // Charger toutes les données au démarrage - une seule fois
  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) {
        setIsInitialized(true);
        return;
      }
      
      try {
        // Charger SEULEMENT les vidéos (pas les slideshows)
        const [allVideos, userCollections] = await Promise.all([
          getUserGeneratedVideos(user.id, false), // false = charger TOUT
          getUserCollections(user.id)
        ]);
        
        setVideos(allVideos);
        setCollections(userCollections);
        
        // Seulement les vidéos, pas les slideshows
        const videoMedia: MediaItem[] = [
          ...allVideos.map(v => ({ ...v, media_type: 'video' as const }))
        ];
        
        setAllMedia(videoMedia);
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Failed to load media');
      } finally {
        setIsInitialized(true);
      }
    };

    loadData();
  }, [user?.id]); // Retirer showOnlyWithoutCollection des dépendances

  // Appliquer filtres et tri
  useEffect(() => {
    let filtered = [...allMedia];
    
    // Filtrer par collection
    if (showOnlyWithoutCollection) {
      filtered = filtered.filter(item => !item.collection_id);
    }
    
    // Trier
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else {
        return (a.file_name || '').localeCompare(b.file_name || '');
      }
    });
    
    setFilteredMedia(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [allMedia, sortBy, showOnlyWithoutCollection]);

  // Gestion de la sélection
  const toggleItemSelection = (id: string) => {
    setSelectedItems(prev => {
      if (prev.includes(id)) {
        return prev.filter(selectedId => selectedId !== id);
      } else {
        return [...prev, id];
      }
    });
  };
  
  const selectAll = () => {
    setSelectedItems(filteredMedia.map(item => item.id));
  };
  
  const deselectAll = () => {
    setSelectedItems([]);
  };

  // Fonction pour télécharger un média
  const handleDownloadMedia = async (item: MediaItem) => {
    try {
      setDownloadingItem(item.id);
      const mediaUrl = item.file_url;
      const response = await fetch(mediaUrl);
      
      if (!response.ok) throw new Error('Failed to download');
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = item.file_name || `${item.media_type}-${Date.now()}.${item.media_type === 'video' ? 'mp4' : 'zip'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      
      toast.success(`${item.media_type === 'video' ? 'Video' : 'Slideshow'} downloaded!`);
    } catch (error) {
      console.error('Error downloading:', error);
      toast.error('Failed to download');
    } finally {
      setDownloadingItem(null);
    }
  };

  // Télécharger la sélection
  const handleDownloadSelected = async () => {
    if (selectedItems.length === 0) {
      toast.error('No items selected');
      return;
    }
    
    setIsDownloading(true);
    try {
      const selectedMedia = filteredMedia.filter(item => selectedItems.includes(item.id));
      const paths = selectedMedia.map(item => ({
        path: item.file_url,
        fileName: item.file_name || `${item.media_type}-${item.id}`
      }));
      
      await downloadVideosAsZip(paths);
      toast.success(`${selectedItems.length} items downloaded!`);
    } catch (error) {
      console.error('Error downloading:', error);
      toast.error('Failed to download');
    } finally {
      setIsDownloading(false);
    }
  };

  // Supprimer une vidéo
  const handleDeleteMedia = async (item: MediaItem) => {
    try {
      await deleteGeneratedVideo(item.id);
      setVideos(prev => prev.filter(v => v.id !== item.id));
      setAllMedia(prev => prev.filter(m => m.id !== item.id));
      toast.success('Video deleted');
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete');
    }
  };

  // Supprimer la sélection
  const handleDeleteSelected = async () => {
    if (selectedItems.length === 0) return;
    
    try {
      const selectedMedia = filteredMedia.filter(item => selectedItems.includes(item.id));
      const videoIds = selectedMedia.map(item => item.id);
      
      await deleteGeneratedVideos(videoIds);
      
      setAllMedia(prev => prev.filter(item => !selectedItems.includes(item.id)));
      setSelectedItems([]);
      toast.success(`${selectedItems.length} videos deleted`);
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete');
    }
  };

  // Déplacer vers une collection
  const handleMoveToCollection = async (collectionId: string | null) => {
    if (selectedItems.length === 0) {
      toast.error('No items selected');
      return;
    }

    try {
      const selectedMedia = filteredMedia.filter(item => selectedItems.includes(item.id));
      const promises = selectedMedia.map(item => {
        return moveVideoToCollection(item.id, collectionId);
      });
      
      await Promise.all(promises);
      
      toast.success(`Moved ${selectedItems.length} items to collection`);
      setSelectedItems([]);
      setShowMoveModal(false);
      
      // Recharger les données
      if (user?.id) {
        const allVideos = await getUserGeneratedVideos(user.id, false); // Toujours charger TOUT
        
        setVideos(allVideos);
        
        const videoMedia: MediaItem[] = [
          ...allVideos.map(v => ({ ...v, media_type: 'video' as const }))
        ];
        
        setAllMedia(videoMedia);
      }
    } catch (error) {
      console.error('Error moving items:', error);
      toast.error('Failed to move items');
    }
  };

  // Affichage du chargement
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-500"></div>
      </div>
    );
  }

  const currentItems = filteredMedia.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f3f4f0' }}>
      <div className="p-4 xl:p-6">
        <div className="pt-4 xl:pt-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-semibold" style={{ color: '#333333' }}>
                My Generated Videos
              </h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowOnlyWithoutCollection(!showOnlyWithoutCollection)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors border ${
                    showOnlyWithoutCollection 
                      ? 'bg-blue-100 text-blue-700 border-blue-200' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {showOnlyWithoutCollection ? 'Without Collection' : 'All Media'}
                </button>
                
                {/* Sort */}
                <button
                  onClick={() => setSortBy(sortBy === 'date' ? 'name' : 'date')}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 bg-white"
                >
                  <SortDesc size={14} />
                  {sortBy === 'date' ? 'Date' : 'Name'}
                </button>

                {/* Select All */}
                {filteredMedia.length > 0 && (
                  <button
                    onClick={() => selectedItems.length === filteredMedia.length ? deselectAll() : selectAll()}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    {selectedItems.length === filteredMedia.length ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    {selectedItems.length === filteredMedia.length ? 'Deselect' : 'Select'} All
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Action buttons when items selected */}
              {selectedItems.length > 0 && (
                <>
                  <button
                    onClick={handleDownloadSelected}
                    disabled={isDownloading}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {isDownloading ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <DownloadCloud className="w-4 h-4" />
                    )}
                    Download ({selectedItems.length})
                  </button>

                  <button
                    onClick={() => setShowMoveModal(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700"
                  >
                    <Move className="w-4 h-4" />
                    Move ({selectedItems.length})
                  </button>

                  <button
                    onClick={handleDeleteSelected}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete ({selectedItems.length})
                  </button>
                </>
              )}
              
              <button 
                onClick={() => router.push('/create')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-white"
                style={{ backgroundColor: '#f44e17' }}
              >
                <Plus size={16} />
                Create
              </button>
            </div>
          </div>

          {/* Info Bar */}
          {filteredMedia.length > 0 && (
            <div className="mb-4 flex justify-between items-center">
              <p className="text-gray-500 text-sm">
                Showing {currentItems.length} of {filteredMedia.length} items
              </p>
              {totalPages > 1 && (
                <p className="text-gray-500 text-sm">
                  Page {currentPage} of {totalPages}
                </p>
              )}
            </div>
          )}

          {/* Media Grid */}
          {currentItems.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {currentItems.map((item) => (
                  <div 
                    key={item.id}
                    className="group relative bg-white rounded-lg shadow-md hover:shadow-xl transition-all overflow-hidden"
                  >
                    {/* Aspect ratio container */}
                    <div className="relative aspect-[9/16] bg-gray-900">
                      {/* Selection checkbox */}
                      <div className="absolute top-2 left-2 z-20">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.id)}
                          onChange={() => toggleItemSelection(item.id)}
                          className="w-5 h-5 rounded border-2 border-white bg-black/50 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </div>

                      {/* Media preview */}
                      {item.media_type === 'video' ? (
                        <video
                          src={item.file_url}
                          className="w-full h-full object-cover"
                          muted
                          loop
                          playsInline
                          preload="auto"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <Image size={48} className="text-white/80" />
                        </div>
                      )}

                      {/* Media type badge */}
                      <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs text-white font-medium ${
                        item.media_type === 'video' ? 'bg-blue-500' : 'bg-purple-500'
                      }`}>
                        {item.media_type === 'video' ? 'Video' : 'Slideshow'}
                      </div>

                      {/* Play button overlay */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (item.media_type === 'video') {
                              const video = e.currentTarget.closest('.group').querySelector('video');
                              if (video) {
                                if (video.paused) {
                                  video.play();
                                } else {
                                  video.pause();
                                  video.currentTime = 0;
                                }
                              }
                            } else {
                              // Pour les slideshows, ouvrir dans une nouvelle fenêtre ou modal
                              window.open(item.file_url, '_blank');
                            }
                          }}
                          className="bg-white/90 hover:bg-white rounded-full p-3 opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                        >
                          {item.media_type === 'video' ? (
                            <svg className="w-8 h-8 text-black fill-black ml-1" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          ) : (
                            <Eye className="w-8 h-8 text-black" />
                          )}
                        </button>
                      </div>


                      {/* Action buttons */}
                      <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadMedia(item);
                          }}
                          disabled={downloadingItem === item.id}
                          className={`p-1.5 text-white rounded-full transition-colors ${
                            downloadingItem === item.id
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-blue-500 hover:bg-blue-600'
                          }`}
                          title="Download"
                        >
                          {downloadingItem === item.id ? (
                            <Loader className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download size={14} />
                          )}
                        </button>
                        
                        {item.media_type === 'video' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVideoForTiktok({ 
                                path: item.file_url, 
                                id: item.id 
                              });
                              setTiktokModalOpen(true);
                            }}
                            className="p-1.5 bg-purple-600 text-white rounded-full hover:bg-purple-700"
                            title="Share to TikTok"
                          >
                            <Share2 size={14} />
                          </button>
                        )}
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMedia(item);
                          }}
                          className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Item info */}
                    <div className="p-3">
                      <p className="font-medium text-gray-900 truncate text-sm">
                        {item.file_name || `${item.media_type} ${item.id.slice(0, 8)}`}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar size={12} className="text-gray-400" />
                        <p className="text-xs text-gray-500">
                          {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-8">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-lg font-medium transition-colors disabled:bg-gray-200 disabled:text-gray-400 bg-white border border-gray-300 hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'bg-white border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 rounded-lg font-medium transition-colors disabled:bg-gray-200 disabled:text-gray-400 bg-white border border-gray-300 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center min-h-[60vh] py-24">
              <div className="bg-gray-100 rounded-full p-6 mb-6">
                <Grid className="w-16 h-16 text-gray-500" />
              </div>
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">
                {showOnlyWithoutCollection 
                  ? 'No videos without collection'
                  : 'No generated videos yet'
                }
              </h2>
              <p className="text-gray-600 mb-8 text-center max-w-md">
                {showOnlyWithoutCollection 
                  ? 'All your videos are organized in collections. Toggle "All Media" to see everything.'
                  : 'Create your first video to see it here'
                }
              </p>
              <div className="flex gap-3">
                {showOnlyWithoutCollection && (
                  <button 
                    onClick={() => setShowOnlyWithoutCollection(false)}
                    className="px-6 py-3 rounded-lg font-medium bg-gray-200 text-gray-700 hover:bg-gray-300"
                  >
                    Show All Videos
                  </button>
                )}
                <button 
                  onClick={() => router.push('/create')}
                  className="px-6 py-3 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Create New Video
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TikTok Modal */}
      {selectedVideoForTiktok && (
        <TikTokPublishModal
          isOpen={tiktokModalOpen}
          onClose={() => {
            setTiktokModalOpen(false);
            setSelectedVideoForTiktok(null);
          }}
          videoUrl={selectedVideoForTiktok.path}
          videoPath={selectedVideoForTiktok.path}
          defaultCaption="Check out my amazing video!"
          onSuccess={() => {
            toast.success("Video sent to TikTok!");
          }}
        />
      )}

      {/* Move to Collection Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">
                Move {selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} to...
              </h3>
              <button
                onClick={() => setShowMoveModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              <button
                onClick={() => handleMoveToCollection(null)}
                className="w-full text-left p-3 hover:bg-gray-100 rounded-lg flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                  <Grid size={18} />
                </div>
                <div>
                  <p className="font-medium">No Collection</p>
                  <p className="text-sm text-gray-500">Keep at root level</p>
                </div>
              </button>
              
              {collections.map(collection => (
                <button
                  key={collection.id}
                  onClick={() => handleMoveToCollection(collection.id)}
                  className="w-full text-left p-3 hover:bg-gray-100 rounded-lg flex items-center gap-3"
                >
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: collection.color + '20' }}
                  >
                    <Folder size={18} style={{ color: collection.color }} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{collection.name}</p>
                    {collection.description && (
                      <p className="text-sm text-gray-500 truncate">{collection.description}</p>
                    )}
                  </div>
                  {collection.stats && (
                    <div className="text-xs text-gray-500">
                      <p>{collection.stats.videos || 0} videos</p>
                      <p>{collection.stats.slideshows || 0} slideshows</p>
                    </div>
                  )}
                </button>
              ))}
              
              {collections.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Folder size={48} className="mx-auto mb-3 text-gray-300" />
                  <p className="mb-3">No collections yet</p>
                  <p className="text-sm text-gray-400">Collections help organize your media</p>
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowMoveModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}