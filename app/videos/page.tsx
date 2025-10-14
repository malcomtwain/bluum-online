"use client";

import React, { useState, useEffect } from 'react';
import { Plus, HelpCircle, ChevronLeft, Upload, Search, Trash2, X, Edit2, Layers, ArrowUpDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { uploadToSupabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import {
  getVideoCollections,
  createVideoCollection,
  updateVideoCollection,
  deleteVideoCollection,
  addVideoToCollection,
  removeVideosFromCollection
} from '@/lib/collections-db';
import BulkCreateModal from '@/components/BulkCreateModal';

interface VideoFile {
  id: string;
  fileName: string;
  url: string;
  size: number;
  uploadedAt: Date;
}

interface Collection {
  id: string;
  name: string;
  videos: VideoFile[];
  thumbnail?: string;
}

export default function VideosPage() {
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load collections from Supabase on mount
  useEffect(() => {
    const loadCollections = async () => {
      if (user) {
        try {
          const dbCollections = await getVideoCollections(user.id);
          if (dbCollections.length === 0) {
            // Create default collection if none exist
            setCollections([{
              id: '00000000-0000-0000-0000-000000000001',
              name: 'All Videos',
              videos: [],
              thumbnail: undefined
            }]);
          } else {
            setCollections(dbCollections);
          }
        } catch (error) {
          console.error('Error loading collections:', error);
          // Fallback to default collection on error
          setCollections([{
            id: '00000000-0000-0000-0000-000000000001',
            name: 'All Videos',
            videos: [],
            thumbnail: undefined
          }]);
        }
        setIsInitialized(true);
      } else {
        setIsInitialized(true);
      }
    };
    loadCollections();
  }, [user]);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showingPage, setShowingPage] = useState(1);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkCreateModal, setShowBulkCreateModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameCollectionId, setRenameCollectionId] = useState<string | null>(null);
  const [renameCollectionName, setRenameCollectionName] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [collectionsPage, setCollectionsPage] = useState(1);
  const collectionsPerPage = 12; // 3 lignes × 4 colonnes

  const createNewCollection = async () => {
    if (newCollectionName.trim() && user) {
      try {
        const dbCollection = await createVideoCollection(user.id, newCollectionName.trim());
        const newCollection: Collection = {
          id: dbCollection.id,
          name: dbCollection.name,
          videos: [],
          thumbnail: dbCollection.thumbnail
        };
        setCollections([...collections, newCollection]);
        setShowCreateModal(false);
        setNewCollectionName('');
        setNewCollectionDescription('');
        toast.success('Collection created successfully!');
      } catch (error) {
        console.error('Error creating collection:', error);
        toast.error('Failed to create collection');
      }
    }
  };

  const renameCollection = async () => {
    if (renameCollectionName.trim() && renameCollectionId) {
      try {
        await updateVideoCollection(renameCollectionId, { name: renameCollectionName.trim() });
        setCollections(prev => prev.map(collection => {
          if (collection.id === renameCollectionId) {
            return {
              ...collection,
              name: renameCollectionName.trim()
            };
          }
          return collection;
        }));
        setShowRenameModal(false);
        setRenameCollectionId(null);
        setRenameCollectionName('');
        toast.success('Collection renamed successfully!');
      } catch (error) {
        console.error('Error renaming collection:', error);
        toast.error('Failed to rename collection');
      }
    }
  };

  const handleBulkCreateCollections = async (titles: string[]) => {
    if (!user) return;
    
    let successCount = 0;
    let failCount = 0;
    
    for (const title of titles) {
      try {
        const newCollection = await createVideoCollection(user.id, title);
        
        setCollections(prev => [...prev, {
          id: newCollection.id,
          name: title,
          videos: [],
          thumbnail: undefined
        }]);
        successCount++;
      } catch (error) {
        console.error(`Failed to create collection: ${title}`, error);
        failCount++;
      }
    }
    
    if (successCount > 0) {
      toast.success(`Created ${successCount} collection${successCount > 1 ? 's' : ''}`);
    }
    if (failCount > 0) {
      toast.error(`Failed to create ${failCount} collection${failCount > 1 ? 's' : ''}`);
    }
  };

  const handleVideoUpload = async (files: FileList | null, collectionId?: string) => {
    if (!files || !user) {
      toast.error('Please sign in to upload videos');
      return;
    }
    
    setIsLoading(true);
    const targetCollectionId = collectionId || collections[0].id;
    const BATCH_SIZE = 3; // Upload 3 videos at a time (videos are larger)
    const filesArray = Array.from(files).filter(file => file.type.startsWith('video/'));
    const totalFiles = filesArray.length;
    
    if (totalFiles === 0) {
      toast.error('No valid videos selected');
      setIsLoading(false);
      return;
    }
    
    const uploadToast = toast.loading(`Uploading 0/${totalFiles} videos...`);
    const allNewVideos: VideoFile[] = [];
    let uploadedCount = 0;
    
    try {
      // Process files in batches
      for (let i = 0; i < filesArray.length; i += BATCH_SIZE) {
        const batch = filesArray.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (file) => {
          try {
            // Upload to Supabase Storage
            const url = await uploadToSupabase(file, 'video', user.id);
            
            const videoFile: VideoFile = {
              id: Date.now().toString() + Math.random(),
              fileName: file.name,
              url,
              size: file.size,
              uploadedAt: new Date()
            };
            
            // Add to database immediately
            await addVideoToCollection(targetCollectionId, {
              fileName: videoFile.fileName,
              url: videoFile.url,
              size: videoFile.size
            });
            
            uploadedCount++;
            toast.loading(`Uploading ${uploadedCount}/${totalFiles} videos...`, { id: uploadToast });
            
            return videoFile;
          } catch (error) {
            console.error(`Failed to upload ${file.name}:`, error);
            return null;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        const successfulUploads = batchResults.filter(vid => vid !== null) as VideoFile[];
        allNewVideos.push(...successfulUploads);
        
        // Update local state after each batch
        if (successfulUploads.length > 0) {
          setCollections(prev => prev.map(collection => {
            if (collection.id === targetCollectionId) {
              const updatedVideos = [...collection.videos, ...successfulUploads];
              return {
                ...collection,
                videos: updatedVideos,
                thumbnail: collection.thumbnail || (updatedVideos.length > 0 ? updatedVideos[0].url : undefined)
              };
            }
            return collection;
          }));
        }
      }
      
      toast.dismiss(uploadToast);
      
      if (allNewVideos.length === totalFiles) {
        toast.success(`All ${totalFiles} videos uploaded successfully!`);
      } else {
        toast.warning(`Uploaded ${allNewVideos.length} of ${totalFiles} videos. Some failed.`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.dismiss(uploadToast);
      toast.error('Failed to upload videos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragDrop = async (e: React.DragEvent, collectionId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    await handleVideoUpload(e.dataTransfer.files, collectionId);
  };

  const handleFileClick = (collectionId?: string) => {
    if (isLoading) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      await handleVideoUpload(target.files, collectionId);
    };
    input.click();
  };

  const toggleVideoSelection = (videoId: string) => {
    setSelectedVideos(prev => 
      prev.includes(videoId) 
        ? prev.filter(id => id !== videoId)
        : [...prev, videoId]
    );
  };

  const deleteSelectedVideos = async () => {
    if (!selectedCollection) return;
    
    try {
      // Delete from database
      await removeVideosFromCollection(selectedVideos);
      
      // Update local state
      setCollections(prev => prev.map(collection => {
        if (collection.id === selectedCollection.id) {
          const remainingVideos = collection.videos.filter(vid => !selectedVideos.includes(vid.id));
          return {
            ...collection,
            videos: remainingVideos,
            thumbnail: remainingVideos.length > 0 ? remainingVideos[0].url : undefined
          };
        }
        return collection;
      }));
      
      setSelectedVideos([]);
      toast.success('Videos deleted successfully');
    } catch (error) {
      console.error('Error deleting videos:', error);
      toast.error('Failed to delete videos');
    }
  };

  const filteredVideos = selectedCollection?.videos
    .filter(vid => 
      vid.fileName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const dateA = new Date(a.uploadedAt).getTime();
      const dateB = new Date(b.uploadedAt).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    }) || [];

  const videosPerPage = 18; // 3 lignes × 6 colonnes max
  const totalPages = Math.ceil(filteredVideos.length / videosPerPage);
  const startIndex = (showingPage - 1) * videosPerPage;
  const endIndex = startIndex + videosPerPage;
  const currentVideos = filteredVideos.slice(startIndex, endIndex);

  // Show loading until initialized
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-500"></div>
      </div>
    );
  }

  // Vue détaillée d'une collection
  if (selectedCollection) {
    return (
      <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f3f4f0' }}>
        <div className="p-4 xl:p-6">
          <div className="pt-8 xl:pt-8">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedCollection(null)}
                  className="flex items-center gap-2 text-sm"
                  style={{ color: '#1e1e1e' }}
                >
                  <ChevronLeft size={16} />
                  {selectedCollection.name}
                </button>
                <span className="text-sm text-gray-600">
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredVideos.length)} of {filteredVideos.length} videos
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  className="px-3 py-1 text-sm rounded-md"
                  style={{ backgroundColor: '#3e90fd', color: 'white' }}
                >
                  View
                </button>
              </div>
            </div>

            {/* Content */}
            {selectedCollection.videos.length === 0 ? (
              /* Empty state with upload */
              <div 
                className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors border-[#d0d0ce] hover:border-[#3e90fd]/50"
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => handleDragDrop(e, selectedCollection.id)}
                onClick={() => handleFileClick(selectedCollection.id)}
              >
                <Upload size={48} className="mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold mb-2" style={{ color: '#1e1e1e' }}>
                  Drag and drop (or click to upload)
                </h3>
                <p className="text-gray-600 mb-4">
                  Upload your videos (MP4, MOV up to 250MB each)
                </p>
                <button 
                  className="px-6 py-2 rounded-lg font-medium"
                  style={{ backgroundColor: '#3e90fd', color: 'white' }}
                >
                  Add existing videos to collection
                </button>
              </div>
            ) : (
              <div>
                {/* Top controls */}
                <div className="flex justify-between items-center mb-6">
                  <div className="flex gap-4 flex-1">
                    <div className="relative">
                      <Search 
                        size={20} 
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type="text"
                        placeholder="Search videos..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-[#d0d0ce] rounded-lg focus:outline-none focus:ring-2"
                        style={{ backgroundColor: 'white', color: '#1e1e1e' }}
                      />
                    </div>
                    <button
                      onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#d0d0ce] bg-white hover:bg-gray-50 whitespace-nowrap"
                      style={{ color: '#1e1e1e' }}
                    >
                      <ArrowUpDown size={16} />
                      <span className="text-sm font-medium">
                        {sortOrder === 'newest' ? 'Most Recent' : 'Oldest First'}
                      </span>
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (selectedVideos.length === filteredVideos.length && filteredVideos.length > 0) {
                          setSelectedVideos([]);
                        } else {
                          setSelectedVideos(filteredVideos.map(vid => vid.id));
                        }
                      }}
                      className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg ${
                        selectedVideos.length === filteredVideos.length && filteredVideos.length > 0
                          ? 'bg-purple-500/10 text-purple-500 hover:bg-purple-500/20'
                          : 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20'
                      }`}
                    >
                      {selectedVideos.length === filteredVideos.length && filteredVideos.length > 0 ? (
                        <>
                          <X size={16} />
                          Deselect All
                        </>
                      ) : (
                        <>
                          <input type="checkbox" className="w-4 h-4" readOnly checked={false} />
                          Select All
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleFileClick(selectedCollection.id)}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20"
                    >
                      <Upload size={16} />
                      Upload
                    </button>
                    {selectedVideos.length > 0 && (
                      <button
                        onClick={deleteSelectedVideos}
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20"
                      >
                        <Trash2 size={16} />
                        Delete ({selectedVideos.length})
                      </button>
                    )}
                  </div>
                </div>

                {/* Videos grid */}
                <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 mb-6">
                  {currentVideos.map((video) => (
                    <div key={video.id} className="relative group cursor-pointer">
                      <div className="aspect-square bg-white rounded-lg border border-gray-300 p-2 sm:p-3 flex items-center justify-center">
                        <video
                          src={video.url}
                          className="w-full h-full object-contain rounded"
                          muted
                        />
                        <div className="absolute top-2 left-2">
                          <input
                            type="checkbox"
                            checked={selectedVideos.includes(video.id)}
                            onChange={() => toggleVideoSelection(video.id)}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2">
                    <button 
                      onClick={() => setShowingPage(prev => Math.max(1, prev - 1))}
                      disabled={showingPage === 1}
                      className="px-3 py-1 text-sm text-gray-500 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setShowingPage(page)}
                        className={`px-3 py-1 text-sm rounded ${
                          page === showingPage 
                            ? 'text-white' 
                            : 'text-gray-500 hover:bg-gray-100'
                        }`}
                        style={{ 
                          backgroundColor: page === showingPage ? '#3e90fd' : 'transparent' 
                        }}
                      >
                        {page}
                      </button>
                    ))}
                    
                    <button 
                      onClick={() => setShowingPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={showingPage === totalPages}
                      className="px-3 py-1 text-sm text-gray-500 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Vue principale des collections
  return (
    <div className="flex flex-col min-h-screen w-full" style={{ backgroundColor: '#f3f4f0' }}>
      <div className="p-4 xl:p-6 w-full">
        <div className="pt-4 xl:pt-6 w-full">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold" style={{ color: '#333333' }}>
                My Video Collections
              </h1>
              <HelpCircle size={20} className="text-gray-400" />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-white"
                style={{ backgroundColor: '#f44e17' }}
              >
                <Plus size={16} />
                New Collection
              </button>
              <button 
                onClick={() => setShowBulkCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-white bg-purple-600 hover:bg-purple-700"
              >
                <Layers size={16} />
                Bulk Create
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 mb-6">
            {collections
              .slice((collectionsPage - 1) * collectionsPerPage, collectionsPage * collectionsPerPage)
              .map((collection) => (
              <div 
                key={collection.id}
                onClick={() => setSelectedCollection(collection)}
                className="group flex flex-col cursor-pointer shadow-lg hover:shadow-xl transition-shadow rounded-lg overflow-hidden"
              >
                <div className="relative aspect-square rounded-t-lg bg-[#1a1a1a] overflow-hidden">
                  {collection.videos && collection.videos.length > 0 ? (
                    <div className="w-full h-full grid grid-cols-3 grid-rows-2 gap-0.5">
                      {/* First video - large, takes left 2/3 */}
                      {collection.videos[0] && (
                        <div className="col-span-2 row-span-2">
                          <video 
                            src={collection.videos[0].url} 
                            className="w-full h-full object-cover"
                            muted
                          />
                        </div>
                      )}
                      {/* Second video - top right */}
                      {collection.videos[1] ? (
                        <div className="col-span-1 row-span-1">
                          <video 
                            src={collection.videos[1].url} 
                            className="w-full h-full object-cover"
                            muted
                          />
                        </div>
                      ) : (
                        <div className="col-span-1 row-span-1 bg-[#2a2a2a]"></div>
                      )}
                      {/* Third video - bottom right */}
                      {collection.videos[2] ? (
                        <div className="col-span-1 row-span-1">
                          <video 
                            src={collection.videos[2].url} 
                            className="w-full h-full object-cover"
                            muted
                          />
                        </div>
                      ) : (
                        <div className="col-span-1 row-span-1 bg-[#2a2a2a]"></div>
                      )}
                      {/* Overlay for 4th and 5th videos if they exist */}
                      {collection.videos.length > 3 && (
                        <div className="absolute bottom-1 right-1 flex gap-1">
                          {collection.videos[3] && (
                            <div className="w-8 h-8 rounded overflow-hidden border border-white/20">
                              <video 
                                src={collection.videos[3].url} 
                                className="w-full h-full object-cover"
                                muted
                              />
                            </div>
                          )}
                          {collection.videos[4] && (
                            <div className="w-8 h-8 rounded overflow-hidden border border-white/20">
                              <video 
                                src={collection.videos[4].url} 
                                className="w-full h-full object-cover"
                                muted
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Plus className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                  
                  {/* Action buttons - only show if not the default collection */}
                  {collection.id !== '00000000-0000-0000-0000-000000000001' && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameCollectionId(collection.id);
                          setRenameCollectionName(collection.name);
                          setShowRenameModal(true);
                        }}
                        className="absolute top-2 right-12 p-1.5 bg-blue-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-600"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCollectionToDelete(collection.id);
                          setShowDeleteModal(true);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
                <div className="p-2 bg-white rounded-b-lg text-left">
                  <p className="text-base font-medium text-gray-900 truncate tracking-normal">{collection.name}</p>
                  <p className="text-sm font-medium text-gray-600 truncate tracking-normal">{collection.videos.length} videos</p>
                  <p className="text-xs text-gray-500 truncate tracking-normal">
                    {collection.videos.length > 0 
                      ? `Last updated: ${new Date().toLocaleDateString()}`
                      : 'Empty collection'}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination for collections */}
          {collections.length > collectionsPerPage && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <button
                onClick={() => setCollectionsPage(prev => Math.max(1, prev - 1))}
                disabled={collectionsPage === 1}
                className="px-4 py-2 rounded-lg font-medium transition-colors disabled:bg-gray-200 disabled:text-gray-400 bg-white border border-gray-300 hover:bg-gray-50"
              >
                Previous
              </button>

              {Array.from({ length: Math.ceil(collections.length / collectionsPerPage) }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCollectionsPage(page)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    collectionsPage === page
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() => setCollectionsPage(prev => Math.min(Math.ceil(collections.length / collectionsPerPage), prev + 1))}
                disabled={collectionsPage === Math.ceil(collections.length / collectionsPerPage)}
                className="px-4 py-2 rounded-lg font-medium transition-colors disabled:bg-gray-200 disabled:text-gray-400 bg-white border border-gray-300 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Collection Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Create New Collection</h3>
              <button 
                onClick={() => {
                  setShowCreateModal(false);
                  setNewCollectionName('');
                  setNewCollectionDescription('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="Collection #1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description (optional)</label>
                <textarea
                  value={newCollectionDescription}
                  onChange={(e) => setNewCollectionDescription(e.target.value)}
                  placeholder="Enter collection description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewCollectionName('');
                  setNewCollectionDescription('');
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createNewCollection}
                disabled={!newCollectionName.trim()}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Collection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Collection Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Rename Collection</h3>
              <button 
                onClick={() => {
                  setShowRenameModal(false);
                  setRenameCollectionId(null);
                  setRenameCollectionName('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Collection Name</label>
                <input
                  type="text"
                  value={renameCollectionName}
                  onChange={(e) => setRenameCollectionName(e.target.value)}
                  placeholder="Enter new collection name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowRenameModal(false);
                  setRenameCollectionId(null);
                  setRenameCollectionName('');
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={renameCollection}
                disabled={!renameCollectionName.trim()}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Collection Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Delete Collection</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete this collection? Videos in this collection will not be deleted. Type "delete" to confirm.
            </p>
            
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 mb-6"
            />
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setCollectionToDelete(null);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (deleteConfirmText.toLowerCase() === 'delete' && collectionToDelete) {
                    try {
                      await deleteVideoCollection(collectionToDelete);
                      setCollections(collections.filter(c => c.id !== collectionToDelete));
                      setShowDeleteModal(false);
                      setCollectionToDelete(null);
                      setDeleteConfirmText('');
                      toast.success('Collection deleted successfully');
                    } catch (error) {
                      console.error('Error deleting collection:', error);
                      toast.error('Failed to delete collection');
                    }
                  }
                }}
                disabled={deleteConfirmText.toLowerCase() !== 'delete'}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Collection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Create Modal */}
      <BulkCreateModal
        isOpen={showBulkCreateModal}
        onClose={() => setShowBulkCreateModal(false)}
        onConfirm={handleBulkCreateCollections}
        title="Bulk Create Video Collections"
        itemType="collection"
      />
    </div>
  );
}