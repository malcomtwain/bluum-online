import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

async function getDurationSeconds(filePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    const ff = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath]);
    let out = '';
    ff.stdout.on('data', (d) => (out += d.toString()));
    ff.on('close', () => {
      const secs = parseFloat((out || '').trim());
      if (Number.isFinite(secs)) resolve(secs);
      else resolve(null);
    });
    ff.on('error', () => resolve(null));
  });
}

// Fonction pour obtenir le chemin de la font sélectionnée
function getFontPath(selectedFont: string): string {
  const fontMap: { [key: string]: string } = {
    'all': '/fonts/TikTokDisplayMedium.otf',
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

  return fontMap[selectedFont] || fontMap['tiktok'];
}

// Fonction pour sélectionner une font aléatoire parmi les fonts sélectionnées
function getRandomSelectedFontPath(selectedFonts: string[], seed: number): string {
  if (selectedFonts.length === 0) {
    return '/fonts/TikTokDisplayMedium.otf';
  }

  if (selectedFonts.length === 1) {
    return getFontPath(selectedFonts[0]);
  }

  const randomIndex = Math.floor(Math.abs(Math.sin(seed * 0.00789) * 10000) % selectedFonts.length);
  return getFontPath(selectedFonts[randomIndex]);
}

// Fonction pour calculer la taille de font (retourne un multiplicateur)
function getFontSizeMultiplier(fontSize: number, randomFontSize: boolean, seed: number): number {
  if (randomFontSize) {
    const minSize = 60;
    const maxSize = 120;
    const randomSize = minSize + Math.floor(Math.abs(Math.sin(seed * 0.00456) * 10000) % (maxSize - minSize + 1));
    return randomSize / 100;
  }

  return fontSize / 100;
}

// Fonction pour calculer une position random intelligente
function getRandomPosition(position: string, randomPosition: boolean, fontSize: number, fontSizeMultiplier: number, seed: number, hookText: string = ''): { x: number, y: number } {
  if (!randomPosition) {
    let startY = 902;
    if (position === 'top') {
      startY = 230;
    } else if (position === 'bottom') {
      startY = 1382;
    }
    return { x: 540, y: startY };
  }

  const videoWidth = 1080;
  const videoHeight = 1920;

  const safeZoneMarginX = videoWidth * 0.15;
  const safeZoneMarginTop = 300;
  const safeZoneMarginBottom = 450;

  const minX = safeZoneMarginX;
  const maxX = videoWidth - safeZoneMarginX;
  const minY = safeZoneMarginTop;
  const maxY = videoHeight - safeZoneMarginBottom;

  const randomY = minY + Math.floor(Math.abs(Math.sin(seed * 0.00123) * 10000) % (maxY - minY + 1));
  const randomX = minX + Math.floor(Math.abs(Math.sin(seed * 0.00789) * 10000) % (maxX - minX + 1));

  return { x: randomX, y: randomY };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const videos: any[] = body?.videos || [];
    const hooks: string[] = body?.hooks || [];
    const style: number = body?.style ?? 1;
    const positionInput: 'top' | 'middle' | 'bottom' = body?.position || 'middle';
    const offset: number = body?.offset || 0;
    const music = body?.music;
    const selectedFonts: string[] | undefined = body?.selectedFonts;
    const randomFontSize: boolean = !!body?.randomFontSize;
    const randomPosition: boolean = !!body?.randomPosition;
    const fontSizeInput: number = body?.fontSize || 50;

    // Fallback: try part2 if videos not provided
    if ((!videos || videos.length === 0) && body?.part2?.url) {
      const p2 = body.part2;
      if (p2.type === 'video' || !p2.type) videos.push({ url: p2.url, duration: p2.duration?.max || p2.duration?.min });
    }
    if (!videos || videos.length === 0) {
      return NextResponse.json({ error: 'At least 1 video is required' }, { status: 400 });
    }

    // Choose first video with duration >= 6s (if provided); otherwise check via ffprobe
    let chosen = videos[0];
    for (const v of videos) {
      if (v?.duration && v.duration >= 6) { chosen = v; break; }
    }

    // Prepare temp paths
    const ts = Date.now();
    const tempDir = path.join(process.cwd(), 'public', 'generated-videos', `one_shoot_${ts}`);
    await fs.mkdir(tempDir, { recursive: true });

    let inputVideoPath: string;
    if (chosen.url.startsWith('data:')) {
      const data = chosen.url.replace(/^data:video\/\w+;base64,/, '');
      inputVideoPath = path.join(tempDir, 'input.mp4');
      await fs.writeFile(inputVideoPath, data, 'base64');
    } else if (chosen.url.startsWith('http')) {
      // Download to temp for duration check and processing
      const res = await fetch(chosen.url);
      const buf = Buffer.from(await res.arrayBuffer());
      inputVideoPath = path.join(tempDir, 'input.mp4');
      await fs.writeFile(inputVideoPath, buf);
    } else {
      inputVideoPath = chosen.url;
    }

    // Handle music: write to file if base64 to avoid E2BIG
    let musicPath: string | null = null;
    if (music?.url) {
      if (music.url.startsWith('data:')) {
        const musicData = music.url.replace(/^data:audio\/\w+;base64,/, '');
        musicPath = path.join(tempDir, 'music.mp3');
        await fs.writeFile(musicPath, musicData, 'base64');
      } else if (music.url.startsWith('http')) {
        const res = await fetch(music.url);
        const buf = Buffer.from(await res.arrayBuffer());
        musicPath = path.join(tempDir, 'music.mp3');
        await fs.writeFile(musicPath, buf);
      } else {
        musicPath = music.url; // Local file path
      }
    }

    // Optional: scale/crop for 1080x1920 portrait
    const outputPath = path.join(process.cwd(), 'public', 'generated-videos', `one_shoot_${ts}.mp4`);

    const videoFilters = [
      'scale=1080:1920:force_original_aspect_ratio=increase',
      'crop=1080:1920',
      'setsar=1'
    ];

    // Enforce minimum 6s duration
    const durationSec = await getDurationSeconds(inputVideoPath);
    if (durationSec !== null && durationSec < 6) {
      return NextResponse.json({ error: 'Video must be at least 6 seconds' }, { status: 400 });
    }

    // Hook options with randomization logic
    // Générer un seed unique pour ce template
    const videoSeed = ts + (videos.length * 137) + ((hooks?.length || 0) * 73);

    // Sélectionner un hook aléatoire si des hooks sont fournis
    let hookText = '';
    if (hooks && hooks.length > 0) {
      const hookIndex = Math.floor((Math.sin(videoSeed * 0.001) * 10000) % hooks.length);
      hookText = hooks[Math.abs(hookIndex)] || hooks[0];
      console.log(`[One Shoot] Selected random hook ${Math.abs(hookIndex)}:`, hookText);
    }

    const addHook = !!hookText && hookText.trim().length > 0;

    if (addHook) {

      // Sélectionner la font selon le style et les fonts sélectionnées
      let fontRelativePath;
      const selectedFontsArray = Array.isArray(selectedFonts) && selectedFonts.length > 0 ? selectedFonts : ['tiktok'];

      if (style === 2 || style === 3) {
        // Styles 2 et 3 : forcer TikTok font
        fontRelativePath = '/fonts/TikTokDisplayMedium.otf';
      } else {
        // Utiliser la sélection aléatoire parmi les fonts choisies
        fontRelativePath = getRandomSelectedFontPath(selectedFontsArray, videoSeed);
      }

      const fontPath = path.join(process.cwd(), 'public' + fontRelativePath);

      // Calculer le multiplicateur de taille de font
      const fontSizeMultiplier = getFontSizeMultiplier(fontSizeInput, randomFontSize, videoSeed);

      // Définir les styles selon le type
      let fontColor = 'white';
      let borderColor = 'black';
      let borderWidth = 3;
      let baseFontSize = 50;

      if (style === 1) {
        fontColor = 'white';
        borderColor = 'black';
        borderWidth = 3;
        baseFontSize = 50;
      } else if (style === 2) {
        fontColor = 'black';
        borderColor = 'white';
        borderWidth = 8;
        baseFontSize = 65;
      } else if (style === 3) {
        fontColor = 'white';
        borderColor = 'black';
        borderWidth = 8;
        baseFontSize = 65;
      } else if (style === 4) {
        fontColor = 'white';
        borderColor = 'transparent';
        borderWidth = 0;
        baseFontSize = 50;
      }

      // Appliquer le multiplicateur de taille
      const finalFontSize = Math.round(baseFontSize * fontSizeMultiplier);

      // Calculer position avec système intelligent
      const basePosition = getRandomPosition(positionInput, randomPosition, fontSizeInput, fontSizeMultiplier, videoSeed, hookText);
      let startY = basePosition.y;
      let startX = basePosition.x;

      // Appliquer l'offset seulement si position n'est pas random
      if (!randomPosition) {
        startY += offset * 8;
      }

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

      const lines = wrapText(hookText, 35);
      const lineHeight = 70;

      // Limiter à 5 lignes maximum pour éviter E2BIG
      const maxLines = 5;
      const limitedLines = lines.slice(0, maxLines);

      if (lines.length > maxLines) {
        console.log(`[One Shoot] Warning: Text truncated from ${lines.length} to ${maxLines} lines to avoid E2BIG`);
      }

      // Ajouter chaque ligne comme un drawtext séparé
      limitedLines.forEach((line, index) => {
        const escapedLine = line.replace(/'/g, "\\\\'").replace(/:/g, "\\\\:");
        const yPosition = startY + (index * lineHeight);

        // Calculer position X avec micro-décalages subtils
        let xPosition;
        if (randomPosition) {
          const textLength = escapedLine.length;
          const microOffset = Math.floor(Math.abs(Math.sin(videoSeed * 0.001 + textLength) * 1000) % 31) - 15;
          xPosition = `(w-text_w)/2${microOffset >= 0 ? '+' : ''}${microOffset}`;
        } else {
          xPosition = '(w-text_w)/2';
        }

        let drawtextCommand = `drawtext=text='${escapedLine}':fontfile='${fontPath}':fontsize=${finalFontSize}:fontcolor=${fontColor}:x=${xPosition}:y=${yPosition}`;

        if (borderWidth > 0) {
          drawtextCommand += `:borderw=${borderWidth}:bordercolor=${borderColor}`;
        }

        videoFilters.push(drawtextCommand);
      });

      console.log(`[One Shoot] Font: ${fontRelativePath}, Size: ${finalFontSize}, Position: (${startX}, ${startY}), Random: ${randomPosition}`);
    }

    // Tout appliquer en une seule commande comme TikTok Creative
    console.log('[One Shoot] Applying all filters in one pass');

    const ffArgs = [
      '-i', inputVideoPath,
      ...(musicPath ? ['-i', musicPath] : []),
      '-vf', videoFilters.join(','),
      ...(musicPath ? ['-map', '0:v', '-map', '1:a', '-shortest'] : []),
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-y', outputPath
    ];

    await new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', ffArgs);
      let stderr = '';
      ff.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      ff.on('close', (code) => {
        if (code === 0) {
          resolve(null);
        } else {
          console.error('[FFmpeg] Error:', stderr);
          reject(new Error(`ffmpeg failed with code ${code}`));
        }
      });
      ff.on('error', (err) => reject(err));
    });

    return NextResponse.json({ success: true, videoPath: `/generated-videos/one_shoot_${ts}.mp4` });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to generate One shoot' }, { status: 500 });
  }
}


