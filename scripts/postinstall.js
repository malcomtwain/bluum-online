#!/usr/bin/env node

/**
 * Script de post-installation pour s'assurer que FFmpeg est disponible
 * Ce script est particulièrement important pour les déploiements sur Vercel
 */

const fs = require('fs');
const path = require('path');

console.log('📦 Running post-install script for FFmpeg...');

// Vérifier si nous sommes sur Vercel
const isVercel = process.env.VERCEL || process.env.VERCEL_ENV;

if (isVercel) {
  console.log('🔧 Detected Vercel environment, configuring FFmpeg...');
  
  try {
    // Essayer de localiser ffmpeg-static
    const ffmpegStatic = require('ffmpeg-static');
    console.log('✅ ffmpeg-static found:', ffmpegStatic);
    
    // Vérifier que le fichier existe
    if (fs.existsSync(ffmpegStatic)) {
      console.log('✅ FFmpeg binary exists at:', ffmpegStatic);
      
      // Rendre le binaire exécutable
      fs.chmodSync(ffmpegStatic, '755');
      console.log('✅ Made FFmpeg executable');
    } else {
      console.warn('⚠️ FFmpeg binary not found at expected location:', ffmpegStatic);
    }
  } catch (e) {
    console.warn('⚠️ Could not configure ffmpeg-static:', e.message);
    
    // Essayer @ffmpeg-installer/ffmpeg
    try {
      const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
      console.log('✅ @ffmpeg-installer/ffmpeg found:', ffmpegInstaller.path);
      
      if (fs.existsSync(ffmpegInstaller.path)) {
        fs.chmodSync(ffmpegInstaller.path, '755');
        console.log('✅ Made FFmpeg executable');
      }
    } catch (e2) {
      console.error('❌ No FFmpeg package found');
    }
  }
} else {
  console.log('📍 Not on Vercel, skipping FFmpeg configuration');
}

console.log('✅ Post-install script completed');