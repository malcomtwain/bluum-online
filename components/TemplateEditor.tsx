import { useState, useRef, useEffect } from 'react';
import { useAppState } from '../hooks/useAppState';
import { FileUpload } from './FileUpload';

export const TemplateEditor = () => {
  const {
    templateImage,
    templatePosition,
    templateDuration,
    setTemplateImage,
    setTemplatePosition,
    setTemplateDuration,
  } = useAppState();

  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.MouseEvent) => {
    if (!templateImage) return;
    setIsDragging(true);
    setStartPos({
      x: e.clientX - templatePosition.x,
      y: e.clientY - templatePosition.y,
    });
  };

  const handleDragMove = (e: React.MouseEvent) => {
    if (!isDragging || !templateImage) return;
    setTemplatePosition({
      x: e.clientX - startPos.x,
      y: e.clientY - startPos.y,
      scale: templatePosition.scale,
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!templateImage) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTemplatePosition({
      ...templatePosition,
      scale: Math.max(0.1, Math.min(5, templatePosition.scale * delta)),
    });
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove as any);
      window.addEventListener('mouseup', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove as any);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging]);

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">Template Editor</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (seconds)
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={templateDuration}
              onChange={(e) => setTemplateDuration(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {!templateImage && (
            <FileUpload
              type="template"
              onUploadComplete={setTemplateImage}
              accept={{
                'image/*': ['.png', '.jpg', '.jpeg'],
              }}
            />
          )}
        </div>
      </div>

      {templateImage && (
        <div
          ref={containerRef}
          className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden"
          onWheel={handleWheel}
        >
          <div
            className="absolute cursor-move"
            style={{
              left: templatePosition.x,
              top: templatePosition.y,
              transform: `scale(${templatePosition.scale})`,
            }}
            onMouseDown={handleDragStart}
          >
            <img
              src={templateImage}
              alt="Template"
              className="max-w-none"
              draggable={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}; 