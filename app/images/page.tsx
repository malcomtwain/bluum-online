"use client";

import React, { useState, useEffect } from 'react';
import { Plus, HelpCircle, ChevronLeft, Upload, Search, Trash2, X, Edit2, Layers, ArrowUpDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { uploadToSupabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import {
  getImageCollections,
  createImageCollection,
  updateImageCollection,
  deleteImageCollection,
  addImageToCollection,
  removeImagesFromCollection
} from '@/lib/collections-db';
import BulkCreateModal from '@/components/BulkCreateModal';

interface ImageFile {
  id: string;
  fileName: string;
  url: string;
  size: number;
  uploadedAt: Date;
}

interface Collection {
  id: string;
  name: string;
  images: ImageFile[];
  thumbnail?: string;
}

export default function ImagesPage() {
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load collections from Supabase on mount
  useEffect(() => {
    const loadCollections = async () => {
      if (user) {
        try {
          const dbCollections = await getImageCollections(user.id);
          if (dbCollections.length === 0) {
            // Create default collection if none exist
            setCollections([{
              id: '00000000-0000-0000-0000-000000000001',
              name: 'All Images',
              images: [],
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
            name: 'All Images',
            images: [],
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
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
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
        const dbCollection = await createImageCollection(user.id, newCollectionName.trim());
        const newCollection: Collection = {
          id: dbCollection.id,
          name: dbCollection.name,
          images: [],
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
        await updateImageCollection(renameCollectionId, { name: renameCollectionName.trim() });
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
        const newCollection = await createImageCollection(user.id, title);
        
        setCollections(prev => [...prev, {
          id: newCollection.id,
          name: title,
          images: [],
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

  const handleImageUpload = async (files: FileList | null, collectionId?: string) => {
    if (!files || !user) {
      toast.error('Please sign in to upload images');
      return;
    }
    
    setIsLoading(true);
    const targetCollectionId = collectionId || collections[0].id;
    const BATCH_SIZE = 5; // Upload 5 images at a time
    const filesArray = Array.from(files).filter(file => file.type.startsWith('image/'));
    const totalFiles = filesArray.length;
    
    if (totalFiles === 0) {
      toast.error('No valid images selected');
      setIsLoading(false);
      return;
    }
    
    const uploadToast = toast.loading(`Uploading 0/${totalFiles} images...`);
    const allNewImages: ImageFile[] = [];
    let uploadedCount = 0;
    
    try {
      // Process files in batches
      for (let i = 0; i < filesArray.length; i += BATCH_SIZE) {
        const batch = filesArray.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (file) => {
          try {
            // Upload to Supabase Storage
            const url = await uploadToSupabase(file, 'image', user.id);
            
            const imageFile: ImageFile = {
              id: Date.now().toString() + Math.random(),
              fileName: file.name,
              url,
              size: file.size,
              uploadedAt: new Date()
            };
            
            // Add to database immediately
            await addImageToCollection(targetCollectionId, {
              fileName: imageFile.fileName,
              url: imageFile.url,
              size: imageFile.size
            });
            
            uploadedCount++;
            toast.loading(`Uploading ${uploadedCount}/${totalFiles} images...`, { id: uploadToast });
            
            return imageFile;
          } catch (error) {
            console.error(`Failed to upload ${file.name}:`, error);
            return null;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        const successfulUploads = batchResults.filter(img => img !== null) as ImageFile[];
        allNewImages.push(...successfulUploads);
        
        // Update local state after each batch
        if (successfulUploads.length > 0) {
          setCollections(prev => prev.map(collection => {
            if (collection.id === targetCollectionId) {
              const updatedImages = [...collection.images, ...successfulUploads];
              return {
                ...collection,
                images: updatedImages,
                thumbnail: collection.thumbnail || (updatedImages.length > 0 ? updatedImages[0].url : undefined)
              };
            }
            return collection;
          }));
        }
      }
      
      toast.dismiss(uploadToast);
      
      if (allNewImages.length === totalFiles) {
        toast.success(`All ${totalFiles} images uploaded successfully!`);
      } else {
        toast.warning(`Uploaded ${allNewImages.length} of ${totalFiles} images. Some failed.`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.dismiss(uploadToast);
      toast.error('Failed to upload images');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragDrop = async (e: React.DragEvent, collectionId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    await handleImageUpload(e.dataTransfer.files, collectionId);
  };

  const handleFileClick = (collectionId?: string) => {
    if (isLoading) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      await handleImageUpload(target.files, collectionId);
    };
    input.click();
  };

  const toggleImageSelection = (imageId: string) => {
    setSelectedImages(prev => 
      prev.includes(imageId) 
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    );
  };

  const deleteSelectedImages = async () => {
    if (!selectedCollection) return;
    
    try {
      // Delete from database
      await removeImagesFromCollection(selectedImages);
      
      // Update local state
      setCollections(prev => prev.map(collection => {
        if (collection.id === selectedCollection.id) {
          const remainingImages = collection.images.filter(img => !selectedImages.includes(img.id));
          return {
            ...collection,
            images: remainingImages,
            thumbnail: remainingImages.length > 0 ? remainingImages[0].url : undefined
          };
        }
        return collection;
      }));
      
      setSelectedImages([]);
      toast.success('Images deleted successfully');
    } catch (error) {
      console.error('Error deleting images:', error);
      toast.error('Failed to delete images');
    }
  };

  const filteredImages = selectedCollection?.images
    .filter(img => 
      img.fileName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const dateA = new Date(a.uploadedAt).getTime();
      const dateB = new Date(b.uploadedAt).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    }) || [];

  const imagesPerPage = 24; // 3 lignes × 8 colonnes max (responsive)
  const totalPages = Math.ceil(filteredImages.length / imagesPerPage);
  const startIndex = (showingPage - 1) * imagesPerPage;
  const endIndex = startIndex + imagesPerPage;
  const currentImages = filteredImages.slice(startIndex, endIndex);

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
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredImages.length)} of {filteredImages.length} images
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
            {selectedCollection.images.length === 0 ? (
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
                  Upload your images (PNG, JPEG up to 10MB each)
                </p>
                <button 
                  className="px-6 py-2 rounded-lg font-medium"
                  style={{ backgroundColor: '#3e90fd', color: 'white' }}
                >
                  Add existing images to collection
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
                        placeholder="Search images..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-[#d0d0ce] rounded-lg focus:outline-none focus:ring-2"
                        style={{ backgroundColor: 'white', color: '#1e1e1e' }}
                      />
                    </div>
                    <button
                      onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#d0d0ce] bg-white hover:bg-gray-50"
                      style={{ color: '#1e1e1e' }}
                    >
                      <ArrowUpDown size={16} />
                      <span className="text-sm">
                        {sortOrder === 'newest' ? 'Most Recent' : 'Oldest First'}
                      </span>
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (selectedImages.length === filteredImages.length && filteredImages.length > 0) {
                          setSelectedImages([]);
                        } else {
                          setSelectedImages(filteredImages.map(img => img.id));
                        }
                      }}
                      className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg ${
                        selectedImages.length === filteredImages.length && filteredImages.length > 0
                          ? 'bg-purple-500/10 text-purple-500 hover:bg-purple-500/20'
                          : 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20'
                      }`}
                    >
                      {selectedImages.length === filteredImages.length && filteredImages.length > 0 ? (
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
                    {selectedImages.length > 0 && (
                      <button
                        onClick={deleteSelectedImages}
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20"
                      >
                        <Trash2 size={16} />
                        Delete ({selectedImages.length})
                      </button>
                    )}
                  </div>
                </div>

                {/* Images grid */}
                <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 mb-6">
                  {currentImages.map((image) => (
                    <div key={image.id} className="relative group cursor-pointer">
                      <div className="aspect-square bg-white rounded-lg border border-gray-300 p-2 sm:p-3 flex items-center justify-center">
                        <img
                          src={image.url}
                          alt={image.fileName}
                          className="w-full h-full object-contain rounded"
                        />
                        <div className="absolute top-2 left-2">
                          <input
                            type="checkbox"
                            checked={selectedImages.includes(image.id)}
                            onChange={() => toggleImageSelection(image.id)}
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
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f3f4f0' }}>
      <div className="p-4 xl:p-6">
        <div className="pt-4 xl:pt-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold" style={{ color: '#333333' }}>
                My Images Collections
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            {collections
              .slice((collectionsPage - 1) * collectionsPerPage, collectionsPage * collectionsPerPage)
              .map((collection) => (
              <div 
                key={collection.id}
                onClick={() => setSelectedCollection(collection)}
                className="group flex flex-col cursor-pointer shadow-lg hover:shadow-xl transition-shadow rounded-lg overflow-hidden"
              >
                <div className="relative aspect-square rounded-t-lg bg-[#1a1a1a] overflow-hidden">
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
                        <div className="col-span-1 row-span-1 bg-[#2a2a2a]"></div>
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
                        <div className="col-span-1 row-span-1 bg-[#2a2a2a]"></div>
                      )}
                      {/* Overlay for 4th and 5th images if they exist */}
                      {collection.images.length > 3 && (
                        <div className="absolute bottom-1 right-1 flex gap-1">
                          {collection.images[3] && (
                            <div className="w-8 h-8 rounded overflow-hidden border border-white/20">
                              <img 
                                src={collection.images[3].url} 
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          {collection.images[4] && (
                            <div className="w-8 h-8 rounded overflow-hidden border border-white/20">
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
                  <p className="text-sm font-medium text-gray-600 truncate tracking-normal">{collection.images.length} images</p>
                  <p className="text-xs text-gray-500 truncate tracking-normal">
                    {collection.images.length > 0 
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
              Are you sure you want to delete this collection? Images in this collection will not be deleted. Type "delete" to confirm.
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
                      await deleteImageCollection(collectionToDelete);
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
        title="Bulk Create Image Collections"
        itemType="collection"
      />
    </div>
  );
}