"use client";

import React, { useState, useEffect } from 'react';
import { ChevronLeft, Upload, Search, Trash2, Video, X, Download, Calendar, Share2, Play, ArrowUpDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { uploadToSupabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

// Video Modal Component
const VideoModal = ({ video, onClose, onDelete }: { 
  video: VideoFile; 
  onClose: () => void; 
  onDelete: (id: string) => void; 
}) => (
  <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999]" onClick={onClose}>
    <div className="bg-white rounded-xl max-w-4xl w-full mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <div className="flex">
        <div className="flex-1 bg-black">
          <video 
            src={video.url}
            className="w-full h-96 object-contain"
            controls
            autoPlay
          />
        </div>
        <div className="w-80 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold" style={{ color: '#333333' }}>Video Actions</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X size={20} />
            </button>
          </div>
          <div className="space-y-3">
            <button 
              onClick={() => {
                if (confirm('Are you sure you want to delete this video?')) {
                  onDelete(video.id);
                  onClose();
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-white rounded-lg font-medium bg-red-500 hover:bg-red-600"
            >
              <Trash2 size={16} />
              Delete Video
            </button>
            <button 
              onClick={onClose}
              className="w-full flex items-center justify-center px-4 py-3 text-gray-600 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
            >
              Close
            </button>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="font-medium mb-2" style={{ color: '#333333' }}>Video Info</h4>
            <p className="text-sm text-gray-600 mb-1">{video.fileName}</p>
            <p className="text-sm text-gray-500">{(video.size / (1024 * 1024)).toFixed(1)} MB</p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

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

export default function CollectionPage({ params }: { params: { collectionId: string } }) {
  const router = useRouter();
  const { user } = useAuth();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showingPage, setShowingPage] = useState(1);
  const [selectedVideoForModal, setSelectedVideoForModal] = useState<VideoFile | null>(null);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Load collection from localStorage
  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(`video-collections-${user.id}`);
      if (saved) {
        try {
          const collections: Collection[] = JSON.parse(saved);
          const foundCollection = collections.find(c => c.id === params.collectionId);
          setCollection(foundCollection || null);
        } catch (e) {
          console.error('Error parsing saved collections:', e);
        }
      }
    }
  }, [user, params.collectionId]);

  // Save collection back to localStorage when it changes
  useEffect(() => {
    if (user && collection) {
      const saved = localStorage.getItem(`video-collections-${user.id}`);
      if (saved) {
        try {
          const collections: Collection[] = JSON.parse(saved);
          const updatedCollections = collections.map(c => 
            c.id === collection.id ? collection : c
          );
          localStorage.setItem(`video-collections-${user.id}`, JSON.stringify(updatedCollections));
        } catch (e) {
          console.error('Error updating collections:', e);
        }
      }
    }
  }, [collection, user]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !user || !collection) {
      toast.error('Please sign in to upload videos');
      return;
    }

    setIsLoading(true);
    const newVideos: VideoFile[] = [];
    
    try {
      for (const file of Array.from(files)) {
        if (file.type.startsWith('video/')) {
          toast.loading(`Uploading ${file.name}...`);
          
          // Upload to Supabase Storage
          const url = await uploadToSupabase(file, 'video', user.id);
          
          const videoFile: VideoFile = {
            id: Date.now().toString() + Math.random(),
            fileName: file.name,
            url,
            size: file.size,
            uploadedAt: new Date()
          };
          newVideos.push(videoFile);
          
          toast.dismiss();
          toast.success(`${file.name} uploaded successfully`);
        }
      }

      if (newVideos.length > 0) {
        setCollection(prev => prev ? {
          ...prev,
          videos: [...prev.videos, ...newVideos],
          thumbnail: prev.videos.length === 0 && newVideos.length > 0 ? newVideos[0].url : prev.thumbnail
        } : null);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.dismiss();
      toast.error('Failed to upload videos');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteVideo = (videoId: string) => {
    if (collection) {
      setCollection({
        ...collection,
        videos: collection.videos.filter(v => v.id !== videoId)
      });
    }
  };

  const toggleVideoSelection = (videoId: string) => {
    setSelectedVideos(prev => 
      prev.includes(videoId) 
        ? prev.filter(id => id !== videoId)
        : [...prev, videoId]
    );
  };

  const deleteSelectedVideos = () => {
    if (collection) {
      setCollection({
        ...collection,
        videos: collection.videos.filter(v => !selectedVideos.includes(v.id))
      });
      setSelectedVideos([]);
    }
  };

  const filteredVideos = collection 
    ? collection.videos
        .filter(video => 
          video.fileName.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
          const dateA = new Date(a.uploadedAt).getTime();
          const dateB = new Date(b.uploadedAt).getTime();
          return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        })
    : [];

  const videosPerPage = 18;
  const totalPages = Math.ceil(filteredVideos.length / videosPerPage);
  const startIndex = (showingPage - 1) * videosPerPage;
  const currentVideos = filteredVideos.slice(startIndex, startIndex + videosPerPage);

  if (!collection) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Collection not found</h2>
          <button 
            onClick={() => router.push('/videos')}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg"
          >
            Back to Collections
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f3f4f0' }}>
        <div className="p-4 xl:p-6">
          <div className="pt-8 xl:pt-8">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => router.push('/videos')}
                  className="p-2 rounded-lg hover:bg-white/50"
                >
                  <ChevronLeft size={20} style={{ color: '#1e1e1e' }} />
                </button>
                <div>
                  <h1 className="text-2xl font-semibold" style={{ color: '#333333' }}>
                    {collection.name}
                  </h1>
                  <p className="text-sm text-gray-600">
                    {collection.videos.length} videos
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {selectedVideos.length > 0 && (
                  <button 
                    onClick={deleteSelectedVideos}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                  >
                    <Trash2 size={16} />
                    Delete Selected ({selectedVideos.length})
                  </button>
                )}
                
                <label className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white cursor-pointer ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                       style={{ backgroundColor: '#f44e17' }}>
                  <Upload size={16} />
                  {isLoading ? 'Uploading...' : 'Upload Videos'}
                  <input 
                    type="file" 
                    multiple 
                    accept="video/*"
                    className="hidden"
                    disabled={isLoading}
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </div>

            {/* Search and Sort */}
            <div className="mb-6 flex gap-4">
              <div className="relative flex-1">
                <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search videos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-[#d0d0ce] bg-white"
                  style={{ color: '#1e1e1e' }}
                />
              </div>
              <button
                onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
                className="flex items-center gap-2 px-4 py-3 rounded-lg border border-[#d0d0ce] bg-white hover:bg-gray-50 whitespace-nowrap"
                style={{ color: '#1e1e1e' }}
              >
                <ArrowUpDown size={16} />
                <span className="text-sm font-medium">
                  {sortOrder === 'newest' ? 'Most Recent' : 'Oldest First'}
                </span>
              </button>
            </div>

            {/* Videos Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 mb-8">
              {currentVideos.map((video) => (
                <div 
                  key={video.id}
                  className="relative group cursor-pointer"
                  onClick={() => setSelectedVideoForModal(video)}
                >
                  <div className="aspect-square bg-white rounded-lg border border-gray-300 p-4 flex items-center justify-center">
                    <video 
                      src={video.url}
                      className="w-full h-full object-contain rounded"
                      muted
                    />
                    
                    {/* Checkbox */}
                    <div className="absolute top-3 left-3" onClick={(e) => e.stopPropagation()}>
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

            {/* Empty state */}
            {filteredVideos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-[#d0d0ce]">
                <Video size={48} className="text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2" style={{ color: '#1e1e1e' }}>
                  No videos yet
                </h3>
                <p className="text-gray-500 mb-6 text-center max-w-md">
                  Drag and drop your video files here or click the upload button to get started
                </p>
                <label className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white cursor-pointer ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                       style={{ backgroundColor: '#f44e17' }}>
                  <Upload size={16} />
                  {isLoading ? 'Uploading...' : 'Upload Videos'}
                  <input 
                    type="file" 
                    multiple 
                    accept="video/*"
                    className="hidden"
                    disabled={isLoading}
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-8">
                <button
                  onClick={() => setShowingPage(Math.max(1, showingPage - 1))}
                  disabled={showingPage === 1}
                  className="px-4 py-2 rounded-lg border border-[#d0d0ce] bg-white disabled:opacity-50"
                  style={{ color: '#1e1e1e' }}
                >
                  Previous
                </button>
                
                <span className="px-4 py-2" style={{ color: '#1e1e1e' }}>
                  Page {showingPage} of {totalPages}
                </span>
                
                <button
                  onClick={() => setShowingPage(Math.min(totalPages, showingPage + 1))}
                  disabled={showingPage === totalPages}
                  className="px-4 py-2 rounded-lg border border-[#d0d0ce] bg-white disabled:opacity-50"
                  style={{ color: '#1e1e1e' }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Video Modal */}
      {selectedVideoForModal && (
        <VideoModal 
          video={selectedVideoForModal}
          onClose={() => setSelectedVideoForModal(null)}
          onDelete={deleteVideo}
        />
      )}
    </>
  );
}