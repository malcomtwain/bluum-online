'use client';

import { useState } from 'react';
import { useVideoStore } from '@/store/videoStore';
import { Play, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

// Déclaration en dehors pour pouvoir la référencer sans erreur
let ffmpeg: any = null;
let fetchFile: any = null;

// Vérifier l'environnement du navigateur avant d'importer
if (typeof window !== 'undefined') {
  // Import dynamique côté client uniquement
  import('@ffmpeg/ffmpeg').then(FFmpeg => {
    const { createFFmpeg } = FFmpeg;
    // Initialize FFmpeg with CORS settings
    ffmpeg = createFFmpeg({
      log: true,
      corePath: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/ffmpeg-core.js',
    });
  }).catch(err => {
    console.error('Erreur lors du chargement de FFmpeg:', err);
  });
  
  import('@ffmpeg/util').then(Util => {
    fetchFile = Util.fetchFile;
  }).catch(err => {
    console.error('Erreur lors du chargement de FFmpeg util:', err);
  });
}

export default function VideoGenerator() {
  const {
    generatedImages,
    mediaFiles,
    selectedSongs,
    generatedVideos,
    addGeneratedVideo
  } = useVideoStore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState('');

  const totalPossibleVideos = generatedImages.length * mediaFiles.length;

  const generateVideo = async (
    image: typeof generatedImages[0], 
    media: typeof mediaFiles[0], 
    song: typeof selectedSongs[0] | null
  ) => {
    if (!ffmpeg || !fetchFile) {
      console.error('FFmpeg or fetchFile not initialized');
      throw new Error('FFmpeg not available');
    }
    
    if (!ffmpeg.isLoaded()) {
      await ffmpeg.load();
    }

    try {
      // Write files to MEMFS
      ffmpeg.FS('writeFile', 'template.png', await fetchFile(image.url));
      ffmpeg.FS('writeFile', 'media.' + (media.type === 'video' ? 'mp4' : 'png'), await fetchFile(media.url));
      
      // Write song file only if a song is provided
      if (song) {
        ffmpeg.FS('writeFile', 'audio.mp3', await fetchFile(song.url));
      }

      // Complex filter for template positioning and overlay
      const templateDuration = 3; // Get this from store
      const complexFilter = [
        // Scale template to 1080x1920 maintaining aspect ratio
        '[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2[template];',
        // Scale media to 1080x1920
        '[1:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2[media];',
        // Overlay template on media with timing
        '[media][template]overlay=0:0:enable=\'between(t,0,${templateDuration})\'[v1]'
      ].join('');

      // Build FFmpeg command
      const command = [
        '-i', 'template.png',
        '-i', media.type === 'video' ? 'media.mp4' : 'media.png',
        ...(song ? ['-i', 'audio.mp3'] : []),
        '-filter_complex', complexFilter,
        '-map', '[v1]',
        ...(song ? ['-map', '2:a'] : []),
        '-t', String(media.duration + templateDuration),
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-c:a', 'aac',
        'output.mp4'
      ];

      // Run FFmpeg command
      await ffmpeg.run(...command);

      // Read the output file
      const data = ffmpeg.FS('readFile', 'output.mp4');
      const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));

      // Clean up files
      ffmpeg.FS('unlink', 'template.png');
      ffmpeg.FS('unlink', media.type === 'video' ? 'media.mp4' : 'media.png');
      if (song) {
        ffmpeg.FS('unlink', 'audio.mp3');
      }
      ffmpeg.FS('unlink', 'output.mp4');

      return url;
    } catch (error) {
      console.error('Error in generateVideo:', error);
      throw error;
    }
  };

  const handleGenerateVideos = async () => {
    setIsGenerating(true);
    setProgress(0);
    
    let completed = 0;
    const total = totalPossibleVideos;

    for (const image of generatedImages) {
      for (const media of mediaFiles) {
        setCurrentTask(`Generating video ${completed + 1} of ${total}`);
        
        try {
          // Use the first song if available, or no song if none selected
          const song = selectedSongs.length > 0 ? selectedSongs[0] : null;
          const videoUrl = await generateVideo(image, media, song);
          
          addGeneratedVideo({
            url: videoUrl,
            template: image.url,
            media: media.url,
            hook: image.hook,
            font: image.font
          });
        } catch (error) {
          console.error('Error generating video:', error);
        }

        completed++;
        setProgress((completed / total) * 100);
      }
    }

    setIsGenerating(false);
  };

  return (
    <div className="space-y-6 p-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="text-lg font-medium">Video Generation</h3>
          <p className="text-sm text-gray-500">
            Total possible videos: {totalPossibleVideos}
          </p>
        </div>

        <Button
          onClick={handleGenerateVideos}
          disabled={isGenerating || totalPossibleVideos === 0 || !ffmpeg || !fetchFile}
        >
          {isGenerating ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Play className="w-4 h-4 mr-2" />
          )}
          Generate Videos
        </Button>
      </div>

      {isGenerating && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">{currentTask}</p>
          <Progress value={progress} />
        </div>
      )}

      {generatedVideos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {generatedVideos.map((video, index) => (
            <div key={index} className="space-y-2">
              <div className="relative aspect-[9/16] bg-black rounded-lg overflow-hidden">
                <video
                  src={video.url}
                  controls
                  className="absolute inset-0 w-full h-full"
                />
              </div>
              
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium truncate">{video.hook}</p>
                  <p className="text-sm text-gray-500">{video.font}</p>
                </div>
                
                <a
                  href={video.url}
                  download={`bluum-video-${index + 1}.mp4`}
                  className="p-2 text-blue-500 hover:text-blue-600"
                >
                  <Download className="w-5 h-5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 