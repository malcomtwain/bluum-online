'use client';

import { useCallback, useState } from 'react';
import { useVideoStore } from '@/store/videoStore';
import { Upload, X, Video, Image as ImageIcon } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import { Slider } from '@/components/ui/slider';

export default function UploadPart2() {
  const { mediaFiles, addMediaFile, removeMediaFile } = useVideoStore();
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const url = e.target?.result as string;
        const type = file.type.startsWith('video/') ? 'video' : 'image';
        
        // For videos, we need to get the duration
        let duration = 3; // Default duration for images
        if (type === 'video') {
          const video = document.createElement('video');
          video.src = url;
          await new Promise((resolve) => {
            video.onloadedmetadata = () => {
              duration = video.duration;
              resolve(null);
            };
          });
        }
        
        addMediaFile({ type, url, duration });
      };
      
      reader.readAsDataURL(file);
    }
  }, [addMediaFile]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'video/*': ['.mp4', '.webm', '.mov']
    },
    multiple: true
  });

  return (
    <div className="space-y-6 p-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center">
          <Upload className="w-12 h-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium">Drop your media files here</p>
          <p className="text-sm text-gray-500">or click to select files</p>
          <p className="text-xs text-gray-400 mt-2">Supports images and videos</p>
        </div>
      </div>

      {mediaFiles.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {mediaFiles.map((file) => (
            <div key={file.id} className="relative group">
              <div className="aspect-video w-full relative rounded-lg overflow-hidden border border-gray-200">
                {file.type === 'video' ? (
                  <video
                    src={file.url}
                    className="w-full h-full object-cover"
                    controls
                  />
                ) : (
                  <Image
                    src={file.url}
                    alt="Media"
                    fill
                    className="object-cover"
                  />
                )}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => removeMediaFile(file.id)}
                    className="bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
                  {file.type === 'video' ? (
                    <>
                      <Video className="w-3 h-3" />
                      {file.duration.toFixed(1)}s
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-3 h-3" />
                      {file.duration}s
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 