'use client';

import { useCallback, useState } from 'react';
import { useVideoStore } from '@/store/videoStore';
import { Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import { Slider } from '@/components/ui/slider';

export default function UploadPart1() {
  const { templateImage, templatePosition, templateDuration, setTemplateImage, setTemplatePosition, setTemplateDuration } = useVideoStore();
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const reader = new FileReader();
      
      reader.onload = (e) => {
        setTemplateImage(e.target?.result as string);
      };
      
      reader.readAsDataURL(file);
    }
  }, [setTemplateImage]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif']
    },
    multiple: false
  });

  const handlePositionChange = (axis: 'x' | 'y', value: number) => {
    setTemplatePosition({
      ...templatePosition,
      [axis]: value
    });
  };

  const handleScaleChange = (value: number[]) => {
    setTemplatePosition({
      ...templatePosition,
      scale: value[0]
    });
  };

  const handleDurationChange = (value: number[]) => {
    setTemplateDuration(value[0]);
  };

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
        {templateImage ? (
          <div className="relative w-full aspect-video">
            <Image
              src={templateImage}
              alt="Template"
              fill
              className="object-contain"
              style={{
                transform: `translate(${templatePosition.x}px, ${templatePosition.y}px) scale(${templatePosition.scale})`
              }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium">Drop your template image here</p>
            <p className="text-sm text-gray-500">or click to select a file</p>
          </div>
        )}
      </div>

      {templateImage && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Horizontal Position</label>
            <Slider
              value={[templatePosition.x]}
              min={-100}
              max={100}
              step={1}
              onValueChange={(value) => handlePositionChange('x', value[0])}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Vertical Position</label>
            <Slider
              value={[templatePosition.y]}
              min={-100}
              max={100}
              step={1}
              onValueChange={(value) => handlePositionChange('y', value[0])}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Scale</label>
            <Slider
              value={[templatePosition.scale]}
              min={0.5}
              max={2}
              step={0.1}
              onValueChange={handleScaleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Duration (seconds)</label>
            <Slider
              value={[templateDuration]}
              min={1}
              max={10}
              step={0.5}
              onValueChange={handleDurationChange}
            />
          </div>
        </div>
      )}
    </div>
  );
} 