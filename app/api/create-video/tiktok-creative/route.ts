import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { uploadAndSaveGeneratedVideo } from '@/lib/upload-generated-media';
import { createClient } from '@supabase/supabase-js';

const execPromise = promisify(exec);

// Initialize Supabase client - only if credentials are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseAdmin = (supabaseUrl && supabaseServiceKey) ? createClient(supabaseUrl, supabaseServiceKey) : null;

// Fonction pour mélanger intelligemment les images
function smartShuffle(images: any[], seed: number): any[] {
  const result = [...images];
  const usedCombinations = new Set<string>();

  // Créer une permutation unique basée sur le seed
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor((Math.sin(seed++) * 10000) % (i + 1));
    if (j < 0) continue;
    [result[i], result[j]] = [result[j], result[i]];
  }

  // Créer un hash de cette combinaison
  const hash = result.map((img, idx) => `${idx}-${img.url.slice(-10)}`).join('|');

  // Si cette combinaison existe déjà, faire une autre permutation
  if (usedCombinations.has(hash)) {
    return smartShuffle(images, seed + 1000);
  }

  usedCombinations.add(hash);
  return result;
}

// Fonction pour obtenir le chemin de la font sélectionnée
function getFontPath(selectedFont: string): string {
  const fontMap: { [key: string]: string } = {
    'all': '/fonts/TikTokDisplayMedium.otf', // Default when mixing fonts
    'tiktok': '/fonts/TikTokDisplayMedium.otf',
    'elgraine': '/fonts/new-fonts/Elgraine-LightItalic.otf',
    'garamond': '/fonts/new-fonts/Garamond Premier Pro Light Display.otf',
    'gazpacho': '/fonts/new-fonts/Gazpacho-Heavy.otf',
    'kaufmann': '/fonts/new-fonts/Kaufmann Bold.otf',
    'pepi': '/fonts/new-fonts/PepiTRIAL-Bold-BF676cc171e9076.otf',
    'rudi': '/fonts/new-fonts/RudiTRIAL-Bold-BF676cc17237a19.otf',
    'silk': '/fonts/new-fonts/Silk Serif SemiBold.otf',
    'routine': '/fonts/new-fonts/Thursday Routine.ttf'
  };

  return fontMap[selectedFont] || fontMap['tiktok']; // Fallback to TikTok font if not found
}

// Fonction pour calculer la taille de font (retourne un multiplicateur)
function getFontSizeMultiplier(fontSize: number, randomFontSize: boolean, seed: number): number {
  if (randomFontSize) {
    // En mode random, générer une taille aléatoire entre 60% et 120%
    const minSize = 60;
    const maxSize = 120;
    const randomSize = minSize + Math.floor(Math.abs(Math.sin(seed * 0.00456) * 10000) % (maxSize - minSize + 1));
    return randomSize / 100; // Convertir en multiplicateur
  }

  // Utiliser la taille spécifiée
  return fontSize / 100; // Convertir le pourcentage en multiplicateur
}

// Fonction pour calculer une position random intelligente
function getRandomPosition(position: string, randomPosition: boolean, fontSize: number, fontSizeMultiplier: number, seed: number, hookText: string = ''): { x: number, y: number } {
  if (!randomPosition) {
    // Position fixe classique
    let startY = 902; // middle par défaut (47% de 1920)
    if (position === 'top') {
      startY = 230; // 12% de 1920 = 230px
    } else if (position === 'bottom') {
      startY = 1382; // 72% de 1920 = 1382px
    }
    return { x: 540, y: startY }; // x centré (540 = 1080/2)
  }

  // Position random avec zone sécurisée
  const videoWidth = 1080;
  const videoHeight = 1920;

  // Zone sécurisée plus restrictive - rester dans 70% de l'écran
  const safeZoneMarginX = videoWidth * 0.15; // 15% de marge de chaque côté
  const safeZoneMarginTop = 300; // Marge top
  const safeZoneMarginBottom = 450; // Marge bottom plus grande pour remonter

  const minX = safeZoneMarginX; // ~162px
  const maxX = videoWidth - safeZoneMarginX; // ~918px
  const minY = safeZoneMarginTop; // 300px
  const maxY = videoHeight - safeZoneMarginBottom; // 1470px (remonté de 150px)

  // Générer position dans la zone sécurisée
  const randomY = minY + Math.floor(Math.abs(Math.sin(seed * 0.00123) * 10000) % (maxY - minY + 1));
  const randomX = minX + Math.floor(Math.abs(Math.sin(seed * 0.00789) * 10000) % (maxX - minX + 1));

  return { x: randomX, y: randomY };
}

