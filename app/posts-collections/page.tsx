"use client";

import React, { useState, useEffect } from 'react';
import { 
  FolderPlus, Trash2, Edit2, Video, Image, 
  MoreVertical, ChevronRight, X, Check, Folder,
  Home, ArrowLeft, FolderOpen, Layers
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import {
  getUserCollections,
  createCollection,
  deleteCollection,
  updateCollection,
  getCollectionWithMedia,
  getCollectionPath,
  type MediaCollection
} from '@/lib/media-collections';
import BulkCreateModal from '@/components/BulkCreateModal';

export default function PostsCollectionsPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [collections, setCollections] = useState<MediaCollection[]>([]);
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<MediaCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkCreateModal, setShowBulkCreateModal] = useState(false);
  const [isCreatingSubcollection, setIsCreatingSubcollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');
  const [editingCollection, setEditingCollection] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [collectionMediaCounts, setCollectionMediaCounts] = useState<Record<string, { videos: number; slideshows: number; subcollections: number }>>({});
  const [collectionMedias, setCollectionMedias] = useState<Record<string, { videos: any[]; slideshows: any[] }>>({});
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerRow = 6; // 6 items per row on desktop
  const rowsPerPage = 3; // 3 rows max
  const itemsPerPage = itemsPerRow * rowsPerPage; // 18 items per page
  
  // Utiliser directement collections pour l'affichage
  const allItems = collections;
  const totalPages = Math.ceil(allItems.length / itemsPerPage);

  useEffect(() => {
    if (user?.id) {
      loadCollections();
    }
  }, [user]);

  const loadCollections = async (parentId: string | null = null) => {
    if (!user?.id) return;
    
    setIsLoading(true);
    setCurrentParentId(parentId);
    setCurrentPage(1); // Reset pagination when navigating
    
    try {
      // Load collections for current level
      const data = await getUserCollections(user.id, parentId || undefined);
      
      // getUserCollections retourne déjà les collections filtrées par parent_id
      // Si parentId est fourni, on a seulement les enfants de ce parent
      // Si parentId est null/undefined, on a seulement les collections racines
      setCollections(data);
      
      // Load breadcrumbs if we're in a subcollection
      if (parentId) {
        const path = await getCollectionPath(parentId);
        setBreadcrumbs(path);
      } else {
        setBreadcrumbs([]);
      }
      
      // Load media counts and content for each collection
      const counts: Record<string, { videos: number; slideshows: number; subcollections: number }> = {};
      const medias: Record<string, { videos: any[]; slideshows: any[] }> = {};
      
      for (const collection of data) {
        const collectionData = await getCollectionWithMedia(collection.id);
        // Get subcollections count
        const subcollsCount = await getUserCollections(user.id, collection.id);
        
        counts[collection.id] = {
          videos: collectionData?.videos?.length || 0,
          slideshows: collectionData?.slideshows?.length || 0,
          subcollections: subcollsCount.length || 0
        };
        medias[collection.id] = {
          videos: collectionData?.videos || [],
          slideshows: collectionData?.slideshows || []
        };
      }
      setCollectionMediaCounts(counts);
      setCollectionMedias(medias);
    } catch (error) {
      console.error('Error loading collections:', error);
      toast.error('Failed to load collections');
    } finally {
      setIsLoading(false);
    }
  };

  const [isCreating, setIsCreating] = useState(false);
  
  const handleCreateCollection = async () => {
    if (!user?.id || !newCollectionName.trim()) {
      toast.error('Please enter a collection name');
      return;
    }
    
    if (isCreating) return; // Prevent double submission

    setIsCreating(true);
    try {
      const parentId = isCreatingSubcollection ? currentParentId : null;
      await createCollection(
        user.id, 
        newCollectionName, 
        newCollectionDescription || undefined,
        parentId || undefined
      );
      toast.success(isCreatingSubcollection ? 'Subcollection created successfully' : 'Collection created successfully');
      setNewCollectionName('');
      setNewCollectionDescription('');
      setShowCreateModal(false);
      setIsCreatingSubcollection(false);
      loadCollections(currentParentId);
    } catch (error) {
      console.error('Error creating collection:', error);
      toast.error('Failed to create collection');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateCollection = async (collectionId: string) => {
    if (!editingName.trim()) {
      toast.error('Collection name cannot be empty');
      return;
    }

    try {
      await updateCollection(collectionId, editingName);
      toast.success('Collection updated successfully');
      setEditingCollection(null);
      loadCollections();
    } catch (error) {
      console.error('Error updating collection:', error);
      toast.error('Failed to update collection');
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    try {
      await deleteCollection(collectionId);
      toast.success('Collection deleted successfully');
      setShowDeleteConfirm(null);
      loadCollections();
    } catch (error) {
      console.error('Error deleting collection:', error);
      toast.error('Failed to delete collection');
    }
  };

  const handleBulkCreate = async (titles: string[]) => {
    if (!user?.id) return;
    
    let successCount = 0;
    let failCount = 0;
    
    for (const title of titles) {
      try {
        const parentId = isCreatingSubcollection ? currentParentId : null;
        await createCollection(
          user.id,
          title,
          undefined,
          parentId || undefined
        );
        successCount++;
      } catch (error) {
        console.error(`Failed to create collection: ${title}`, error);
        failCount++;
      }
    }
    
    if (successCount > 0) {
      toast.success(`Created ${successCount} ${isCreatingSubcollection ? 'subcollection' : 'collection'}${successCount > 1 ? 's' : ''}`);
    }
    if (failCount > 0) {
      toast.error(`Failed to create ${failCount} ${isCreatingSubcollection ? 'subcollection' : 'collection'}${failCount > 1 ? 's' : ''}`);
    }
    
    loadCollections(currentParentId);
  };

  const openCollection = (collection: MediaCollection) => {
    // Si la collection a des sous-collections, naviguer dedans
    const count = collectionMediaCounts[collection.id];
    if (count?.subcollections > 0) {
      loadCollections(collection.id);
    } else {
      // Sinon, ouvrir la page de détail
      router.push(`/posts-collections/${collection.id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading collections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f3f4f0' }}>
      <div className="px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          {/* Breadcrumb */}
          {(breadcrumbs.length > 0 || currentParentId) && (
            <div className="flex items-center gap-2 mb-4 text-sm">
              <button
                onClick={() => loadCollections(null)}
                className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
              >
                <Home size={16} />
                Root
              </button>
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb.id}>
                  <ChevronRight size={16} className="text-gray-400" />
                  <button
                    onClick={() => loadCollections(idx === breadcrumbs.length - 1 ? crumb.id : crumb.parent_id)}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {currentParentId && breadcrumbs.length > 0 
                  ? breadcrumbs[breadcrumbs.length - 1].name 
                  : 'Posts Collections'}
              </h1>
              <p className="text-gray-600 mt-1">
                {currentParentId ? 'Browse subcollections and content' : 'Organize your generated videos and slideshows'}
              </p>
              {allItems.length > 0 && (
                <p className="text-gray-500 text-sm mt-2">
                  Showing {Math.min(itemsPerPage, allItems.length - (currentPage - 1) * itemsPerPage)} of {allItems.length} items
                  {totalPages > 1 && ` • Page ${currentPage} of ${totalPages}`}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {currentParentId && (
                <button
                  onClick={() => loadCollections(breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2].id : null)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  <ArrowLeft size={20} />
                  Back
                </button>
              )}
              <button
                onClick={() => {
                  setIsCreatingSubcollection(!!currentParentId);
                  setShowCreateModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <FolderPlus size={20} />
                {currentParentId ? 'New Subcollection' : 'New Collection'}
              </button>
              <button
                onClick={() => {
                  setIsCreatingSubcollection(!!currentParentId);
                  setShowBulkCreateModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Layers size={20} />
                Bulk Create
              </button>
            </div>
          </div>
        </div>

        {/* Collections Grid */}
        {allItems.length > 0 ? (
          <>
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {allItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(collection => {
              const mediaCount = collectionMediaCounts[collection.id];
              const totalItems = (mediaCount?.videos || 0) + (mediaCount?.slideshows || 0);
              
              return (
                <div
                  key={collection.id}
                  className="group flex flex-col cursor-pointer shadow-lg hover:shadow-xl transition-shadow rounded-lg overflow-hidden"
                >
                  {editingCollection === collection.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateCollection(collection.id)}
                          className="flex-1 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          <Check size={16} className="mx-auto" />
                        </button>
                        <button
                          onClick={() => setEditingCollection(null)}
                          className="flex-1 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                        >
                          <X size={16} className="mx-auto" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Thumbnail area with grid preview */}
                      <div 
                        className="relative aspect-square rounded-t-lg bg-[#1a1a1a] overflow-hidden"
                        onClick={() => openCollection(collection)}
                      >
                        {(() => {
                          const allMedia = [
                            ...(collectionMedias[collection.id]?.videos || []),
                            ...(collectionMedias[collection.id]?.slideshows || [])
                          ].slice(0, 3);
                          
                          if (allMedia.length > 0) {
                            return (
                              <div className="w-full h-full grid grid-cols-3 grid-rows-2 gap-0.5">
                                {/* First item - large, takes left 2/3 */}
                                {allMedia[0] && (
                                  <div className="col-span-2 row-span-2">
                                    {allMedia[0].file_url ? (
                                      <video 
                                        src={allMedia[0].file_url} 
                                        className="w-full h-full object-cover"
                                        muted
                                      />
                                    ) : (
                                      <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                        <Video className="w-12 h-12 text-gray-500" />
                                      </div>
                                    )}
                                  </div>
                                )}
                                {/* Second item - top right */}
                                {allMedia[1] ? (
                                  <div className="col-span-1 row-span-1">
                                    {allMedia[1].file_url ? (
                                      <video 
                                        src={allMedia[1].file_url} 
                                        className="w-full h-full object-cover"
                                        muted
                                      />
                                    ) : (
                                      <div className="w-full h-full bg-gray-700"></div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="col-span-1 row-span-1 bg-[#2a2a2a]"></div>
                                )}
                                {/* Third item - bottom right */}
                                {allMedia[2] ? (
                                  <div className="col-span-1 row-span-1">
                                    {allMedia[2].file_url ? (
                                      <video 
                                        src={allMedia[2].file_url} 
                                        className="w-full h-full object-cover"
                                        muted
                                      />
                                    ) : (
                                      <div className="w-full h-full bg-gray-700"></div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="col-span-1 row-span-1 bg-[#2a2a2a]"></div>
                                )}
                              </div>
                            );
                          } else {
                            return (
                              <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                <Folder className="w-20 h-20 text-gray-400" />
                              </div>
                            );
                          }
                        })()}
                        
                        {/* Action buttons */}
                        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCollection(collection.id);
                              setEditingName(collection.name);
                            }}
                            className="p-1.5 bg-blue-500 text-white rounded-full hover:bg-blue-600"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteConfirm(collection.id);
                            }}
                            className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        
                        {/* Badge with item count and subcollections */}
                        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                          {mediaCount?.subcollections > 0 && (
                            <span className="flex items-center gap-1">
                              <FolderOpen size={12} />
                              {mediaCount.subcollections} subcollection{mediaCount.subcollections > 1 ? 's' : ''}
                            </span>
                          )}
                          {mediaCount?.subcollections > 0 && totalItems > 0 && ' • '}
                          {totalItems > 0 && `${totalItems} ${totalItems === 1 ? 'item' : 'items'}`}
                        </div>
                      </div>
                      
                      {/* Collection info */}
                      <div className="p-3 bg-white rounded-b-lg">
                        <h3 className="font-semibold text-gray-900 truncate">{collection.name}</h3>
                        {collection.description && (
                          <p className="text-sm text-gray-600 truncate mt-1">{collection.description}</p>
                        )}
                        <div className="flex gap-3 mt-2 text-xs text-gray-500">
                          {mediaCount?.videos > 0 && (
                            <span className="flex items-center gap-1">
                              <Video size={12} />
                              {mediaCount.videos} videos
                            </span>
                          )}
                          {mediaCount?.slideshows > 0 && (
                            <span className="flex items-center gap-1">
                              <Image size={12} />
                              {mediaCount.slideshows} slideshows
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          
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
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
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
          <div className="text-center py-16">
            <Folder size={64} className="mx-auto mb-4 text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No collections yet</h2>
            <p className="text-gray-500 mb-6">Create your first collection to organize your content</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <FolderPlus size={20} />
              Create Collection
            </button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">
              {isCreatingSubcollection ? 'Create New Subcollection' : 'Create New Collection'}
            </h2>
            {isCreatingSubcollection && breadcrumbs.length > 0 && (
              <p className="text-sm text-gray-600 mb-4">
                Creating subcollection in: <span className="font-medium">{breadcrumbs[breadcrumbs.length - 1].name}</span>
              </p>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Collection Name
                </label>
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="My Collection"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={newCollectionDescription}
                  onChange={(e) => setNewCollectionDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe your collection..."
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateCollection}
                disabled={isCreating}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewCollectionName('');
                  setNewCollectionDescription('');
                }}
                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4">Delete Collection</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this collection? The items inside will not be deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDeleteCollection(showDeleteConfirm)}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Create Modal */}
      <BulkCreateModal
        isOpen={showBulkCreateModal}
        onClose={() => {
          setShowBulkCreateModal(false);
          setIsCreatingSubcollection(false);
        }}
        onConfirm={handleBulkCreate}
        title={isCreatingSubcollection ? 'Bulk Create Subcollections' : 'Bulk Create Collections'}
        itemType={isCreatingSubcollection ? 'subcollection' : 'collection'}
        parentName={isCreatingSubcollection && breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].name : undefined}
      />
    </div>
  );
}