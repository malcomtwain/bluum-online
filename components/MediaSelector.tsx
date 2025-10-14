import { useAppState } from '../hooks/useAppState';
import { FileUpload } from './FileUpload';

export const MediaSelector = () => {
  const {
    mediaFiles,
    selectedSongs,
    addMediaFile,
    removeMediaFile,
    addSong,
    removeSong,
  } = useAppState();

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="space-y-8">
        {/* Media Files Section */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Media Files</h2>
          <div className="space-y-4">
            <FileUpload
              type="media"
              onUploadComplete={(url) => addMediaFile({ type: 'image', url, duration: 3 })}
              accept={{
                'image/*': ['.png', '.jpg', '.jpeg'],
                'video/*': ['.mp4', '.mov'],
              }}
              maxFiles={5}
            />
            {mediaFiles.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {mediaFiles.map((file) => (
                  <div key={file.id} className="relative group">
                    {file.type === 'image' ? (
                      <img
                        src={file.url}
                        alt="Media"
                        className="w-full h-32 object-cover rounded-lg"
                      />
                    ) : (
                      <video
                        src={file.url}
                        className="w-full h-32 object-cover rounded-lg"
                        controls
                      />
                    )}
                    <button
                      onClick={() => removeMediaFile(file.id)}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Music Section */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Background Music</h2>
          <div className="space-y-4">
            <FileUpload
              type="music"
              onUploadComplete={(url) => addSong({ url })}
              accept={{
                'audio/*': ['.mp3', '.wav'],
              }}
              maxFiles={3}
            />
            {selectedSongs.length > 0 && (
              <div className="space-y-2">
                {selectedSongs.map((song) => (
                  <div
                    key={song.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <audio
                      src={song.url}
                      controls
                      className="flex-1 mr-4"
                    />
                    <button
                      onClick={() => removeSong(song.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 