import React, { useRef, useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  IconButton,
  Slider,
  Typography,
  Stack,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  VolumeUp,
  VolumeOff,
} from '@mui/icons-material';

const VideoPreview = ({
  videoFile,
  textSettings,
  hookText,
  musicFile,
  isPart1 = true,
}) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (videoFile) {
      const videoUrl = URL.createObjectURL(videoFile);
      videoRef.current.src = videoUrl;
      return () => URL.revokeObjectURL(videoUrl);
    }
  }, [videoFile]);

  useEffect(() => {
    if (musicFile) {
      const audioElement = new Audio(URL.createObjectURL(musicFile));
      audioElement.volume = volume;
      if (isPlaying) {
        audioElement.play();
      }
      return () => {
        audioElement.pause();
        URL.revokeObjectURL(audioElement.src);
      };
    }
  }, [musicFile, isPlaying, volume]);

  const handlePlayPause = () => {
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    setDuration(videoRef.current.duration);
  };

  const handleVolumeChange = (event, newValue) => {
    setVolume(newValue);
    videoRef.current.volume = newValue;
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    videoRef.current.muted = !isMuted;
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {isPart1 ? 'Part 1 Preview' : 'Part 2 Preview'}
        </Typography>
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            paddingTop: '177.78%', // 16:9 Aspect Ratio for TikTok
            backgroundColor: '#000',
          }}
        >
          <video
            ref={videoRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
          />
          {hookText && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: textSettings.textColor,
                fontSize: `${textSettings.textSize}px`,
                fontFamily: textSettings.selectedFonts[0],
                textAlign: 'center',
                textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                animation: `${textSettings.textAnimation.toLowerCase().replace(' ', '')} 1s`,
                width: '80%',
                wordWrap: 'break-word',
              }}
            >
              {hookText}
            </Box>
          )}
        </Box>
        <Box sx={{ mt: 2 }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton onClick={handlePlayPause}>
                {isPlaying ? <Pause /> : <PlayArrow />}
              </IconButton>
              <Typography variant="body2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </Typography>
              <IconButton onClick={handleMuteToggle}>
                {isMuted ? <VolumeOff /> : <VolumeUp />}
              </IconButton>
              <Slider
                size="small"
                value={volume}
                onChange={handleVolumeChange}
                min={0}
                max={1}
                step={0.1}
                sx={{ width: 100 }}
              />
            </Box>
            <Slider
              size="small"
              value={currentTime}
              max={duration}
              onChange={(_, value) => {
                videoRef.current.currentTime = value;
              }}
            />
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
};

export default VideoPreview; 