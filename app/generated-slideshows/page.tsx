"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Presentation, Download, Trash2, X, CheckSquare, Square, DownloadCloud, Loader, Share2, Move, Folder, Grid, FolderPlus, SortDesc } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { downloadSlideshowsAsZip, downloadSingleSlideshow } from '@/utils/slideshowZipDownloader';
import { 
  getUserGeneratedSlideshows, 
  deleteGeneratedSlideshow, 
  deleteGeneratedSlideshows,
  type GeneratedSlideshow 
} from '@/lib/generated-media-db';
import {
  getUserCollections,
  moveSlideshowToCollection,
  createCollection,
  type MediaCollection
} from '@/lib/media-collections';

export default function GeneratedSlideshowsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [allSlideshows, setAllSlideshows] = useState<GeneratedSlideshow[]>([]);
  const [slideshows, setSlideshows] = useState<GeneratedSlideshow[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [slideshowImageIndexes, setSlideshowImageIndexes] = useState<{[key: string]: number}>({});
  const [slideshowImages, setSlideshowImages] = useState<{[key: string]: string[]}>({});
  const [selectedSlideshows, setSelectedSlideshows] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingSlideshow, setDownloadingSlideshow] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredSlideshow, setHoveredSlideshow] = useState<string | null>(null);
  const [animationSpeed, setAnimationSpeed] = useState(2000); // Default 2 seconds
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [collections, setCollections] = useState<MediaCollection[]>([]);
  const [showOnlyWithoutCollection, setShowOnlyWithoutCollection] = useState(true);
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');
  
  // 2 lignes max, avec 6 colonnes = 12 slideshows par page pour fluidité
  const slideshowsPerPage = 12;
  const totalPages = Math.ceil(slideshows.length / slideshowsPerPage);

  // Load ALL slideshows from Supabase on mount - une seule fois
  useEffect(() => {
    const loadSlideshows = async () => {
      if (!user?.id) {
        setIsInitialized(true);
        return;
      }
      
      try {
        // Charger TOUTES les données (avec et sans collection)
        const [allSlideshows, userCollections] = await Promise.all([
          getUserGeneratedSlideshows(user.id, false), // false = charger TOUT
          getUserCollections(user.id)
        ]);
        
        setAllSlideshows(allSlideshows);
        setCollections(userCollections);
      } catch (error) {
        console.error('Error loading slideshows:', error);
        toast.error('Failed to load slideshows');
      } finally {
        setIsInitialized(true);
      }
    };

    loadSlideshows();
  }, [user?.id]); // Retirer showOnlyWithoutCollection des dépendances

  // Appliquer filtres et tri
  useEffect(() => {
    let filtered = [...allSlideshows];
    
    // Filtrer par collection
    if (showOnlyWithoutCollection) {
      filtered = filtered.filter(slideshow => !slideshow.collection_id);
    }
    
    // Trier
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else {
        return (a.file_name || '').localeCompare(b.file_name || '');
      }
    });
    
    setSlideshows(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [allSlideshows, sortBy, showOnlyWithoutCollection]);

  // Auto-scroll effect for slideshows
  useEffect(() => {
    const interval = setInterval(() => {
      setSlideshowImageIndexes(prev => {
        const newIndexes = { ...prev };
        Object.keys(slideshowImages).forEach(slideshowId => {
          const images = slideshowImages[slideshowId];
          if (images && images.length > 0) {
            const currentIndex = prev[slideshowId] || 0;
            newIndexes[slideshowId] = (currentIndex + 1) % images.length;
          }
        });
        return newIndexes;
      });
    }, hoveredSlideshow ? 500 : 2000); // Faster when hovered

    return () => clearInterval(interval);
  }, [slideshowImages, hoveredSlideshow]);

  // Load slideshow images - seulement pour la page actuelle
  useEffect(() => {
    const loadSlideshowImages = async () => {
      const newImages: {[key: string]: string[]} = {};

      // Charger seulement les slideshows de la page actuelle
      const currentSlideshows = slideshows.slice((currentPage - 1) * slideshowsPerPage, currentPage * slideshowsPerPage);

      for (const slideshow of currentSlideshows) {
        console.log('Processing slideshow:', slideshow.id, 'file_url:', slideshow.file_url);

        // file_url peut être soit une URL Supabase complète, soit un chemin local
        const imageUrls: string[] = [];
        const imageCount = slideshow.image_count || 5;

        for (let i = 1; i <= imageCount; i++) {
          // Les images sont dans le même dossier que le file_url
          const imageUrl = `${slideshow.file_url}/part_${i}.png`;
          console.log(`Image ${i} URL:`, imageUrl);
          imageUrls.push(imageUrl);
        }

        newImages[slideshow.id] = imageUrls;
      }

      console.log('Loaded images:', newImages);
      setSlideshowImages(newImages);
    };

    if (slideshows.length > 0) {
      loadSlideshowImages();
    }
  }, [slideshows, currentPage]);

  const handleDeleteClick = async (slideshowId: string) => {
    try {
      await deleteGeneratedSlideshow(slideshowId);
      setAllSlideshows(prev => prev.filter(s => s.id !== slideshowId));
      toast.success('Slideshow deleted successfully');
    } catch (error) {
      console.error('Error deleting slideshow:', error);
      toast.error('Failed to delete slideshow');
    }
  };

  const handleDownloadSlideshow = async (slideshowId: string) => {
    try {
      setDownloadingSlideshow(slideshowId);
      await downloadSlideshowImages(slideshowId);
      toast.success('Slideshow downloaded!');
    } catch (error) {
      console.error('Error downloading slideshow:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to download slideshow: ${errorMessage}`);
    } finally {
      setDownloadingSlideshow(null);
    }
  };

  const downloadSlideshowImages = async (slideshowId: string) => {
    try {
      // Find the slideshow in the full list (not just current page)
      const slideshow = allSlideshows.find(s => s.id === slideshowId);
      if (!slideshow) {
        throw new Error('Slideshow not found');
      }

      // Build image URLs from slideshow metadata
      const imageUrls: string[] = [];
      const imageCount = slideshow.image_count || 5;

      for (let i = 1; i <= imageCount; i++) {
        const imageUrl = `${slideshow.file_url}/part_${i}.png`;
        imageUrls.push(imageUrl);
      }

      if (imageUrls.length === 0) {
        throw new Error('No images found for this slideshow');
      }

      // Import JSZip dynamically
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Add each image to the ZIP
      for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];
        try {
          const response = await fetch(imageUrl);
          if (response.ok) {
            const blob = await response.blob();
            zip.file(`part_${i + 1}.png`, blob);
          }
        } catch (err) {
          console.warn(`Failed to add image ${i + 1} to ZIP:`, err);
        }
      }

      // Generate and download the ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipBlob);

      const link = document.createElement('a');
      link.href = zipUrl;
      link.download = `slideshow-images-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(zipUrl);
    } catch (error) {
      console.error('Error downloading slideshow images:', error);
      toast.error('Failed to download slideshow images');
    }
  };

  const toggleSlideshowSelection = (id: string) => {
    setSelectedSlideshows(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const selectAllSlideshows = () => {
    setSelectedSlideshows(slideshows.map(s => s.id));
  };

  const deselectAllSlideshows = () => {
    setSelectedSlideshows([]);
  };

  const handleMoveToCollection = async (collectionId: string | null) => {
    if (selectedSlideshows.length === 0) {
      toast.error('No slideshows selected');
      return;
    }

    try {
      const promises = selectedSlideshows.map(slideshowId => 
        moveSlideshowToCollection(slideshowId, collectionId)
      );
      
      await Promise.all(promises);
      
      const message = collectionId 
        ? `Moved ${selectedSlideshows.length} slideshows to collection`
        : `Removed ${selectedSlideshows.length} slideshows from collection`;
      
      toast.success(message);
      setSelectedSlideshows([]);
      setShowMoveModal(false);
      
      // Reload slideshows
      if (user?.id) {
        const userSlideshows = await getUserGeneratedSlideshows(user.id, false); // Toujours charger TOUT
        setAllSlideshows(userSlideshows);
      }
    } catch (error) {
      console.error('Error moving slideshows:', error);
      toast.error('Failed to move slideshows to collection');
    }
  };

  const deleteSelectedSlideshows = async () => {
    if (selectedSlideshows.length === 0) return;
    
    try {
      await deleteGeneratedSlideshows(selectedSlideshows);
      setAllSlideshows(prev => prev.filter(s => !selectedSlideshows.includes(s.id)));
      const count = selectedSlideshows.length;
      setSelectedSlideshows([]);
      toast.success(`${count} slideshows deleted successfully`);
    } catch (error) {
      console.error('Error deleting slideshows:', error);
      toast.error('Failed to delete slideshows');
    }
  };

  const downloadSelectedSlideshows = async () => {
    if (selectedSlideshows.length === 0) {
      toast.error('No slideshows selected');
      return;
    }

    setIsDownloading(true);
    try {
      // Create a single ZIP containing all selected slideshows
      const JSZip = (await import('jszip')).default;
      const masterZip = new JSZip();

      // Get selected slideshows from allSlideshows
      const selectedSlideshowsList = allSlideshows.filter(s => selectedSlideshows.includes(s.id));

      // Add each slideshow to the master ZIP
      for (let idx = 0; idx < selectedSlideshowsList.length; idx++) {
        const slideshow = selectedSlideshowsList[idx];
        const imageCount = slideshow.image_count || 5;

        // Create a folder for this slideshow (using index for naming)
        const folderName = `slideshow_${idx + 1}`;

        // Download and add each image
        for (let i = 1; i <= imageCount; i++) {
          const imageUrl = `${slideshow.file_url}/part_${i}.png`;
          try {
            const response = await fetch(imageUrl);
            if (response.ok) {
              const blob = await response.blob();
              masterZip.file(`${folderName}/part_${i}.png`, blob);
            }
          } catch (err) {
            console.warn(`Failed to add image ${i} from slideshow ${slideshow.id}:`, err);
          }
        }
      }

      // Generate and download the master ZIP
      const zipBlob = await masterZip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipBlob);

      const link = document.createElement('a');
      link.href = zipUrl;
      link.download = `slideshows-${selectedSlideshows.length}-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(zipUrl);

      toast.success(`${selectedSlideshows.length} slideshows downloaded!`);
    } catch (error) {
      console.error('Error downloading slideshows:', error);
      toast.error('Failed to download slideshows');
    } finally {
      setIsDownloading(false);
    }
  };

  // Show loading until initialized
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f3f4f0' }}>
      <div className="p-4 xl:p-6">
        <div className="pt-4 xl:pt-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-semibold" style={{ color: '#333333' }}>
                My Generated Slideshows
              </h1>
              
              {/* Collection Filter Toggle */}
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
                {slideshows.length > 0 && (
                  <button
                    onClick={() => selectedSlideshows.length === slideshows.length ? deselectAllSlideshows() : selectAllSlideshows()}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    {selectedSlideshows.length === slideshows.length ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    {selectedSlideshows.length === slideshows.length ? 'Deselect' : 'Select'} All
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Action buttons when items selected */}
              {selectedSlideshows.length > 0 && (
                <>
                  <button
                    onClick={downloadSelectedSlideshows}
                    disabled={isDownloading}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {isDownloading ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <DownloadCloud className="w-4 h-4" />
                    )}
                    Download ({selectedSlideshows.length})
                  </button>

                  <button
                    onClick={() => setShowMoveModal(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700"
                  >
                    <Move className="w-4 h-4" />
                    Move ({selectedSlideshows.length})
                  </button>

                  <button
                    onClick={deleteSelectedSlideshows}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete ({selectedSlideshows.length})
                  </button>
                </>
              )}
              
              <button 
                onClick={() => router.push('/slideshow')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-white"
                style={{ backgroundColor: '#f44e17' }}
              >
                <Plus size={16} />
                Create
              </button>
            </div>
          </div>

          {/* Info bar */}
          {slideshows.length > 0 && (
            <div className="mb-4">
              <p className="text-gray-400 text-sm">
                {slideshows.length} {slideshows.length === 1 ? 'slideshow' : 'slideshows'} available
              </p>
            </div>
          )}

          {/* Content - Grille des slideshows avec aspect ratio 9:16 (TikTok) */}
          {slideshows.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {slideshows.slice((currentPage - 1) * slideshowsPerPage, currentPage * slideshowsPerPage).map((slideshow) => {
                const currentImageIndex = slideshowImageIndexes[slideshow.id] || 0;
                
                return (
                  <div 
                    key={slideshow.id}
                    className="group flex flex-col cursor-pointer shadow-lg hover:shadow-xl transition-shadow rounded-lg overflow-hidden"
                    onMouseEnter={() => setHoveredSlideshow(slideshow.id)}
                    onMouseLeave={() => setHoveredSlideshow(null)}
                  >
                    <div className="relative aspect-[9/16] rounded-t-lg bg-[#1a1a1a] overflow-hidden">
                      {/* Checkbox for selection */}
                      <div className="absolute top-3 left-3 z-20">
                        <input
                          type="checkbox"
                          checked={selectedSlideshows.includes(slideshow.id)}
                          onChange={() => toggleSlideshowSelection(slideshow.id)}
                          className="w-5 h-5 rounded border-2 border-white bg-black/50 text-blue-600 focus:ring-blue-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      
                      {/* Display slideshow images */}
                      {slideshowImages[slideshow.id] && slideshowImages[slideshow.id].length > 0 ? (
                        <img 
                          src={slideshowImages[slideshow.id][currentImageIndex]}
                          alt={`Slideshow ${slideshow.id} - Image ${currentImageIndex + 1}`}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            // Fallback rapide - juste une couleur de fond
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                          <div className="text-xs text-gray-300">📽️</div>
                        </div>
                      )}
                      
                      {/* Play button au centre */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-white/90 rounded-full p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-8 h-8 text-black fill-black ml-1" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </div>
                      </div>
                      
                      {/* Badge pour indiquer que c'est un slideshow avec compteur */}
                      <div className="absolute top-3 right-3 bg-purple-500 text-white text-xs px-2 py-1 rounded-lg">
                        {slideshowImages[slideshow.id] ? 
                          `${currentImageIndex + 1}/${slideshowImages[slideshow.id].length}` : 
                          'Slideshow'
                        }
                      </div>
                      
                      {/* Indicateurs de progression en bas */}
                      {slideshowImages[slideshow.id] && (
                        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 px-2">
                          {slideshowImages[slideshow.id].map((_, index) => (
                            <div
                              key={index}
                              className={`h-1 flex-1 max-w-[20px] rounded-full transition-all ${
                                index === currentImageIndex 
                                  ? 'bg-white' 
                                  : 'bg-white/30'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                      
                      {/* Download overlay */}
                      {downloadingSlideshow === slideshow.id && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-2xl">
                          <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg flex items-center gap-2">
                            <Loader className="w-4 h-4 animate-spin text-blue-500" />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">Downloading...</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Actions buttons */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadSlideshow(slideshow.id);
                          }}
                          disabled={downloadingSlideshow === slideshow.id}
                          className={`p-1.5 text-white rounded-full transition-colors ${
                            downloadingSlideshow === slideshow.id 
                              ? 'bg-gray-400 cursor-not-allowed' 
                              : 'bg-blue-500 hover:bg-blue-600'
                          }`}
                        >
                          {downloadingSlideshow === slideshow.id ? (
                            <Loader className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download size={14} />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(slideshow.id);
                          }}
                          className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="p-2 bg-white rounded-b-lg text-left">
                      <p className="text-base font-medium text-gray-900 truncate tracking-normal">{slideshow.file_name || `Slideshow ${slideshow.id.slice(0, 8)}`}</p>
                      <p className="text-sm font-medium text-gray-600 truncate tracking-normal">
                        {slideshow.style_type ? `Style ${slideshow.style_type}` : 'Generated slideshow'}
                      </p>
                      <p className="text-xs text-gray-500 truncate tracking-normal">
                        {new Date(slideshow.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                );
              })}
              </div>
              
              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-8">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      currentPage === 1
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Previous
                  </button>
                  
                  <div className="flex items-center gap-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                          currentPage === page
                            ? 'bg-[#3e90fd] text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      currentPage === totalPages
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            // Empty state
            <div className="flex flex-col items-center justify-center min-h-[60vh] py-24">
              <div className="bg-gray-100 rounded-full p-6 mb-6">
                <Presentation className="w-16 h-16 text-gray-500 mx-auto" />
              </div>
              <h2 className="text-2xl font-semibold mb-4" style={{ color: '#333333' }}>No generated slideshows yet</h2>
              <p className="text-gray-600 mb-8">
                Create your first slideshow to see it here
              </p>
              <button 
                onClick={() => router.push('/slideshow')}
                className="px-6 py-3 rounded-lg font-medium text-white"
                style={{ backgroundColor: '#3e90fd' }}
              >
                Create Slideshow
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Move to Collection Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">
                Move {selectedSlideshows.length} slideshow{selectedSlideshows.length > 1 ? 's' : ''} to...
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
                </button>
              ))}
              
              {collections.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Folder size={48} className="mx-auto mb-3 text-gray-300" />
                  <p className="mb-3">No collections yet</p>
                  <button
                    onClick={() => router.push('/posts-collections')}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Create your first collection
                  </button>
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => router.push('/posts-collections')}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <FolderPlus size={16} />
                New Collection
              </button>
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