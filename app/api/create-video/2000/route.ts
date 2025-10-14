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

// Fonts 2000
const fonts2000 = [
  '/fonts/2000/Alias/OpenType-TT/Alias-Bold.ttf',
  '/fonts/new-fonts/Silk Serif SemiBold.otf'
];

function get2000Font(index: number): string {
  const fontIndex = index % fonts2000.length;
  return path.join(process.cwd(), 'public' + fonts2000[fontIndex]);
}

function getSelectedFont(fontId: string): string {
  const fontMap: { [key: string]: string } = {
    'silk': '/fonts/new-fonts/Silk Serif SemiBold.otf',
    'tiktok': '/fonts/TikTokDisplayBold.otf',
    'railroad': '/fonts/RailroadGothicCC.ttf',
    'pencil': '/fonts/PENCIL SHARP.ttf',
    'gunterz': '/fonts/Fontspring-DEMO-gunterz-bold.otf'
  };

  const fontPath = fontMap[fontId] || fontMap['tiktok'];
  return path.join(process.cwd(), 'public' + fontPath);
}

// Fonction pour convertir couleur hex en format FFmpeg
function hexToFFmpegColor(hex: string): string {
  // Enlever le # si présent
  hex = hex.replace('#', '');
  // FFmpeg utilise le format 0xRRGGBB
  return `0x${hex}`;
}