// 🎯 ANTI-DÉTECTION AUTHENTIQUE : Profils iPhone/CapCut/TikTok Studio
function getAuthenticProfile(seed: number): {
  profileType: string;
  codec: string;
  profile: string;
  fps: number;
  videoBitrate: string;
  audioBitrate: string;
  audioSampleRate: number;
  audioChannels: number;
  colorAdjustment: { brightness: number, contrast: number };
  filenameHash: string;
  metadata: any;
} {
  // Sélectionner un profil aléatoire
  const profiles = ['iphone', 'capcut', 'tiktok'];
  const profileIndex = Math.floor(Math.abs(Math.sin(seed * 0.001) * 1000) % profiles.length);
  const profileType = profiles[profileIndex];

  let config: any = {};

  if (profileType === 'iphone') {
    // 📱 iPhone 17 Pro pattern
    const fpsJitter = 29.97 + (Math.abs(Math.sin(seed * 0.002) * 1000) % 40 - 20) / 1000; // 29.95-29.99
    const videoBitrate = 8000 + Math.floor(Math.abs(Math.sin(seed * 0.003) * 1000) % 1500); // 8.0-9.5M
    const brightness = 1 + (Math.abs(Math.sin(seed * 0.004) * 1000) % 4 - 2) / 100; // ±2%
    const contrast = 1 + (Math.abs(Math.sin(seed * 0.005) * 1000) % 6 - 3) / 100; // ±3%

    config = {
      profileType: 'iPhone',
      codec: 'libx264',
      profile: 'high',
      fps: fpsJitter,
      videoBitrate: `${videoBitrate}k`,
      audioBitrate: '160k',
      audioSampleRate: 44100,
      audioChannels: 2,
      colorAdjustment: { brightness, contrast },
      metadata: {
        'metadata:g:0': 'com.apple.quicktime.make=Apple',
        'metadata:g:1': 'com.apple.quicktime.model=iPhone17,3'
      }
    };
  } else if (profileType === 'capcut') {
    // 🎬 CapCut Android pattern
    const videoBitrate = 6000 + Math.floor(Math.abs(Math.sin(seed * 0.003) * 1000) % 2000); // 6.0-8.0M
    const audioSampleRate = Math.abs(Math.sin(seed * 0.006)) > 0.8 ? 44100 : 48000; // Occasionnellement 44.1k
    const brightness = 1 + (Math.abs(Math.sin(seed * 0.004) * 1000) % 2 - 1) / 100; // ±1%
    const contrast = 1 + (Math.abs(Math.sin(seed * 0.005) * 1000) % 2 - 1) / 100; // ±1%

    config = {
      profileType: 'CapCut',
      codec: 'libx264',
      profile: 'main',
      fps: 30.0,
      videoBitrate: `${videoBitrate}k`,
      audioBitrate: '128k',
      audioSampleRate,
      audioChannels: 2,
      colorAdjustment: { brightness, contrast },
      metadata: {
        'metadata:g:0': 'com.bytedance.capcut'
      }
    };
  } else {
    // 🎵 TikTok Studio pattern
    const videoBitrate = 4000 + Math.floor(Math.abs(Math.sin(seed * 0.003) * 1000) % 2000); // 4.0-6.0M
    const audioChannels = Math.abs(Math.sin(seed * 0.007)) > 0.5 ? 1 : 2; // Mono/stereo
    const profile = Math.abs(Math.sin(seed * 0.008)) > 0.5 ? 'baseline' : 'main'; // Profils bas

    config = {
      profileType: 'TikTok Studio',
      codec: 'libx264',
      profile,
      fps: 30.0,
      videoBitrate: `${videoBitrate}k`,
      audioBitrate: '96k',
      audioSampleRate: 44100,
      audioChannels,
      colorAdjustment: { brightness: 1.0, contrast: 1.0 }, // Pas de variation pour TikTok
      metadata: {
        'metadata:g:0': 'TikTok Export'
      }
    };
  }

  // 🔤 FILENAME selon le profil
  let filenameHash: string;

  if (profileType === 'iphone') {
    // iPhone: IMG_xxxx ou MOV_xxxx
    const isVideo = Math.abs(Math.sin(seed * 0.009)) > 0.5;
    const prefix = isVideo ? 'MOV' : 'IMG';
    const num = 1000 + Math.floor(Math.abs(Math.sin(seed * 0.010) * 10000) % 9000);
    filenameHash = `${prefix}_${num}`;
  } else if (profileType === 'capcut') {
    // CapCut: UUID style
    const hex = '0123456789ABCDEF';
    const segments = [8, 4, 4, 4, 12];
    let uuid = '';
    let charIndex = 0;

    for (let i = 0; i < segments.length; i++) {
      if (i > 0) uuid += '-';
      for (let j = 0; j < segments[i]; j++) {
        const hexIndex = Math.floor(Math.abs(Math.sin((seed + charIndex) * 0.00468) * 1000) % hex.length);
        uuid += hex[hexIndex];
        charIndex++;
      }
    }
    filenameHash = uuid;
  } else {
    // TikTok: court et simple
    const chars = '0123456789abcdef';
    let name = '';
    for (let i = 0; i < 8; i++) {
      const charIndex = Math.floor(Math.abs(Math.sin((seed + i) * 0.011) * 1000) % chars.length);
      name += chars[charIndex];
    }
    filenameHash = name;
  }

  // 🎨 VARIATIONS ULTRA-PERFECTIONNÉES pour indétectabilité totale
  const advancedVariations = {
    // 🎨 VISUELLES
    noise: 1 + Math.abs(Math.sin(seed * 0.012) * 1000) % 2, // 1-3% (divisé par 100)
    saturationShift: (Math.abs(Math.sin(seed * 0.016) * 1000) % 6 - 3), // ±3 (divisé par 1000)
    contrastShift: (Math.abs(Math.sin(seed * 0.025) * 1000) % 20 - 10) / 10, // ±1% contrast
    brightnessShift: (Math.abs(Math.sin(seed * 0.026) * 1000) % 10 - 5) / 10, // ±0.5% brightness
    compressionArtifacts: 1 + Math.abs(Math.sin(seed * 0.027) * 1000) % 2, // 1-3 artifacts

    // 📝 TEXTE
    hookTextOffset: 2 + Math.abs(Math.sin(seed * 0.017) * 1000) % 5, // 2-6px

    // ⏱️ TEMPORELLES
    clipDurationVariation: 0.96 + Math.abs(Math.sin(seed * 0.018) * 1000) % 8 / 100, // 0.96-1.04s
    finalDurationMs: Math.abs(Math.sin(seed * 0.028) * 1000) % 999, // 0-999ms précision

    // 🔊 AUDIO AVANCÉES
    musicDelay: 0.05 + Math.abs(Math.sin(seed * 0.020) * 1000) % 5 / 100, // 0.05-0.1s
    audioOffset: 0.1 + Math.abs(Math.sin(seed * 0.021) * 1000) % 20 / 100, // 0.1-0.3s
    volumeChange: (Math.abs(Math.sin(seed * 0.022) * 1000) % 10 - 5) / 10, // ±0.5dB
    fadeIn: 0.2 + Math.abs(Math.sin(seed * 0.023) * 1000) % 10 / 100, // 0.2-0.3s
    fadeOut: 0.2 + Math.abs(Math.sin(seed * 0.024) * 1000) % 10 / 100, // 0.2-0.3s
    backgroundNoise: 0.001 + Math.abs(Math.sin(seed * 0.029) * 1000) % 4 / 10000, // 0.001-0.0014 noise
    sampleRateJitter: profileType === 'iphone' ? 44100 : config.audioSampleRate, // iPhone: 44100Hz (AAC only supports specific rates)
    audioCompression: 1 + Math.abs(Math.sin(seed * 0.031) * 1000) % 2 // 1-3 compression
  };

  // 📱 MÉTADONNÉES ULTRA-AUTHENTIQUES
  const now = new Date();
  const deviceMetadata = {
    // Timestamps cohérents
    creationTime: new Date(now.getTime() - Math.abs(Math.sin(seed * 0.032) * 1000) % 86400000).toISOString(), // Dans les 24h

    // GPS selon profil
    gpsCoords: profileType === 'iphone' ?
      `${(40 + Math.abs(Math.sin(seed * 0.033) * 1000) % 50).toFixed(6)},${(-120 + Math.abs(Math.sin(seed * 0.034) * 1000) % 60).toFixed(6)}` :
      '', // iPhone a GPS, autres non

    // Orientation selon device
    orientation: profileType === 'iphone' ?
      (Math.abs(Math.sin(seed * 0.035)) > 0.5 ? 'Portrait' : 'Landscape') :
      profileType === 'capcut' ? 'Portrait' : '',

    // Device info authentique
    deviceModel: profileType === 'iphone' ?
      `iPhone17,${3 + Math.abs(Math.sin(seed * 0.036) * 1000) % 3}` : // iPhone17,3-5
      profileType === 'capcut' ?
      'SM-G998B' : // Samsung Galaxy S21 Ultra
      'TikTok-Studio'
  };

  config.filenameHash = filenameHash;
  config.advancedVariations = advancedVariations;
  config.deviceMetadata = deviceMetadata;
  return config;
}

