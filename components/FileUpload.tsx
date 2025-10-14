import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSupabase } from '../hooks/useSupabase';
import { useAppState } from '../hooks/useAppState';

interface FileUploadProps {
  type: 'template' | 'media' | 'music';
  onUploadComplete: (url: string) => void;
  accept?: Record<string, string[]>;
  maxFiles?: number;
}

export const FileUpload = ({ type, onUploadComplete, accept, maxFiles = 1 }: FileUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { uploadTemplate, uploadMedia, uploadMusic } = useSupabase();
  const { currentProjectId } = useAppState();

  const onDrop = async (acceptedFiles: File[]) => {
    if (!currentProjectId) {
      setError('No project selected');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      for (const file of acceptedFiles) {
        let url;
        switch (type) {
          case 'template':
            url = await uploadTemplate(
              file, 
              currentProjectId, 
              { x: 0, y: 0, scale: 1 },
              5
            );
            break;
          case 'media':
            url = await uploadMedia(
              file,
              currentProjectId,
              file.type.startsWith('image/') ? 'image' : 'video',
              0,
              0
            );
            break;
          case 'music':
            url = await uploadMusic(
              file,
              currentProjectId,
              0
            );
            break;
        }
        onUploadComplete(url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles,
  });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
      >
        <input {...getInputProps()} />
        {isUploading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2" />
            <p className="text-sm text-gray-600">Uploading...</p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600">
              {isDragActive
                ? 'Drop the files here'
                : `Drag and drop ${type} files here, or click to select files`}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {type === 'template' && 'Supported formats: PNG, JPG, JPEG'}
              {type === 'media' && 'Supported formats: MP4, MOV, PNG, JPG, JPEG'}
              {type === 'music' && 'Supported formats: MP3, WAV'}
            </p>
          </div>
        )}
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}; 