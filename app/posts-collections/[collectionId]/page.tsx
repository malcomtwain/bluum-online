"use client";

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Download, Trash2, Video, Image, 
  CheckSquare, Square, DownloadCloud, Play,
  X, Move, Grid, List, FolderPlus, Folder,
  ChevronRight, Edit2, FolderOpen, Layers
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { useRouter, useParams } from 'next/navigation';
import { 
  deleteGeneratedVideo, 
  deleteGeneratedVideos,
  deleteGeneratedSlideshow,
  deleteGeneratedSlideshows,
  type GeneratedVideo,
  type GeneratedSlideshow
} from '@/lib/generated-media-db';
import {
  getCollectionWithMedia,
  removeVideoFromCollection,
  removeSlideshowFromCollection,
  getUserCollections,
  createCollection,
  deleteCollection,
  updateCollection,
  type MediaCollection
} from '@/lib/media-collections';
import { downloadVideosAsZip } from '@/utils/zipDownloader';
import { downloadSlideshowsAsZip } from '@/utils/slideshowZipDownloader';
import BulkCreateModal from '@/components/BulkCreateModal';

type MediaItem = (GeneratedVideo | GeneratedSlideshow) & { 
  media_type: 'video' | 'slideshow' 
};

export default function CollectionDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const collectionId = params.collectionId as string;
  
  const [collection, setCollection] = useState<MediaCollection | null>(null);
  const [subcollections, setSubcollections] = useState<MediaCollection[]>([]);
  const [subcollectionMedias, setSubcollectionMedias] = useState<Record<string, { videos: any[]; slideshows: any[] }>>({});
  const [allMedia, setAllMedia] = useState<MediaItem[]>([]);
  const [filteredMedia, setFilteredMedia] = useState<MediaItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterType, setFilterType] = useState<'all' | 'videos' | 'slideshows'>('all');
  const [showPreview, setShowPreview] = useState<MediaItem | null>(null);
  const [showCreateSubModal, setShowCreateSubModal] = useState(false);
  const [showBulkCreateModal, setShowBulkCreateModal] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubDescription, setNewSubDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 18; // 6 columns × 3 rows
  const totalPages = Math.ceil(filteredMedia.length / itemsPerPage);
  const currentItems = filteredMedia.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    if (user?.id && collectionId) {
      loadCollection();
    }
  }, [user, collectionId]);

  useEffect(() => {
    filterMedia();
  }, [allMedia, filterType]);

  const loadCollection = async () => {
    if (!user?.id || !collectionId) return;
    
    setIsLoading(true);
    try {
      const data = await getCollectionWithMedia(collectionId);
      if (data) {
        setCollection(data);
        
        // Combine videos and slideshows
        const media: MediaItem[] = [
          ...(data.videos || []).map(v => ({ ...v, media_type: 'video' as const })),
          ...(data.slideshows || []).map(s => ({ ...s, media_type: 'slideshow' as const }))
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        setAllMedia(media);
        
        // Load subcollections
        const subcolls = await getUserCollections(user.id, collectionId);
        setSubcollections(subcolls);
        
        // Load media preview for each subcollection
        const medias: Record<string, { videos: any[]; slideshows: any[] }> = {};
        for (const subcoll of subcolls) {
          const subcollData = await getCollectionWithMedia(subcoll.id);
          medias[subcoll.id] = {
            videos: subcollData?.videos?.slice(0, 3) || [],
            slideshows: subcollData?.slideshows?.slice(0, 3) || []
          };
        }
        setSubcollectionMedias(medias);
      }
    } catch (error) {
      console.error('Error loading collection:', error);
      toast.error('Failed to load collection');
    } finally {
      setIsLoading(false);
    }
  };

  const filterMedia = () => {
    let filtered = [...allMedia];
    
    if (filterType === 'videos') {
      filtered = filtered.filter(item => item.media_type === 'video');
    } else if (filterType === 'slideshows') {
      filtered = filtered.filter(item => item.media_type === 'slideshow');
    }
    
    setFilteredMedia(filtered);
    setCurrentPage(1); // Reset to first page when filtering
  };
  
  const handleCreateSubcollection = async () => {
    if (!user?.id || !newSubName.trim()) {
      toast.error('Please enter a subcollection name');
      return;
    }
    
    if (isCreating) return;
    
    setIsCreating(true);
    try {
      await createCollection(
        user.id,
        newSubName,
        newSubDescription || undefined,
        collectionId
      );
      toast.success('Subcollection created successfully');
      setNewSubName('');
      setNewSubDescription('');
      setShowCreateSubModal(false);
      await loadCollection(); // Reload to show new subcollection
    } catch (error) {
      console.error('Error creating subcollection:', error);
      toast.error('Failed to create subcollection');
    } finally {
      setIsCreating(false);
    }
  };
  
  const handleBulkCreateSubcollections = async (titles: string[]) => {
    if (!user?.id) return;
    
    let successCount = 0;
    let failCount = 0;
    
    for (const title of titles) {
      try {
        await createCollection(
          user.id,
          title,
          undefined,
          collectionId
        );
        successCount++;
      } catch (error) {
        console.error(`Failed to create subcollection: ${title}`, error);
        failCount++;
      }
    }
    
    if (successCount > 0) {
      toast.success(`Created ${successCount} subcollection${successCount > 1 ? 's' : ''}`);
    }
    if (failCount > 0) {
      toast.error(`Failed to create ${failCount} subcollection${failCount > 1 ? 's' : ''}`);
    }
    
    await loadCollection();
  };
  
  const openSubcollection = (subcollId: string) => {
    router.push(`/posts-collections/${subcollId}`);
  };

  const toggleSelectItem = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const selectAll = () => {
    if (selectedItems.length === filteredMedia.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredMedia.map(item => item.id));
    }
  };

  const handleRemoveFromCollection = async () => {
    if (selectedItems.length === 0) {
      toast.error('No items selected');
      return;
    }

    try {
      const videos = selectedItems.filter(id => 
        allMedia.find(m => m.id === id)?.media_type === 'video'
      );
      const slideshows = selectedItems.filter(id => 
        allMedia.find(m => m.id === id)?.media_type === 'slideshow'
      );

      for (const videoId of videos) {
        await removeVideoFromCollection(videoId);
      }
      for (const slideshowId of slideshows) {
        await removeSlideshowFromCollection(slideshowId);
      }

      toast.success(`Removed ${selectedItems.length} items from collection`);
      setSelectedItems([]);
      loadCollection();
    } catch (error) {
      console.error('Error removing from collection:', error);
      toast.error('Failed to remove items from collection');
    }
  };

  const handleDelete = async () => {
    if (selectedItems.length === 0) {
      toast.error('No items selected');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedItems.length} items? This cannot be undone.`)) {
      return;
    }

    try {
      const videos = selectedItems.filter(id => 
        allMedia.find(m => m.id === id)?.media_type === 'video'
      );
      const slideshows = selectedItems.filter(id => 
        allMedia.find(m => m.id === id)?.media_type === 'slideshow'
      );

      if (videos.length > 0) {
        await deleteGeneratedVideos(videos);
      }
      if (slideshows.length > 0) {
        await deleteGeneratedSlideshows(slideshows);
      }

      toast.success(`Deleted ${selectedItems.length} items`);
      setSelectedItems([]);
      loadCollection();
    } catch (error) {
      console.error('Error deleting items:', error);
      toast.error('Failed to delete items');
    }
  };

  const handleDownload = async () => {
    if (selectedItems.length === 0) {
      toast.error('No items selected');
      return;
    }

    setIsDownloading(true);
    try {
      const selectedMedia = filteredMedia.filter(item => selectedItems.includes(item.id));
      const videos = selectedMedia.filter(m => m.media_type === 'video') as GeneratedVideo[];
      const slideshows = selectedMedia.filter(m => m.media_type === 'slideshow') as GeneratedSlideshow[];
      
      if (videos.length > 0 && slideshows.length > 0) {
        // Download both types separately
        await Promise.all([
          downloadVideosAsZip(videos, `${collection?.name || 'collection'}-videos.zip`),
          downloadSlideshowsAsZip(slideshows, `${collection?.name || 'collection'}-slideshows.zip`)
        ]);
      } else if (videos.length > 0) {
        await downloadVideosAsZip(videos, `${collection?.name || 'collection'}-videos.zip`);
      } else if (slideshows.length > 0) {
        await downloadSlideshowsAsZip(slideshows, `${collection?.name || 'collection'}-slideshows.zip`);
      }
      
      toast.success('Download started');
    } catch (error) {
      console.error('Error downloading:', error);
      toast.error('Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading collection...</p>
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Collection not found</p>
          <button
            onClick={() => router.push('/posts-collections')}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            Back to Collections
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f3f4f0' }}>
      <div className="px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/posts-collections')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{collection.name}</h1>
              {collection.description && (
                <p className="text-gray-600 mt-1">{collection.description}</p>
              )}
              <p className="text-gray-500 text-sm mt-2">
                Showing {currentItems.length} of {filteredMedia.length} {filteredMedia.length === 1 ? 'item' : 'items'}
                {totalPages > 1 && ` • Page ${currentPage} of ${totalPages}`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex bg-white border border-gray-200 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100' : ''}`}
              >
                <Grid size={20} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-gray-100' : ''}`}
              >
                <List size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Filter Tabs */}
            <div className="flex bg-white border border-gray-200 rounded-lg p-1">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 rounded ${
                  filterType === 'all' 
                    ? 'bg-gray-900 text-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All ({allMedia.length})
              </button>
              <button
                onClick={() => setFilterType('videos')}
                className={`px-3 py-1 rounded flex items-center gap-1 ${
                  filterType === 'videos' 
                    ? 'bg-gray-900 text-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Video size={16} />
                Videos ({allMedia.filter(m => m.media_type === 'video').length})
              </button>
              <button
                onClick={() => setFilterType('slideshows')}
                className={`px-3 py-1 rounded flex items-center gap-1 ${
                  filterType === 'slideshows' 
                    ? 'bg-gray-900 text-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Image size={16} />
                Slideshows ({allMedia.filter(m => m.media_type === 'slideshow').length})
              </button>
            </div>
            
            {/* Select All */}
            <button
              onClick={selectAll}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {selectedItems.length === filteredMedia.length ? <CheckSquare size={16} /> : <Square size={16} />}
              Select All
            </button>
          </div>
          
          {/* Actions */}
          {selectedItems.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {selectedItems.length} selected
              </span>
              <button
                onClick={handleRemoveFromCollection}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
              >
                <Move size={16} />
                Remove from Collection
              </button>
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <DownloadCloud size={16} />
                {isDownloading ? 'Downloading...' : 'Download'}
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Subcollections Section */}
        {subcollections.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Subcollections</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreateSubModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  <FolderPlus size={16} />
                  New Subcollection
                </button>
                <button
                  onClick={() => setShowBulkCreateModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                >
                  <Layers size={16} />
                  Bulk Create
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {subcollections.map(subcoll => {
                const media = subcollectionMedias[subcoll.id];
                const allSubMedia = [...(media?.videos || []), ...(media?.slideshows || [])];
                
                return (
                  <div
                    key={subcoll.id}
                    onClick={() => openSubcollection(subcoll.id)}
                    className="group cursor-pointer bg-white rounded-lg shadow-sm hover:shadow-lg transition-all overflow-hidden"
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-square bg-gray-100">
                      {allSubMedia.length > 0 ? (
                        <div className="w-full h-full grid grid-cols-3 grid-rows-2 gap-0.5 bg-gray-200">
                          {/* First item - large */}
                          {allSubMedia[0] && (
                            <div className="col-span-2 row-span-2">
                              <video 
                                src={allSubMedia[0].file_url} 
                                className="w-full h-full object-cover"
                                muted
                              />
                            </div>
                          )}
                          {/* Second item */}
                          {allSubMedia[1] ? (
                            <div className="col-span-1 row-span-1">
                              <video 
                                src={allSubMedia[1].file_url} 
                                className="w-full h-full object-cover"
                                muted
                              />
                            </div>
                          ) : (
                            <div className="col-span-1 row-span-1 bg-gray-300"></div>
                          )}
                          {/* Third item */}
                          {allSubMedia[2] ? (
                            <div className="col-span-1 row-span-1">
                              <video 
                                src={allSubMedia[2].file_url} 
                                className="w-full h-full object-cover"
                                muted
                              />
                            </div>
                          ) : (
                            <div className="col-span-1 row-span-1 bg-gray-300"></div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FolderOpen size={48} className="text-gray-400" />
                        </div>
                      )}
                      
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                        <ChevronRight className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    
                    {/* Info */}
                    <div className="p-3">
                      <h3 className="font-medium text-gray-900 truncate">{subcoll.name}</h3>
                      {subcoll.description && (
                        <p className="text-sm text-gray-600 truncate mt-1">{subcoll.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        <span>{media?.videos?.length || 0} videos</span>
                        <span>•</span>
                        <span>{media?.slideshows?.length || 0} slideshows</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* If no subcollections, show create buttons */}
        {subcollections.length === 0 && (
          <div className="mb-6 flex gap-2">
            <button
              onClick={() => setShowCreateSubModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              <FolderPlus size={20} />
              Create Subcollection
            </button>
            <button
              onClick={() => setShowBulkCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
            >
              <Layers size={20} />
              Bulk Create
            </button>
          </div>
        )}
        
        {/* Media Section Header */}
        {filteredMedia.length > 0 && (
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Media Files</h2>
          </div>
        )}

        {/* Media Grid/List */}
        {filteredMedia.length > 0 ? (
          viewMode === 'grid' ? (
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
                        onChange={() => toggleSelectItem(item.id)}
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
                        preload="metadata"
                        onMouseEnter={(e) => {
                          try {
                            e.currentTarget.play();
                          } catch (err) {
                            console.log('Failed to play video');
                          }
                        }}
                        onMouseLeave={(e) => {
                          try {
                            e.currentTarget.pause();
                            e.currentTarget.currentTime = 0;
                          } catch (err) {
                            console.log('Failed to pause video');
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <Image className="w-16 h-16 text-gray-400" />
                      </div>
                    )}
                    
                    {/* Play button overlay */}
                    <div 
                      onClick={() => setShowPreview(item)}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                      <div className="bg-white/90 rounded-full p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto cursor-pointer">
                        <Play className="w-8 h-8 text-black fill-black ml-1" />
                      </div>
                    </div>
                    
                    {/* Type badge */}
                    <div className="absolute top-3 right-3">
                      <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
                        item.media_type === 'video'
                          ? 'bg-blue-500 text-white'
                          : 'bg-purple-500 text-white'
                      }`}>
                        {item.media_type === 'video' ? 'Video' : 'Slideshow'}
                      </span>
                    </div>

                    {/* Bottom overlay with info */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-white text-sm font-medium truncate">
                        {item.file_name}
                      </p>
                      <p className="text-white/70 text-xs mt-1">
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200">
              {currentItems.map((item, index) => (
                <div
                  key={item.id}
                  className={`flex items-center p-4 ${
                    index !== filteredMedia.length - 1 ? 'border-b border-gray-100' : ''
                  } hover:bg-gray-50 ${
                    selectedItems.includes(item.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  <div
                    onClick={() => toggleSelectItem(item.id)}
                    className="mr-4 cursor-pointer"
                  >
                    {selectedItems.includes(item.id) ? (
                      <CheckSquare className="w-5 h-5 text-blue-500" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  
                  <div className="w-16 h-16 rounded overflow-hidden bg-gray-100 mr-4">
                    {item.media_type === 'video' ? (
                      item.file_url ? (
                        <video
                          src={item.file_url}
                          className="w-full h-full object-cover"
                          muted
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="w-8 h-8 text-gray-400" />
                        </div>
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.file_name}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        item.media_type === 'video' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {item.media_type === 'video' ? 'Video' : 'Slideshow'}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setShowPreview(item)}
                    className="p-2 hover:bg-gray-200 rounded"
                  >
                    <Play size={16} />
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Video className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-gray-600">This collection is empty</p>
            <button
              onClick={() => router.push('/generated-videos')}
              className="mt-4 text-blue-600 hover:text-blue-700"
            >
              Add content from Generated Videos
            </button>
          </div>
        )}
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-8">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-lg font-medium transition-colors disabled:bg-gray-200 disabled:text-gray-400 bg-white border border-gray-300 hover:bg-gray-50"
            >
              Previous
            </button>
            
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNumber;
                if (totalPages <= 5) {
                  pageNumber = i + 1;
                } else if (currentPage <= 3) {
                  pageNumber = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNumber = totalPages - 4 + i;
                } else {
                  pageNumber = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNumber}
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                      currentPage === pageNumber
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNumber}
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
      </div>

      {/* Create Subcollection Modal */}
      {showCreateSubModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Create New Subcollection</h2>
            <p className="text-sm text-gray-600 mb-4">
              Creating subcollection in: <span className="font-medium">{collection.name}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subcollection Name
                </label>
                <input
                  type="text"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="My Subcollection"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={newSubDescription}
                  onChange={(e) => setNewSubDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe your subcollection..."
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateSubcollection}
                disabled={isCreating}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setShowCreateSubModal(false);
                  setNewSubName('');
                  setNewSubDescription('');
                }}
                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <h3 className="font-semibold">{showPreview.file_name}</h3>
              <button
                onClick={() => setShowPreview(null)}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              {showPreview.media_type === 'video' && showPreview.file_url ? (
                <video
                  src={showPreview.file_url}
                  controls
                  className="w-full rounded"
                />
              ) : (
                <div className="aspect-video bg-gray-100 rounded flex items-center justify-center">
                  <p className="text-gray-500">Preview not available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Create Subcollections Modal */}
      <BulkCreateModal
        isOpen={showBulkCreateModal}
        onClose={() => setShowBulkCreateModal(false)}
        onConfirm={handleBulkCreateSubcollections}
        title="Bulk Create Subcollections"
        itemType="subcollection"
        parentName={collection?.name}
      />
    </div>
  );
}