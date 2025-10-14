"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import Image from 'next/image';

interface VideoPreviewProps {
  src: string;
  thumbnail?: string;
  title?: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  onHover?: () => void;
}

export function VideoPreview({
  src,
  thumbnail,
  title,
  className = '',
  autoPlay = false,
  muted = true,
  onHover
}: VideoPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const handleLoadStart = () => {
    setIsLoading(true);
  };

  const handleCanPlay = () => {
    setIsLoading(false);
    if (showThumbnail && thumbnail) {
      // Ne pas auto-jouer si on affiche le thumbnail
      return;
    }
    if (autoPlay || isHovered) {
      videoRef.current?.play();
      setIsPlaying(true);
    }
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    onHover?.();
    
    // Commencer à charger et jouer la vidéo
    if (showThumbnail) {
      setShowThumbnail(false);
      setTimeout(() => {
        videoRef.current?.play();
        setIsPlaying(true);
      }, 100);
    } else if (!isPlaying && videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (isPlaying && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
      if (thumbnail) {
        setShowThumbnail(true);
      }
    }
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      if (showThumbnail) {
        setShowThumbnail(false);
      }
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
  };

  return (
    <div
      className={`relative group overflow-hidden bg-gray-900 ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Thumbnail */}
      {thumbnail && showThumbnail && (
        <div className="absolute inset-0 z-10">
          <Image
            src={thumbnail}
            alt={title || 'Video thumbnail'}
            layout="fill"
            objectFit="cover"
            priority
          />
          <div className="absolute inset-0 bg-black/20" />
        </div>
      )}

      {/* Video */}
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-cover"
        muted={isMuted}
        loop
        playsInline
        preload={showThumbnail ? 'none' : 'metadata'}
        onLoadStart={handleLoadStart}
        onCanPlay={handleCanPlay}
        style={{ display: showThumbnail ? 'none' : 'block' }}
      />

      {/* Loading spinner */}
      {isLoading && !showThumbnail && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Controls Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30">
        {/* Play/Pause button */}
        <button
          onClick={togglePlayPause}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
            {isPlaying ? (
              <Pause size={20} className="text-white" />
            ) : (
              <Play size={20} className="text-white ml-1" />
            )}
          </div>
        </button>

        {/* Mute button */}
        <button
          onClick={toggleMute}
          className="absolute bottom-2 right-2 p-1.5 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors"
        >
          {isMuted ? (
            <VolumeX size={16} className="text-white" />
          ) : (
            <Volume2 size={16} className="text-white" />
          )}
        </button>

        {/* Title */}
        {title && (
          <div className="absolute bottom-2 left-2 right-12">
            <p className="text-white text-sm font-medium truncate">{title}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Version simplifiée pour les grilles
export function VideoThumbnail({ 
  src, 
  thumbnail, 
  title,
  onClick,
  className = '' 
}: {
  src: string;
  thumbnail?: string;
  title?: string;
  onClick?: () => void;
  className?: string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isHovered && videoRef.current) {
      videoRef.current.play();
    } else if (!isHovered && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isHovered]);

  return (
    <div
      className={`relative group cursor-pointer overflow-hidden bg-gray-900 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Thumbnail toujours visible */}
      {thumbnail && (
        <Image
          src={thumbnail}
          alt={title || 'Video thumbnail'}
          layout="fill"
          objectFit="cover"
          className={`transition-opacity duration-300 ${isHovered ? 'opacity-0' : 'opacity-100'}`}
        />
      )}

      {/* Video en preview au hover */}
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-cover"
        muted
        loop
        playsInline
        preload="none"
      />

      {/* Play icon overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={`w-10 h-10 bg-white/90 rounded-full flex items-center justify-center transition-all duration-300 ${
          isHovered ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
        }`}>
          <Play size={18} className="text-gray-900 ml-0.5" />
        </div>
      </div>
    </div>
  );
}