// Fonction pour mesurer la largeur d'un texte en pixels
async function measureTextWidth(text: string, fontPath: string, fontSize: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const escapedText = text.replace(/'/g, "'\\''").replace(/:/g, "\\:");

    // Créer une image temporaire avec le texte pour mesurer sa largeur
    const ffmpegArgs = [
      '-f', 'lavfi',
      '-i', 'color=c=black:s=1920x1080:d=0.1',
      '-vf', `drawtext=fontfile='${fontPath}':text='${escapedText}':fontsize=${fontSize}:x=0:y=0:fontcolor=white`,
      '-frames:v', '1',
      '-f', 'null',
      '-'
    ];

    const ff = spawn('ffmpeg', ffmpegArgs);
    let output = '';

    ff.stderr.on('data', (data) => {
      output += data.toString();
    });

    ff.on('close', () => {
      // Parser la sortie pour obtenir la largeur du texte
      // On utilise une approximation : nombre de caractères * fontSize * 0.6
      const charCount = text.length;
      const estimatedWidth = Math.ceil(charCount * fontSize * 0.6);
      resolve(estimatedWidth);
    });

    ff.on('error', () => {
      // Fallback sur une estimation
      const charCount = text.length;
      const estimatedWidth = Math.ceil(charCount * fontSize * 0.6);
      resolve(estimatedWidth);
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const videos: any[] = body?.videos || [];
    const videosBeforeRefrain: any[] = body?.videosBeforeRefrain || [];
    const videosAfterRefrain: any[] = body?.videosAfterRefrain || [];
    const useOneCollection: boolean = body?.useOneCollection || false; // Utiliser 1 seule collection
    const music = body?.music;
    const selectedFonts: string[] = body?.selectedFonts || ['silk'];
    const position = body?.position || { position: 'center', offset: 0 };
    const wordTimestamps: Array<{text: string, start: number, end: number}> = body?.wordTimestamps || [];
    const lyricsStyle: 'words' | 'multi-line' | 'stacked' = body?.lyricsStyle || 'words';

    // Font size fixe selon le style : Word by Word = 250px, Sentence at Once = 70px, Stacked = 120px
    const fontSize = lyricsStyle === 'words' ? 250 : lyricsStyle === 'stacked' ? 120 : 70;
    const fontStyle = body?.style || 4; // 1 = Border, 4 = Normal (default: Normal)
    const textColors: string[] = body?.textColors || ['#FFFFFF']; // Default: white

    // Choisir UNE couleur random pour toute la vidéo
    const randomVideoColor = textColors[Math.floor(Math.random() * textColors.length)];
    const videoColor = hexToFFmpegColor(randomVideoColor);

    console.log('[Auto Lyrics] Received request:', {
      videosCount: videos.length,
      hasMusic: !!music?.url,
      selectedFont: selectedFonts[0],
      fontSize: fontSize,
      position: position,
      wordsCount: wordTimestamps.length,
      lyricsStyle: lyricsStyle
    });

    // Vérifier qu'on a soit des vidéos normales, soit les vidéos before/after refrain
    const hasVideos = videos && videos.length > 0;
    const hasBeforeAfterVideos = (videosBeforeRefrain && videosBeforeRefrain.length > 0) &&
                                  (useOneCollection || (videosAfterRefrain && videosAfterRefrain.length > 0));

    if (!hasVideos && !hasBeforeAfterVideos) {
      return NextResponse.json({ error: 'At least 1 video is required (or both before/after refrain videos)' }, { status: 400 });
    }

    if (!wordTimestamps || wordTimestamps.length === 0) {
      return NextResponse.json({ error: 'Word timestamps are required. Please detect lyrics first.' }, { status: 400 });
    }

    // Calculer les segments de changement de vidéo dynamiquement
    const musicDuration = music?.duration || 30;

    const chords: number[] = [0, 0.75, 2.00, 3.20, 4.40, 5.60, 6.80, 8.00, 9.20, 10.40, 11.60, 12.80, 14.00, 15.20, 16.40, 17.60, 18.80, 20.00, 21.20, 22.40, 23.60, 24.80, 26.00, 27.20, 28.40, 29.60];

    // Si la musique est plus longue, continuer avec l'intervalle de 1.20s
    let currentTime = chords[chords.length - 1];
    while (currentTime < musicDuration) {
      currentTime += 1.20;
      if (currentTime < musicDuration) {
        chords.push(currentTime);
      }
    }
    chords.push(musicDuration); // Ajouter la fin

    const ts = Date.now();

    // Skip downloading videos from the old 'videos' array since we're using before/after refrain collections
    // The before/after videos will be downloaded later in the code

    // Télécharger la musique si présente
    let musicPath: string | undefined;
    if (music?.url) {
      if (music.url.startsWith('data:')) {
        const data = music.url.replace(/^data:audio\/\w+;base64,/, '');
        musicPath = `/tmp/m${ts}.mp3`;
        await fs.writeFile(musicPath, data, 'base64');
      } else if (music.url.startsWith('http')) {
        const res = await fetch(music.url);
        const buf = Buffer.from(await res.arrayBuffer());
        musicPath = `/tmp/m${ts}.mp3`;
        await fs.writeFile(musicPath, buf);
      } else {
        musicPath = music.url;
      }
    }

    // Calculer la position Y selon le paramètre position
    let baseY = 860; // Position par défaut (centre, ajusté visuellement)
    if (position.position === 'top') {
      baseY = 200 + position.offset;
    } else if (position.position === 'bottom') {
      baseY = 1700 + position.offset;
    } else if (position.position === 'middle' || position.position === 'center') { // center ou middle
      baseY = 860 + position.offset;
    }

    // Espacement entre les lignes (calculé selon la taille de font)
    const lineSpacing = Math.round(fontSize * 1.5);

    // Grouper les mots selon le style sélectionné
    let lyricsLines: Array<{ line: number, words: Array<{text: string, start: number, end: number}>, yPosition: number }> = [];

    if (lyricsStyle === 'words') {
      // Mode "Words": Afficher chaque mot individuellement
      lyricsLines = wordTimestamps.map((word, index) => ({
        line: index + 1,
        words: [{ text: word.text, start: word.start, end: word.end }],
        yPosition: baseY
      }));
    } else if (lyricsStyle === 'multi-line') {
      // Mode "Multi-line": Grouper en phrases et afficher sur 3 lignes max
      let currentLine: typeof wordTimestamps = [];
      let lineNumber = 1;

      for (let i = 0; i < wordTimestamps.length; i++) {
        const word = wordTimestamps[i];
        currentLine.push(word);

        const isLastWord = i === wordTimestamps.length - 1;
        const nextWord = !isLastWord ? wordTimestamps[i + 1] : null;
        const silence = nextWord ? nextWord.start - word.end : 999;

        if (isLastWord || silence > 0.3) {
          lyricsLines.push({
            line: lineNumber++,
            words: [...currentLine],
            yPosition: baseY
          });
          currentLine = [];
        }
      }
    }

    // Aplatir toutes les paroles pour le traitement
    const allWords = lyricsLines.flatMap(line =>
      line.words.map(word => ({ ...word, yPosition: line.yPosition }))
    );

    console.log(`[Auto Lyrics] Generating video with ${allWords.length} timed words from AssemblyAI`);

    // Chemin de sortie
    const outputPath = `/tmp/o${ts}.mp4`;
    const finalOutputPath = path.join(process.cwd(), 'public', 'generated-videos', `2000_${ts}.mp4`);

    // Étape 1: Créer les segments puis les concaténer sans réencodage
    console.log('[Auto Lyrics] Step 1: Creating video segments...');

    const totalSegments = chords.length - 1;
    const refrainStartTime = 12.80; // Le refrain commence à 12.80s

    // Trouver l'index du segment qui commence à 12.80s
    let refrainSegmentIndex = chords.findIndex(t => t >= refrainStartTime);
    if (refrainSegmentIndex === -1) refrainSegmentIndex = totalSegments;

    // Utiliser les 2 collections de vidéos
    const videosBeforePaths: string[] = [];
    const videosAfterPaths: string[] = [];

    // Télécharger les vidéos "before refrain"
    for (let i = 0; i < videosBeforeRefrain.length; i++) {
      const video = videosBeforeRefrain[i];
      let videoPath: string;
      if (video.url.startsWith('data:')) {
        const data = video.url.replace(/^data:video\/\w+;base64,/, '');
        videoPath = `/tmp/before_${ts}_${i}.mp4`;
        await fs.writeFile(videoPath, data, 'base64');
      } else if (video.url.startsWith('http')) {
        const res = await fetch(video.url);
        const buf = Buffer.from(await res.arrayBuffer());
        videoPath = `/tmp/before_${ts}_${i}.mp4`;
        await fs.writeFile(videoPath, buf);
      } else {
        videoPath = video.url;
      }
      videosBeforePaths.push(videoPath);
    }

    // Télécharger les vidéos "after refrain" (ou réutiliser "before" si useOneCollection)
    if (useOneCollection) {
      // Si on utilise une seule collection, réutiliser les vidéos "before" pour "after"
      videosAfterPaths.push(...videosBeforePaths);
      console.log('[Auto Lyrics] Using ONE collection for the entire video');
    } else {
      // Sinon, télécharger les vidéos "after refrain" normalement
      for (let i = 0; i < videosAfterRefrain.length; i++) {
        const video = videosAfterRefrain[i];
        let videoPath: string;
        if (video.url.startsWith('data:')) {
          const data = video.url.replace(/^data:video\/\w+;base64,/, '');
          videoPath = `/tmp/after_${ts}_${i}.mp4`;
          await fs.writeFile(videoPath, data, 'base64');
        } else if (video.url.startsWith('http')) {
          const res = await fetch(video.url);
          const buf = Buffer.from(await res.arrayBuffer());
          videoPath = `/tmp/after_${ts}_${i}.mp4`;
          await fs.writeFile(videoPath, buf);
        } else {
          videoPath = video.url;
        }
        videosAfterPaths.push(videoPath);
      }
      console.log('[Auto Lyrics] Using TWO collections (before/after refrain)');
    }

    console.log(`[Auto Lyrics] Loaded ${videosBeforePaths.length} videos before refrain, ${videosAfterPaths.length} after refrain`);
    console.log(`[Auto Lyrics] Total segments to create: ${chords.length - 1}, refrain starts at segment ${refrainSegmentIndex}`);

    // Sélectionner des vidéos différentes pour chaque segment
    const shuffledBeforeVideos = [...videosBeforePaths].sort(() => Math.random() - 0.5);
    const shuffledAfterVideos = [...videosAfterPaths].sort(() => Math.random() - 0.5);

    const selectedVideos = [];
    for (let i = 0; i < totalSegments; i++) {
      if (i < refrainSegmentIndex) {
        // Avant le refrain : utiliser videosBeforeRefrain
        selectedVideos.push(shuffledBeforeVideos[i % videosBeforePaths.length]);
      } else {
        // Après le refrain : utiliser videosAfterRefrain
        const afterIndex = i - refrainSegmentIndex;
        selectedVideos.push(shuffledAfterVideos[afterIndex % videosAfterPaths.length]);
      }
    }

    console.log(`[Auto Lyrics] Creating ${totalSegments} segments...`);

    // Créer tous les segments rapidement
    const videoSegments: string[] = [];
    const segmentPromises = [];

    for (let i = 0; i < totalSegments; i++) {
      const duration = chords[i + 1] - chords[i];
      const videoPath = selectedVideos[i];
      const segmentPath = `/tmp/seg_${i}_${ts}.mp4`;

      // Log segments around refrain
      if (i >= 10 && i <= 13) {
        console.log(`[Debug] Segment ${i}: ${chords[i]}s → ${chords[i+1]}s (duration: ${duration}s) - ${i < refrainSegmentIndex ? 'BEFORE' : 'AFTER'}`);
      }

      const segArgs = [
        '-stream_loop', '-1',
        '-i', videoPath,
        '-t', duration.toString(),
        '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30',
        '-an',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-r', '30',
        '-y', segmentPath
      ];

      const promise = new Promise((resolve, reject) => {
        const ff = spawn('ffmpeg', segArgs);
        ff.on('close', (code) => code === 0 ? resolve(segmentPath) : reject(new Error(`Seg ${i} failed`)));
        ff.on('error', reject);
      });

      segmentPromises.push(promise);
      videoSegments.push(segmentPath);
    }

    // Créer max 6 segments en parallèle à la fois
    for (let i = 0; i < segmentPromises.length; i += 6) {
      const batch = segmentPromises.slice(i, i + 6);
      await Promise.all(batch);
      console.log(`[Auto Lyrics] Created segments ${i + 1}-${Math.min(i + 6, totalSegments)}/${totalSegments}`);
    }

    // Créer liste concat
    const concatListPath = `/tmp/concat_${ts}.txt`;
    const concatList = videoSegments.map(seg => `file '${seg}'`).join('\n');
    await fs.writeFile(concatListPath, concatList);

    // Concaténer avec un léger réencodage pour éviter les lags
    const concatenatedPath = `/tmp/concatenated_${ts}.mp4`;
    const concatArgs = [
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-r', '30',
      '-pix_fmt', 'yuv420p',
      '-y', concatenatedPath
    ];

    console.log('[Auto Lyrics] Concatenating segments...');
    await new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', concatArgs);
      ff.on('close', (code) => code === 0 ? resolve(null) : reject(new Error('Concat failed')));
      ff.on('error', reject);
    });

    // Ajouter musique
    const step1Path = `/tmp/s1_${ts}.mp4`;
    const addMusicArgs = musicPath ? [
      '-i', concatenatedPath,
      '-i', musicPath,
      '-shortest',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-y', step1Path
    ] : [
      '-i', concatenatedPath,
      '-c', 'copy',
      '-y', step1Path
    ];

    console.log('[Auto Lyrics] Adding music...');
    await new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', addMusicArgs);
      ff.on('close', (code) => code === 0 ? resolve(null) : reject(new Error('Add music failed')));
      ff.on('error', reject);
    });

    // Nettoyer
    for (const seg of videoSegments) {
      await fs.unlink(seg).catch(() => {});
    }
    await fs.unlink(concatListPath).catch(() => {});
    await fs.unlink(concatenatedPath).catch(() => {});

    // Étape 2: Ajouter tous les lyrics en plusieurs passes pour le mode "line"
    console.log('[Auto Lyrics] Step 2: Adding all lyrics...');

    const selectedFontPath = getSelectedFont(selectedFonts[0]);
    const selectedFontId = selectedFonts[0];
    // Border uniquement si style === 1 (Border) ET font TikTok
    const borderWidth = (fontStyle === 1 && selectedFontId === 'tiktok') ? 3 : 0;
    const borderColor = 'black';

    const drawTextFilters: string[] = [];

    // Pour le mode "multi-line", on va créer d'abord la couche fantôme puis ajouter les mots opaques
    let needsGhostLayer = lyricsStyle === 'multi-line';

    if (lyricsStyle === 'words') {
      // Mode "Words": Afficher chaque mot individuellement avec fade out
      for (let lineIndex = 0; lineIndex < lyricsLines.length; lineIndex++) {
        const currentLine = lyricsLines[lineIndex];
        const lineWords = currentLine.words;
        const fullLineText = lineWords[0].text;
        const escapedText = fullLineText.replace(/'/g, "'\\''").replace(/:/g, "\\:");

        const lineStart = lineWords[0].start;
        const lineOriginalEnd = lineWords[0].end;

        let lineEnd = lineOriginalEnd;
        const silenceThreshold = 0.3;

        if (lineIndex < lyricsLines.length - 1) {
          const nextLineStart = lyricsLines[lineIndex + 1].words[0].start;
          const silenceDuration = nextLineStart - lineOriginalEnd;
          if (silenceDuration > silenceThreshold) {
            const holdDuration = Math.min(0.2, silenceDuration * 0.3);
            lineEnd = lineOriginalEnd + holdDuration + 0.5;
          } else {
            lineEnd = nextLineStart;
          }
        } else {
          lineEnd = lineOriginalEnd + 0.65;
        }

        // Utiliser la couleur unique de la vidéo
        let filter = `drawtext=fontfile='${selectedFontPath}':text='${escapedText}':fontcolor=${videoColor}:fontsize=${fontSize}:x=(w-text_w)/2:y=${baseY}`;

        if (borderWidth > 0) {
          filter += `:borderw=${borderWidth}:bordercolor=${borderColor}`;
        }

        filter += `:enable='between(t,${lineStart},${lineEnd})'`;
        drawTextFilters.push(filter);
      }
    } else if (lyricsStyle === 'multi-line') {
      // Mode "Multi-line": Afficher la phrase complète avec fade out
      for (let lineIndex = 0; lineIndex < lyricsLines.length; lineIndex++) {
        const currentLine = lyricsLines[lineIndex];
        const lineWords = currentLine.words;

        // Joindre tous les mots de la ligne
        const fullLineText = lineWords.map(w => w.text).join(' ');
        const escapedText = fullLineText.replace(/'/g, "'\\''").replace(/:/g, "\\:");

        const lineStart = lineWords[0].start;
        const lineOriginalEnd = lineWords[lineWords.length - 1].end;

        let lineEnd = lineOriginalEnd;
        const silenceThreshold = 0.3;

        if (lineIndex < lyricsLines.length - 1) {
          const nextLineStart = lyricsLines[lineIndex + 1].words[0].start;
          const silenceDuration = nextLineStart - lineOriginalEnd;
          if (silenceDuration > silenceThreshold) {
            const holdDuration = Math.min(0.2, silenceDuration * 0.3);
            lineEnd = lineOriginalEnd + holdDuration + 0.5;
          } else {
            lineEnd = nextLineStart;
          }
        } else {
          lineEnd = lineOriginalEnd + 0.65;
        }

        // Utiliser la couleur unique de la vidéo
        // Toujours utiliser baseY (position centrale fixe)
        let filter = `drawtext=fontfile='${selectedFontPath}':text='${escapedText}':fontcolor=${videoColor}:fontsize=${fontSize}:x=(w-text_w)/2:y=${baseY}`;

        if (borderWidth > 0) {
          filter += `:borderw=${borderWidth}:bordercolor=${borderColor}`;
        }

        filter += `:enable='between(t,${lineStart},${lineEnd})'`;
        drawTextFilters.push(filter);
      }
    } else if (lyricsStyle === 'stacked') {
      // Mode "Stacked": Afficher 4 lignes empilées verticalement, chaque ligne avec 1-3 mots
      const maxWordsPerLine = 3;
      const maxVisibleLines = 4;
      const lineSpacingStacked = Math.round(fontSize * 1.3);

      // Grouper les mots en petites phrases (1-3 mots max)
      const stackedLines: Array<{words: typeof wordTimestamps, start: number, end: number}> = [];
      let currentStackLine: typeof wordTimestamps = [];

      for (let i = 0; i < wordTimestamps.length; i++) {
        const word = wordTimestamps[i];
        currentStackLine.push(word);

        // Créer une nouvelle ligne tous les 1-3 mots
        if (currentStackLine.length >= maxWordsPerLine || i === wordTimestamps.length - 1) {
          stackedLines.push({
            words: [...currentStackLine],
            start: currentStackLine[0].start,
            end: currentStackLine[currentStackLine.length - 1].end
          });
          currentStackLine = [];
        }
      }

      // Afficher les lignes avec un système de fenêtre glissante (4 lignes max visibles)
      for (let lineIndex = 0; lineIndex < stackedLines.length; lineIndex++) {
        const line = stackedLines[lineIndex];
        const lineText = line.words.map(w => w.text).join(' ');
        const escapedText = lineText.replace(/'/g, "'\\''").replace(/:/g, "\\:");

        const lineStart = line.start;
        let lineEnd = line.end;

        // Prolonger l'affichage jusqu'au début de la prochaine ligne ou fin
        if (lineIndex < stackedLines.length - 1) {
          lineEnd = stackedLines[lineIndex + 1].start;
        } else {
          lineEnd = line.end + 0.65;
        }

        // Calculer la position Y pour cette ligne dans la fenêtre de 4 lignes
        // La ligne la plus récente est en bas, les anciennes remontent
        const positionInWindow = Math.min(lineIndex, maxVisibleLines - 1);
        const startY = baseY - (lineSpacingStacked * 1.5);
        const yPosition = startY + (positionInWindow * lineSpacingStacked);

        let filter = `drawtext=fontfile='${selectedFontPath}':text='${escapedText}':fontcolor=${videoColor}:fontsize=${fontSize}:x=(w-text_w)/2:y=${yPosition}`;

        if (borderWidth > 0) {
          filter += `:borderw=${borderWidth}:bordercolor=${borderColor}`;
        }

        filter += `:enable='between(t,${lineStart},${lineEnd})'`;
        drawTextFilters.push(filter);
      }
    }

    const combinedFilter = drawTextFilters.join(',');

    // Appliquer tous les lyrics en une passe
    console.log(`[Auto Lyrics] Applying ${drawTextFilters.length} lyrics...`);

    const textStepArgs = [
      '-i', step1Path,
      '-vf', combinedFilter,
      '-c:a', 'copy',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-y', outputPath
    ];

    await new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', textStepArgs);
      ff.stderr.on('data', (d) => {
        const msg = d.toString();
        if (msg.includes('Error') || msg.includes('failed')) {
          console.error('[Auto Lyrics Text]:', msg);
        }
      });
      ff.on('close', (code) => {
        if (code === 0) resolve(null);
        else reject(new Error('Text overlay failed'));
      });
      ff.on('error', reject);
    });

    // Nettoyer les fichiers temporaires
    await fs.unlink(step1Path).catch(() => {});

    // Nettoyer les vidéos before/after refrain
    for (const videoPath of videosBeforePaths) {
      if (videoPath.startsWith('/tmp/')) {
        await fs.unlink(videoPath).catch(() => {});
      }
    }
    for (const videoPath of videosAfterPaths) {
      if (videoPath.startsWith('/tmp/')) {
        await fs.unlink(videoPath).catch(() => {});
      }
    }
    if (musicPath) await fs.unlink(musicPath).catch(() => {});

    // Copier le fichier de sortie vers le chemin final
    await fs.copyFile(outputPath, finalOutputPath);
    await fs.unlink(outputPath).catch(() => {});

    console.log('[Auto Lyrics] Video generated successfully');

    return NextResponse.json({
      success: true,
      videoPath: `/generated-videos/2000_${ts}.mp4`
    });

  } catch (e: any) {
    console.error('[Auto Lyrics] Error:', e);
    return NextResponse.json({
      error: e?.message || 'Failed to generate Auto Lyrics - For the living video'
    }, { status: 500 });
  }
}