// Fonction pour sélectionner une font aléatoire parmi les fonts sélectionnées
function getRandomSelectedFontPath(selectedFonts: string[], seed: number): string {
  if (selectedFonts.length === 0) {
    return '/fonts/TikTokDisplayMedium.otf'; // Fallback
  }

  if (selectedFonts.length === 1) {
    return getFontPath(selectedFonts[0]);
  }

  // Sélectionner aléatoirement parmi les fonts sélectionnées
  const randomIndex = Math.floor(Math.abs(Math.sin(seed * 0.00789) * 10000) % selectedFonts.length);
  return getFontPath(selectedFonts[randomIndex]);
}

// Fonction pour sélectionner une font aléatoire quand "All fonts" est choisi (legacy)
function getRandomFontPath(seed: number): string {
  const availableFonts = [
    '/fonts/TikTokDisplayMedium.otf',
    '/fonts/new-fonts/Elgraine-LightItalic.otf',
    '/fonts/new-fonts/Garamond Premier Pro Light Display.otf',
    '/fonts/new-fonts/Gazpacho-Heavy.otf',
    '/fonts/new-fonts/Kaufmann Bold.otf',
    '/fonts/new-fonts/PepiTRIAL-Bold-BF676cc171e9076.otf',
    '/fonts/new-fonts/RudiTRIAL-Bold-BF676cc17237a19.otf',
    '/fonts/new-fonts/Silk Serif SemiBold.otf',
    '/fonts/new-fonts/Thursday Routine.ttf'
  ];

  const randomIndex = Math.floor(Math.abs(Math.sin(seed * 0.00789) * 10000) % availableFonts.length);
  return availableFonts[randomIndex];
}

