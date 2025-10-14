"use client";

import React, { useState, useEffect } from 'react';
import { 
  Folder, FolderPlus, ChevronRight, ChevronDown, 
  MoreVertical, Edit2, Trash2, Move, Star,
  Video, Image, Grid, List
} from 'lucide-react';
import { 
  MediaCollection, 
  getUserCollections, 
  createCollection, 
  deleteCollection,
  moveMultipleItemsToCollection,
  getCollectionContent
} from '@/lib/media-collections';
import { toast } from 'sonner';

interface CollectionManagerProps {
  userId: string;
  selectedItems: { type: 'video' | 'slideshow'; id: string }[];
  onCollectionSelect: (collectionId: string | null) => void;
  currentCollectionId: string | null;
}

export default function CollectionManager({ 
  userId, 
  selectedItems, 
  onCollectionSelect,
  currentCollectionId 
}: CollectionManagerProps) {
  const [collections, setCollections] = useState<MediaCollection[]>([]);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [newCollection, setNewCollection] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    icon: 'folder'
  });

  useEffect(() => {
    loadCollections();
  }, [userId]);

  const loadCollections = async () => {
    setIsLoading(true);
    try {
      const userCollections = await getUserCollections(userId);
      setCollections(userCollections);
    } catch (error) {
      console.error('Error loading collections:', error);
      toast.error('Failed to load collections');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollection.name.trim()) {
      toast.error('Please enter a collection name');
      return;
    }

    try {
      const collection = await createCollection(
        userId,
        newCollection.name,
        newCollection.description,
        currentCollectionId || undefined,
        'mixed',
        newCollection.color,
        newCollection.icon
      );

      if (collection) {
        toast.success('Collection created successfully');
        await loadCollections();
        setShowCreateModal(false);
        setNewCollection({ name: '', description: '', color: '#3B82F6', icon: 'folder' });
      }
    } catch (error) {
      console.error('Error creating collection:', error);
      toast.error('Failed to create collection');
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    if (!confirm('Are you sure you want to delete this collection? Items inside will not be deleted.')) {
      return;
    }

    try {
      await deleteCollection(collectionId);
      toast.success('Collection deleted successfully');
      await loadCollections();
    } catch (error) {
      console.error('Error deleting collection:', error);
      toast.error('Failed to delete collection');
    }
  };

  const handleMoveItems = async (targetCollectionId: string | null) => {
    if (selectedItems.length === 0) {
      toast.error('No items selected');
      return;
    }

    try {
      await moveMultipleItemsToCollection(selectedItems, targetCollectionId);
      toast.success(`Moved ${selectedItems.length} items successfully`);
      setShowMoveModal(false);
      window.location.reload(); // Refresh to show updated content
    } catch (error) {
      console.error('Error moving items:', error);
      toast.error('Failed to move items');
    }
  };

  const toggleExpanded = (collectionId: string) => {
    setExpandedCollections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(collectionId)) {
        newSet.delete(collectionId);
      } else {
        newSet.add(collectionId);
      }
      return newSet;
    });
  };

  const renderCollection = (collection: MediaCollection, level: number = 0) => {
    const isExpanded = expandedCollections.has(collection.id);
    const isSelected = currentCollectionId === collection.id;
    const hasSubcollections = collection.stats?.subcollections && collection.stats.subcollections > 0;

    return (
      <div key={collection.id} style={{ marginLeft: `${level * 20}px` }}>
        <div 
          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-gray-100 ${
            isSelected ? 'bg-blue-50 border border-blue-200' : ''
          }`}
          onClick={() => onCollectionSelect(collection.id)}
        >
          {hasSubcollections && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(collection.id);
              }}
              className="p-0.5"
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
          
          <div 
            className="w-4 h-4 rounded"
            style={{ backgroundColor: collection.color }}
          />
          
          <Folder size={18} />
          
          <span className="flex-1 text-sm font-medium">{collection.name}</span>
          
          {collection.stats && (
            <span className="text-xs text-gray-500">
              {collection.stats.total_items}
            </span>
          )}
          
          <div className="opacity-0 group-hover:opacity-100 flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteCollection(collection.id);
              }}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        
        {isExpanded && hasSubcollections && (
          <div className="mt-1">
            {/* Render subcollections here */}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Collection Sidebar */}
      <div className="w-64 bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Collections</h3>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-1.5 hover:bg-gray-100 rounded-lg"
            title="Create new collection"
          >
            <FolderPlus size={18} />
          </button>
        </div>
        
        {/* Root level - All Media */}
        <div 
          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-gray-100 mb-2 ${
            currentCollectionId === null ? 'bg-blue-50 border border-blue-200' : ''
          }`}
          onClick={() => onCollectionSelect(null)}
        >
          <Grid size={18} />
          <span className="flex-1 text-sm font-medium">All Media</span>
        </div>
        
        {/* User Collections */}
        <div className="space-y-1">
          {collections.map(collection => renderCollection(collection))}
        </div>
        
        {/* Move Items Button */}
        {selectedItems.length > 0 && (
          <button
            onClick={() => setShowMoveModal(true)}
            className="w-full mt-4 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <Move size={16} />
            Move {selectedItems.length} items
          </button>
        )}
      </div>

      {/* Create Collection Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold mb-4">Create New Collection</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newCollection.name}
                  onChange={(e) => setNewCollection({ ...newCollection, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="My Collection"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={newCollection.description}
                  onChange={(e) => setNewCollection({ ...newCollection, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Describe this collection..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color
                </label>
                <div className="flex gap-2">
                  {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'].map(color => (
                    <button
                      key={color}
                      onClick={() => setNewCollection({ ...newCollection, color })}
                      className={`w-8 h-8 rounded-lg ${
                        newCollection.color === color ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCollection}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Items Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold mb-4">Move {selectedItems.length} items to...</h3>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              <button
                onClick={() => handleMoveItems(null)}
                className="w-full text-left p-3 hover:bg-gray-100 rounded-lg flex items-center gap-2"
              >
                <Grid size={18} />
                <span>All Media (root)</span>
              </button>
              
              {collections.map(collection => (
                <button
                  key={collection.id}
                  onClick={() => handleMoveItems(collection.id)}
                  className="w-full text-left p-3 hover:bg-gray-100 rounded-lg flex items-center gap-2"
                  disabled={collection.id === currentCollectionId}
                >
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: collection.color }}
                  />
                  <Folder size={18} />
                  <span className="flex-1">{collection.name}</span>
                  {collection.id === currentCollectionId && (
                    <span className="text-xs text-gray-500">(current)</span>
                  )}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setShowMoveModal(false)}
              className="w-full mt-4 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}