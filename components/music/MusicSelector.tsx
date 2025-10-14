'use client';

import { useCallback, useState } from 'react';
import { useVideoStore } from '@/store/videoStore';
import { Upload, X, Music } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

export default function MusicSelector() {
  const { selectedSongs, addSong, removeSong } = useVideoStore();
  const [isDragging, setIsDragging] = useState(false);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const url = e.target?.result as string;
        addSong({ url });
      };
      
      reader.readAsDataURL(file);
    }
  }, [addSong]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a']
    },
    multiple: true
  });

  const handlePlayPause = (songId: string, audioUrl: string) => {
    if (currentlyPlaying === songId) {
      const audio = document.getElementById(songId) as HTMLAudioElement;
      if (audio.paused) {
        audio.play();
      } else {
        audio.pause();
      }
    } else {
      // Stop currently playing song if any
      if (currentlyPlaying) {
        const currentAudio = document.getElementById(currentlyPlaying) as HTMLAudioElement;
        currentAudio?.pause();
      }
      
      // Play new song
      const newAudio = document.getElementById(songId) as HTMLAudioElement;
      newAudio?.play();
      setCurrentlyPlaying(songId);
    }
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
        <div className="flex flex-col items-center">
          <Upload className="w-12 h-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium">Drop your music files here</p>
          <p className="text-sm text-gray-500">or click to select files</p>
          <p className="text-xs text-gray-400 mt-2">Supports MP3, WAV, M4A</p>
        </div>
      </div>

      {selectedSongs.length > 0 && (
        <div className="space-y-4">
          {selectedSongs.map((song) => (
            <div
              key={song.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handlePlayPause(song.id, song.url)}
                  className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600"
                >
                  <Music className="w-4 h-4" />
                </button>
                <audio
                  id={song.id}
                  src={song.url}
                  onEnded={() => setCurrentlyPlaying(null)}
                  className="hidden"
                />
                <span className="font-medium">Music Track {selectedSongs.indexOf(song) + 1}</span>
              </div>
              
              <button
                onClick={() => {
                  if (currentlyPlaying === song.id) {
                    const audio = document.getElementById(song.id) as HTMLAudioElement;
                    audio?.pause();
                    setCurrentlyPlaying(null);
                  }
                  removeSong(song.id);
                }}
                className="p-1 text-red-500 hover:text-red-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 