export async function POST(request: NextRequest) {
  console.log('[TikTok Creative] Starting template generation...');

  try {
    // Get the Authorization header to identify the user
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    if (supabaseAdmin && authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
      }
    }

    const data = await request.json();
    const { images, videos, hooks, music, videoCount = 3, style = 1, position = 'middle', offset = 0, clipDuration, selectedFonts = ['tiktok'], fontSize = 100, randomFontSize = false, randomPosition = false, imageTimingMin = 450, imageTimingMax = 1200 } = data;

    // TikTok Creative automatically manages clip duration dynamically based on final duration

    console.log('[TikTok Creative] Request data:', {
      imagesCount: images?.length,
      videosCount: videos?.length,
      hooksCount: hooks?.length,
      musicId: music?.id,
      musicUrl: music?.url ? 'present' : 'missing',
      videoCount,
      style,
      position,
      offset,
      selectedFonts,
      fontSize,
      randomFontSize,
      templateClipDuration: `${clipDuration}s per clip`
    });

    // Combiner images et vidéos en un seul tableau de médias
    const allMedia = [
      ...(images || []).map((img: any) => ({ ...img, type: 'image' })),
      ...(videos || []).map((vid: any) => ({ ...vid, type: 'video' }))
    ];

    // Déterminer si c'est principalement une collection vidéo
    const isVideoCollection = (videos && videos.length > 0) && (!images || images.length === 0);

    // Validation adaptée - on utilise ce qu'on a, pas de minimum artificiel
    if (!allMedia || allMedia.length === 0) {
      return NextResponse.json(
        { error: 'At least 1 image or video is required' },
        { status: 400 }
      );
    }

    console.log(`[TikTok Creative] Available media: ${allMedia.length} items`);

    // Check if no-music option is selected
    const isNoMusicSelected = music?.id === 'no-music' || !music || !music.url;

    if (!isNoMusicSelected && (!music || !music.url)) {
      return NextResponse.json(
        { error: 'Music is required or select "Without music" option' },
        { status: 400 }
      );
    }

    const generatedVideos = [];
    const timestamp = Date.now();

    for (let videoIndex = 0; videoIndex < videoCount; videoIndex++) {
      console.log(`[TikTok Creative] Creating template variation ${videoIndex + 1}/${videoCount}`);

      // Générer un seed unique pour cette variation
      const videoSeed = timestamp + videoIndex * 1000 + (allMedia.length * 137) + ((hooks?.length || 0) * 73);

      // 🎯 ANTI-DÉTECTION AUTHENTIQUE : Générer le profil authentique pour ce template
      const authenticProfile = getAuthenticProfile(videoSeed);
      console.log(`[TikTok Creative] 🛡️ Template ${videoIndex + 1} authentic profile: ${authenticProfile.profileType}`, {
        codec: `${authenticProfile.codec}/${authenticProfile.profile}`,
        fps: authenticProfile.fps.toFixed(3),
        videoBitrate: authenticProfile.videoBitrate,
        audioBitrate: authenticProfile.audioBitrate,
        audioSampleRate: `${authenticProfile.audioSampleRate}Hz`,
        audioChannels: `${authenticProfile.audioChannels}ch`,
        filename: authenticProfile.filenameHash
      });

      // 🚀 TIKTOK CREATIVE ULTRA : Timing adapté selon le type de collection
      let minClipTimingMs, maxClipTimingMs;

      if (isVideoCollection) {
        // Pour les vidéos collections : timing plus lent pour éviter trop de loops
        minClipTimingMs = 1000; // 1s minimum
        maxClipTimingMs = 2000; // Jusqu'à 2s par clip vidéo
      } else {
        // Pour les images collections : timing rapide mais pas trop (ralenti)
        minClipTimingMs = 300; // 300ms minimum au lieu de 100ms
        maxClipTimingMs = 900;
      }

      const randomTiming = minClipTimingMs + Math.floor(Math.abs(Math.sin(videoSeed * 0.00234) * 10000) % (maxClipTimingMs - minClipTimingMs + 1));
      const durationPerClip = randomTiming / 1000; // Convertir en secondes

      console.log(`[TikTok Creative] Template ${videoIndex + 1} ${isVideoCollection ? 'video' : 'image'} collection timing: ${randomTiming}ms per clip (${minClipTimingMs}-${maxClipTimingMs}ms range)`);

      // 🧠 LOGIQUE INTELLIGENTE : Plus c'est rapide, plus d'images pour éviter la répétition visible
      let minClips, maxClips;

      if (randomTiming <= 200) {
        // Ultra-rapide (100-200ms) → Beaucoup d'images pour masquer les loops
        minClips = 25;
        maxClips = 30;
      } else if (randomTiming <= 400) {
        // Rapide (201-400ms) → Images moyennes
        minClips = 18;
        maxClips = 25;
      } else if (randomTiming <= 600) {
        // Moyen (401-600ms) → Moins d'images
        minClips = 12;
        maxClips = 18;
      } else {
        // Lent (601-900ms) → Peu d'images, les loops sont moins visibles
        minClips = 10;
        maxClips = 15;
      }

      // 🎲 VARIATION INTELLIGENTE : Nombre d'images adapté au timing
      const extremeClipsCount = minClips + Math.floor(Math.abs(Math.sin(videoSeed * 0.00567) * 10000) % (maxClips - minClips + 1));
      const actualClipsCount = Math.min(extremeClipsCount, allMedia.length);

      // Sélectionner les médias pour ce template avec variation extrême
      const shuffledMedia = smartShuffle(allMedia, videoSeed);
      const selectedMedia = shuffledMedia.slice(0, actualClipsCount);

      console.log(`[TikTok Creative] 🧠 Template ${videoIndex + 1} INTELLIGENT: ${actualClipsCount} clips (${randomTiming}ms each - adapted to speed)`);

      // 🎯 DURÉE FINALE CIBLE : Utiliser les valeurs définies par l'utilisateur (en secondes)
      const minTargetDuration = Math.round(imageTimingMin / 1000);
      const maxTargetDuration = Math.round(imageTimingMax / 1000);

      // Générer une durée cible aléatoire dans la plage demandée
      const targetFinalDuration = minTargetDuration + Math.floor(Math.abs(Math.sin(videoSeed * 0.00891) * 10000) % (maxTargetDuration - minTargetDuration + 1));

      // 📊 CALCUL INITIAL : Durée avec une seule boucle
      const singleLoopDuration = actualClipsCount * durationPerClip;

      // 🔄 LOOP INTELLIGENT : Si c'est trop court, loop jusqu'à atteindre la durée cible
      const finalMediaSequence = [];
      let currentDuration = 0;
      let loopCount = 0;

      while (currentDuration < targetFinalDuration) {
        for (let i = 0; i < selectedMedia.length; i++) {
          finalMediaSequence.push(selectedMedia[i]);
          currentDuration += durationPerClip;

          // Arrêter si on a atteint la durée cible
          if (currentDuration >= targetFinalDuration) break;
        }
        loopCount++;

        // Sécurité: éviter les boucles infinies (max 20 loops)
        if (loopCount > 20) break;
      }

      const finalDuration = finalMediaSequence.length * durationPerClip;

      // 🚨 SÉCURITÉ : Vérifier que toutes les durées sont positives
      if (durationPerClip <= 0 || finalDuration <= 0) {
        throw new Error(`Invalid duration: durationPerClip=${durationPerClip}, finalDuration=${finalDuration}`);
      }

      console.log(`[TikTok Creative] 🔄 Template ${videoIndex + 1}: ${selectedMedia.length} unique clips × ${loopCount} loops = ${finalMediaSequence.length} total clips × ${randomTiming}ms = ${finalDuration.toFixed(1)}s`);

      // Sélectionner un hook aléatoire si des hooks sont fournis
      let selectedHook = '';
      if (hooks && hooks.length > 0) {
        const hookIndex = Math.floor((Math.sin(videoSeed * 0.001) * 10000) % hooks.length);
        selectedHook = hooks[Math.abs(hookIndex)] || hooks[0];
        console.log(`[TikTok Creative] Selected random hook ${Math.abs(hookIndex)}:`, selectedHook);
      }

      console.log(`[TikTok Creative] Processing ${finalMediaSequence.length} media items`);

      // Créer un dossier temporaire
      const tempDir = path.join(process.cwd(), 'public', 'generated-videos', `tiktok_${timestamp}_${videoIndex}`);
      await fs.mkdir(tempDir, { recursive: true });

      try {
        // Sauvegarder les médias (images et vidéos) avec des noms uniques
        const mediaPaths = [];
        const clipDurations = []; // Stocker les durées variées pour le concat

        for (let i = 0; i < finalMediaSequence.length; i++) {
          const media = finalMediaSequence[i];
          if (media.type === 'image') {
            // Traiter les images
            const imageData = media.url.replace(/^data:image\/\w+;base64,/, '');
            const imagePath = path.join(tempDir, `img_${i.toString().padStart(2, '0')}.jpg`);
            await fs.writeFile(imagePath, imageData, 'base64');
            mediaPaths.push(imagePath);
            clipDurations.push(durationPerClip); // Durée standard pour images
          } else if (media.type === 'video') {
            if (isVideoCollection) {
              // Pour les collections vidéo, utiliser les vidéos directement
              let videoPath: string;
              if (media.url.startsWith('data:')) {
                // Vidéo en base64
                const videoData = media.url.replace(/^data:video\/\w+;base64,/, '');
                videoPath = path.join(tempDir, `vid_${i.toString().padStart(2, '0')}.mp4`);
                await fs.writeFile(videoPath, videoData, 'base64');
              } else {
                // URL de vidéo
                videoPath = media.url;
              }

              // 🎨 Calculer la durée variée pour ce clip AVANT le traitement
              const variationFactor = 0.94 + Math.abs(Math.sin((videoSeed + i) * 0.025) * 1000) % 20 / 100;
              const videoDuration = durationPerClip * variationFactor;
              clipDurations.push(videoDuration);

              // Redimensionner la vidéo au bon format et ajuster la durée
              const processedVideoPath = path.join(tempDir, `processed_vid_${i.toString().padStart(2, '0')}.mp4`);

              console.log(`[TikTok Creative] 🎵 Template Video ${i + 1} duration: ${videoDuration.toFixed(3)}s (dynamic)`);

              await new Promise((resolve, reject) => {
                let ffmpegArgs;

                // Approche plus robuste pour éviter les figés
                ffmpegArgs = [
                  '-i', videoPath,
                  '-avoid_negative_ts', 'make_zero', // Éviter les timestamps négatifs
                  '-fflags', '+genpts', // Générer de nouveaux timestamps
                ];

                if (videoDuration > 0) {
                  // Pour les vidéos avec durée spécifiée
                  // 🎯 ANTI-DÉTECTION : Filtres simples sans variations visuelles (seulement métadonnées)
                  ffmpegArgs.push(
                    '-filter_complex',
                    `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30[v]`,
                    '-map', '[v]',
                    '-t', videoDuration.toString(),
                    '-an' // Pas d'audio pour éviter les problèmes
                  );
                } else {
                  // Pour les vidéos sans durée spécifiée
                  ffmpegArgs.push(
                    '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30',
                    '-an' // Pas d'audio pour les vidéos individuelles
                  );
                }

                // Paramètres de sortie avec profil authentique
                ffmpegArgs.push(
                  '-c:v', authenticProfile.codec,
                  '-profile:v', authenticProfile.profile, // 🎯 Profil authentique
                  '-preset', 'ultrafast', // Plus rapide pour éviter les timeouts
                  '-crf', '28', // Qualité un peu plus basse mais plus stable
                  '-maxrate', authenticProfile.videoBitrate, // 🎯 Bitrate authentique
                  '-pix_fmt', 'yuv420p',
                  '-movflags', '+faststart', // Optimisation streaming
                  '-y', processedVideoPath
                );

                console.log(`[TikTok Creative] Processing video ${i + 1} with duration ${videoDuration}s`);
                console.log(`[TikTok Creative] FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`);

                const ffmpeg = spawn('ffmpeg', ffmpegArgs);

                // Timeout de 30 secondes pour éviter les blocages
                const timeout = setTimeout(() => {
                  console.error(`[TikTok Creative] Video ${i + 1} processing timeout, killing process`);
                  ffmpeg.kill('SIGKILL');
                  reject(new Error(`Video processing timeout after 30s`));
                }, 30000);

                ffmpeg.stdout.on('data', (data) => {
                  console.log(`[FFmpeg Video ${i + 1} stdout]: ${data.toString().slice(0, 200)}`);
                });

                ffmpeg.stderr.on('data', (data) => {
                  const output = data.toString();
                  console.log(`[FFmpeg Video ${i + 1} stderr]: ${output.slice(0, 200)}`);
                });

                ffmpeg.on('close', (code) => {
                  clearTimeout(timeout);
                  if (code === 0) {
                    console.log(`[TikTok Creative] Video ${i + 1} processing completed successfully`);
                    resolve(processedVideoPath);
                  } else {
                    reject(new Error(`FFmpeg video processing failed with code ${code}`));
                  }
                });

                ffmpeg.on('error', (err) => {
                  clearTimeout(timeout);
                  reject(err);
                });
              });

              mediaPaths.push(processedVideoPath);
            } else {
              // Pour les collections mixtes, extraire une frame
              let videoPath: string;
              if (media.url.startsWith('data:')) {
                const videoData = media.url.replace(/^data:video\/\w+;base64,/, '');
                videoPath = path.join(tempDir, `vid_${i.toString().padStart(2, '0')}.mp4`);
                await fs.writeFile(videoPath, videoData, 'base64');
              } else {
                videoPath = media.url;
              }

              const framePath = path.join(tempDir, `frame_${i.toString().padStart(2, '0')}.jpg`);
              await new Promise((resolve, reject) => {
                // 🎯 ANTI-DÉTECTION : Extraction de frame simple sans variations
                const ffmpeg = spawn('ffmpeg', [
                  '-i', videoPath,
                  '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920', // Filtres stables
                  '-vframes', '1',
                  '-y',
                  framePath
                ]);

                ffmpeg.on('close', (code) => {
                  if (code === 0) {
                    resolve(framePath);
                  } else {
                    reject(new Error(`FFmpeg frame extraction failed with code ${code}`));
                  }
                });

                ffmpeg.on('error', reject);
              });

              mediaPaths.push(framePath);
              clipDurations.push(durationPerClip); // Durée standard pour frames
            }
          }
        }

        // Sauvegarder la musique seulement si elle n'est pas "no-music"
        let musicPath = null;
        if (!isNoMusicSelected && music && music.url) {
          const musicData = music.url.replace(/^data:audio\/\w+;base64,/, '');
          musicPath = path.join(tempDir, 'audio.mp3');
          await fs.writeFile(musicPath, musicData, 'base64');
        }

        // 🎵 Créer le fichier concat en utilisant les durées déjà calculées
        let concatContent = '';
        for (let i = 0; i < mediaPaths.length; i++) {
          concatContent += `file '${mediaPaths[i]}'\n`;
          concatContent += `duration ${clipDurations[i].toFixed(3)}\n`;

          console.log(`[TikTok Creative] 🎨 Template Clip ${i + 1} duration: ${(clipDurations[i]*1000).toFixed(0)}ms (non-uniform variation)`);
        }

        console.log(`[TikTok Creative] Concat file will contain ${mediaPaths.length} media files`);
        console.log(`[TikTok Creative] First few lines of concat:\n${concatContent.split('\n').slice(0, 6).join('\n')}`);

        const concatFile = path.join(tempDir, 'concat.txt');
        await fs.writeFile(concatFile, concatContent);

        // 🎯 ANTI-DÉTECTION : Nom de fichier authentique selon le profil
        const outputPath = path.join(
          process.cwd(),
          'public',
          'generated-videos',
          `${authenticProfile.filenameHash}.mp4`
        );

        // Créer la vidéo directement avec les médias sélectionnés
        await new Promise((resolve, reject) => {
          // 🎯 ANTI-DÉTECTION : Filtres vidéo avec variations avancées pour casser les hash
          const advVar = authenticProfile.advancedVariations;

          let videoFilters = [
            'scale=1080:1920:force_original_aspect_ratio=increase',
            'crop=1080:1920',
            // 🎨 VARIATIONS VISUELLES ULTRA-PERFECTIONNÉES
            `noise=alls=${advVar.noise/100}:allf=t`, // 🎨 Grain/noise 0.01-0.03
            `eq=contrast=${1 + advVar.contrastShift/100}:brightness=${advVar.brightnessShift/100}:saturation=${1 + advVar.saturationShift/1000}`, // 🎨 Contrast±1%, brightness±0.5%, saturation±0.3%
            `unsharp=5:5:${advVar.compressionArtifacts/10}:5:5:0.0`, // 🎨 Compression artifacts simulés
            'setsar=1',
            'pad=ceil(iw/2)*2:ceil(ih/2)*2' // 🔧 Assurer dimensions paires pour h264
          ];

          // Ajouter le texte du hook si fourni (en utilisant drawtext avec word wrap)
          if (selectedHook && selectedHook.trim()) {
            // Pour les styles 2 et 3 (White/Black), forcer la font TikTok
            let fontRelativePath;
            if (style === 2 || style === 3) {
              fontRelativePath = '/fonts/TikTokDisplayMedium.otf';
            } else {
              fontRelativePath = getRandomSelectedFontPath(selectedFonts, videoSeed);
            }

            const fontPath = path.join(process.cwd(), 'public' + fontRelativePath);

            // Calculer le multiplicateur de taille de font
            const fontSizeMultiplier = getFontSizeMultiplier(fontSize, randomFontSize, videoSeed);

            console.log(`[TikTok Creative] Font selection: selectedFonts=[${selectedFonts.join(', ')}], chosenFont="${fontRelativePath}", fontPath="${fontPath}", fontSizeMultiplier=${fontSizeMultiplier}`);

            // Fonction pour diviser le texte en lignes
            const wrapText = (text: string, maxCharsPerLine: number = 35): string[] => {
              const words = text.split(' ');
              const lines: string[] = [];
              let currentLine = '';

              for (const word of words) {
                if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
                  currentLine = currentLine ? `${currentLine} ${word}` : word;
                } else {
                  if (currentLine) lines.push(currentLine);
                  currentLine = word;
                }
              }
              if (currentLine) lines.push(currentLine);

              return lines;
            };

            const lines = wrapText(selectedHook, 35);
            const lineHeight = 70;

            // Calculer position avec système intelligent (support du random)
            const basePosition = getRandomPosition(position, randomPosition, fontSize, fontSizeMultiplier, videoSeed, selectedHook);
            let startY = basePosition.y;
            let startX = basePosition.x;

            // Appliquer l'offset seulement si position n'est pas random
            if (!randomPosition) {
              startY += (offset || 0) * 8;
            }

            // 🎨 VARIATION AVANCÉE : Offset vertical aléatoire 2-6px
            startY += advVar.hookTextOffset;

            // Définir les styles selon le type
            let fontColor = 'white';
            let borderColor = 'black';
            let borderWidth = 3;
            let baseFontSize = 50;

            if (style === 1) {
              // Style 1: Texte blanc avec bordure noire
              fontColor = 'white';
              borderColor = 'black';
              borderWidth = 3;
              baseFontSize = 50;
            } else if (style === 2) {
              // Style 2: Texte noir avec fond blanc (on simule avec bordercolor)
              fontColor = 'black';
              borderColor = 'white';
              borderWidth = 8;
              baseFontSize = 65;
            } else if (style === 3) {
              // Style 3: Texte blanc avec fond noir
              fontColor = 'white';
              borderColor = 'black';
              borderWidth = 8;
              baseFontSize = 65;
            } else if (style === 4) {
              // Style 4: Texte blanc sans bordure
              fontColor = 'white';
              borderColor = 'transparent';
              borderWidth = 0;
              baseFontSize = 50;
            }

            // Appliquer le multiplicateur de taille
            const finalFontSize = Math.round(baseFontSize * fontSizeMultiplier);

            // Ajouter chaque ligne comme un drawtext séparé
            lines.forEach((line, index) => {
              const escapedLine = line.replace(/'/g, "\\\\'").replace(/:/g, "\\\\:");
              const yPosition = startY + (index * lineHeight);

              // Calculer position X avec micro-décalages subtils
              let xPosition;
              if (randomPosition) {
                // Micro-décalages de seulement quelques pixels (-15 à +15px)
                // Basé sur la longueur du texte et le seed pour être déterministe
                const textLength = escapedLine.length;
                const microOffset = Math.floor(Math.abs(Math.sin(videoSeed * 0.001 + textLength) * 1000) % 31) - 15; // -15 à +15px
                xPosition = `(w-text_w)/2${microOffset >= 0 ? '+' : ''}${microOffset}`;
              } else {
                // Position fixe centrée classique
                xPosition = '(w-text_w)/2';
              }
              let drawtextCommand = `drawtext=text='${escapedLine}':fontfile='${fontPath}':fontsize=${finalFontSize}:fontcolor=${fontColor}:x=${xPosition}:y=${yPosition}`;

              // Ajouter la bordure seulement si borderWidth > 0
              if (borderWidth > 0) {
                drawtextCommand += `:borderw=${borderWidth}:bordercolor=${borderColor}`;
              }

              videoFilters.push(drawtextCommand);
            });
          }

          // Build FFmpeg command based on whether music is selected
          const ffmpegArgs = [
            '-f', 'concat',
            '-safe', '0',
            '-avoid_negative_ts', 'make_zero', // Éviter les timestamps négatifs
            '-fflags', '+genpts', // Générer de nouveaux timestamps
            '-i', concatFile
          ];

          // Add music input only if musicPath exists
          if (musicPath) {
            ffmpegArgs.push('-i', musicPath);
          }

          // Duration calculation - Durée finale avec millisecondes aléatoires (needed before filters)
          const totalDuration = finalDuration + (advVar.finalDurationMs / 1000); // 🎨 Ajouter 0-999ms aléatoires

          // Add video filters
          ffmpegArgs.push('-vf', videoFilters.join(','));

          // Add audio settings if music exists
          if (musicPath) {
            ffmpegArgs.push(
              '-c:a', 'aac',
              '-b:a', authenticProfile.audioBitrate, // 🎯 Bitrate audio authentique
              '-ar', advVar.sampleRateJitter.toString(), // 🎯 Sample rate avec jitter iPhone (44099-44101Hz)
              '-ac', authenticProfile.audioChannels.toString() // 🎯 Channels authentiques (mono/stereo)
            );
          }

          // 🎯 ANTI-DÉTECTION : Video codec settings authentiques
          ffmpegArgs.push(
            '-c:v', authenticProfile.codec,
            '-profile:v', authenticProfile.profile, // 🎯 Profil authentique
            '-preset', 'medium',
            '-crf', '23',
            '-maxrate', authenticProfile.videoBitrate, // 🎯 Bitrate authentique
            '-bufsize', authenticProfile.videoBitrate, // 🎯 Buffer size adapté
            '-r', authenticProfile.fps.toString(), // 🎯 FPS authentique (avec jitter iPhone)
            '-pix_fmt', 'yuv420p'
          );

          console.log(`[TikTok Creative] 🚀 Template final duration: ${totalDuration.toFixed(1)}s ULTRA-RAPIDE (${finalMediaSequence.length} clips × ${randomTiming}ms, ${loopCount} loops)`);
          console.log(`[TikTok Creative] 🛡️ Authentic ${authenticProfile.profileType} profile: ${authenticProfile.codec}/${authenticProfile.profile}, ${authenticProfile.videoBitrate} video, ${authenticProfile.audioBitrate} audio, ${authenticProfile.fps.toFixed(3)}fps`);
          console.log(`[TikTok Creative] 🎨 Ultra-perfected variations: noise=${(advVar.noise/100).toFixed(3)}, contrast=${advVar.contrastShift}%, brightness=${advVar.brightnessShift}%, compression=${advVar.compressionArtifacts}, backgroundNoise=${advVar.backgroundNoise.toFixed(6)}`);
          console.log(`[TikTok Creative] 📱 Device metadata: ${authenticProfile.deviceMetadata.deviceModel}, GPS=${authenticProfile.deviceMetadata.gpsCoords ? 'enabled' : 'disabled'}, orientation=${authenticProfile.deviceMetadata.orientation}, sampleRate=${advVar.sampleRateJitter}Hz`);

          // TOUJOURS spécifier une durée pour éviter les figés à la fin
          ffmpegArgs.push('-t', totalDuration.toFixed(2));

          // 🎯 MÉTADONNÉES ULTRA-AUTHENTIQUES selon le profil
          const allMetadata = {
            ...authenticProfile.metadata,
            'creation_time': authenticProfile.deviceMetadata.creationTime,
            'com.apple.quicktime.location.ISO6709': authenticProfile.deviceMetadata.gpsCoords,
            'rotate': authenticProfile.deviceMetadata.orientation === 'Portrait' ? '90' : '0',
            'com.apple.quicktime.software': authenticProfile.deviceMetadata.deviceModel
          };

          Object.entries(allMetadata).forEach(([key, value]) => {
            if (value && value.toString().trim()) { // Seulement si la valeur existe
              ffmpegArgs.push('-metadata', `${key}=${value}`);
            }
          });

          // Ajouter des paramètres pour forcer l'arrêt propre
          ffmpegArgs.push(
            '-avoid_negative_ts', 'make_zero',
            '-shortest' // S'arrêter dès que la plus courte source se termine
          );

          ffmpegArgs.push('-y', outputPath);

          console.log(`[TikTok Creative] FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`);
          const ffmpeg = spawn('ffmpeg', ffmpegArgs);

          ffmpeg.stdout.on('data', (data) => {
            console.log(`[FFmpeg stdout]: ${data.toString()}`);
          });

          ffmpeg.stderr.on('data', (data) => {
            const output = data.toString();
            console.log(`[FFmpeg stderr]: ${output}`);
            if (output.includes('Error') || output.includes('Invalid') || output.includes('failed')) {
              console.error(`[FFmpeg Error]: ${output}`);
            }
          });

          ffmpeg.on('close', (code) => {
            if (code === 0) {
              console.log(`[TikTok Creative] Video ${videoIndex + 1} created successfully`);
              resolve(outputPath);
            } else {
              reject(new Error(`FFmpeg exited with code ${code}`));
            }
          });

          ffmpeg.on('error', (err) => {
            reject(err);
          });
        });

        // If user is authenticated, upload to Supabase
        let videoUrl = `/generated-videos/${path.basename(outputPath)}`;
        let videoId: string | undefined;

        if (userId) {
          try {
            const result = await uploadAndSaveGeneratedVideo(
              userId,
              outputPath,
              path.basename(outputPath),
              'tiktok-creative',
              {
                hooks,
                mediaCount: finalMediaSequence.length,
                totalDuration: `${finalDuration}s`,
                ultraFastTiming: `${randomTiming}ms`,
                loopCount: loopCount,
                tikTokCreative: true,
                dynamicTemplates: true,
                variation: `Template #${videoIndex + 1}`
              }
            );

            if (result) {
              videoUrl = result.url;
              videoId = result.id;
              console.log(`[TikTok Creative] Video uploaded to Supabase: ${videoId}`);

              // Delete the local file after successful upload
              await fs.unlink(outputPath).catch(() => {});
            }
          } catch (uploadError) {
            console.error('[TikTok Creative] Failed to upload to Supabase:', uploadError);
            // Continue with local URL if upload fails
          }
        }

        // Nettoyer le dossier temporaire
        await fs.rm(tempDir, { recursive: true, force: true });

        // Ajouter à la liste des vidéos générées
        generatedVideos.push({
          url: videoUrl,
          id: videoId,
          index: videoIndex,
          tikTokCreative: {
            mediaSelected: finalMediaSequence.length,
            totalDuration: `${finalDuration.toFixed(1)}s`,
            ultraFastTiming: `${randomTiming}ms`,
            loopCount: loopCount,
            authenticProfile: {
              type: authenticProfile.profileType,
              codec: `${authenticProfile.codec}/${authenticProfile.profile}`,
              fps: authenticProfile.fps,
              videoBitrate: authenticProfile.videoBitrate,
              audioBitrate: authenticProfile.audioBitrate,
              audioSampleRate: authenticProfile.audioSampleRate,
              audioChannels: authenticProfile.audioChannels,
              filename: authenticProfile.filenameHash
            }
          },
          variation: `Template #${videoIndex + 1}`
        });

      } catch (error) {
        // Nettoyer en cas d'erreur
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        throw error;
      }
    }

    return NextResponse.json({
      success: true,
      videos: generatedVideos,
      message: `🎵 TikTok Creative generated ${videoCount} template variation(s)`,
      stats: {
        totalVariations: videoCount,
        tikTokCreative: true,
        dynamicTemplates: true,
        templateStyle: `Intelligent timing 100-900ms per clip (adaptive image count, anti-loop detection)`,
        authenticProfiles: {
          enabled: true,
          types: 'iPhone 17 Pro, CapCut Android, TikTok Studio',
          features: 'Authentic codec/bitrate/fps/audio/metadata/filenames per profile',
          purpose: 'Perfect mimicry of real user uploads'
        },
        timestamp: timestamp
      }
    });

  } catch (error) {
    console.error('[TikTok Creative] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate video',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
