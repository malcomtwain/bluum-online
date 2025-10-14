import { useState } from 'react';
import { useAppState } from '../hooks/useAppState';
import { useSupabase } from '../hooks/useSupabase';

export const VideoGenerator = () => {
  const {
    templateImage,
    mediaFiles,
    selectedSongs,
    generatedImages,
    addGeneratedVideo,
    currentProjectId,
    generatedVideos,
  } = useAppState();

  const { generateVideo } = useSupabase();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateVideo = async () => {
    if (!templateImage) {
      setError('Please select a template image');
      return;
    }

    if (mediaFiles.length === 0) {
      setError('Please add at least one media file');
      return;
    }

    if (generatedImages.length === 0) {
      setError('Please generate at least one image with hooks');
      return;
    }

    if (!currentProjectId) {
      setError('No active project');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const video = await generateVideo(
        currentProjectId,
        generatedImages[0].id,
        mediaFiles[0].id,
        selectedSongs.length > 0 ? selectedSongs[0].id : null
      );

      addGeneratedVideo({
        url: video.url || video.storage_path || '',
        template: templateImage,
        media: mediaFiles[0].url,
        hook: generatedImages[0].hook,
        font: generatedImages[0].font,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate video');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="space-y-8">
        {/* Generate Video Button */}
        <div>
          <button
            onClick={handleGenerateVideo}
            disabled={isGenerating || !templateImage || mediaFiles.length === 0 || generatedImages.length === 0}
            className={`w-full px-4 py-2 rounded-md text-white transition-colors
              ${
                isGenerating || !templateImage || mediaFiles.length === 0 || generatedImages.length === 0
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600'
              }`}
          >
            {isGenerating ? 'Generating Video...' : 'Generate Video'}
          </button>
          {error && (
            <p className="mt-2 text-sm text-red-500">{error}</p>
          )}
        </div>

        {/* Requirements Checklist */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Requirements</h2>
          <ul className="space-y-2">
            <li className="flex items-center space-x-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 ${
                  templateImage ? 'text-green-500' : 'text-gray-400'
                }`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span className={templateImage ? 'text-gray-900' : 'text-gray-500'}>
                Template Image Selected
              </span>
            </li>
            <li className="flex items-center space-x-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 ${
                  mediaFiles.length > 0 ? 'text-green-500' : 'text-gray-400'
                }`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span className={mediaFiles.length > 0 ? 'text-gray-900' : 'text-gray-500'}>
                Media Files Added
              </span>
            </li>
            <li className="flex items-center space-x-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 ${
                  generatedImages.length > 0 ? 'text-green-500' : 'text-gray-400'
                }`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span className={generatedImages.length > 0 ? 'text-gray-900' : 'text-gray-500'}>
                Generated Images Available
              </span>
            </li>
          </ul>
        </div>

        {/* Generated Videos Preview */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Generated Videos</h2>
          <div className="grid grid-cols-1 gap-4">
            {generatedVideos.map((video) => (
              <div key={video.id} className="relative">
                <video
                  src={video.url}
                  controls
                  className="w-full rounded-lg"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}; 