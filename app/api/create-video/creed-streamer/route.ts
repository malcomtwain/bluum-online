import { NextResponse } from 'next/server';
import { updateProgress } from '@/lib/progress';

// Lazy require Node APIs only on the server
let pathModule: any = null;
let fsPromises: any = null;
let fs: any = null;
let childProcess: any = null;
let util: any = null;
let nodeFetch: any = null;

if (typeof window === 'undefined') {
  try {
    pathModule = require('path');
    fsPromises = require('fs/promises');
    fs = require('fs');
    childProcess = require('child_process');
    util = require('util');
    import('node-fetch').then((m) => (nodeFetch = m.default));
  } catch (error) {
    console.error('Creed Streamer: native imports failed:', error);
  }
}

const join = (...args: any[]) => (pathModule ? pathModule.join(...args) : '');
const existsSync = (p: string) => (fs ? fs.existsSync(p) : false);
const writeFileSync = (p: string, d: any) => (fs ? fs.writeFileSync(p, d) : null);
const readFile = async (p: string) => (fsPromises ? fsPromises.readFile(p) : Buffer.from(''));
const mkdir = async (p: string, o?: any) => (fsPromises ? fsPromises.mkdir(p, o) : null);
const exec = childProcess ? childProcess.exec : () => {};
const execPromise = util ? util.promisify(exec) : async () => ({ stdout: '', stderr: '' });

export const runtime = 'nodejs';

async function ensureDirectoryExists(path: string) {
  if (!existsSync(path)) {
    await mkdir(path, { recursive: true });
  }
}

function isImageFile(filePath: string): boolean {
  const ext = pathModule ? pathModule.extname(filePath).toLowerCase() : '';
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext);
}

type PartInput = { url: string; type: 'image' | 'video' };

type RequestBody = {
  hook?: { 
    text?: string; 
    style?: number; 
    position?: 'top' | 'middle' | 'bottom'; 
    offset?: number;
    imageUrl?: string; // Nouvelle propriété pour l'image capturée
  };
  logo?: { 
    url: string; 
    position: 'top' | 'middle' | 'bottom';
    size?: number;
    horizontalPosition?: 'left' | 'center' | 'right';
  };
  parts: PartInput[]; // expected length: 11
  song: { url: string };
  mode: 'creed-streamer';
};

export async function POST(req: Request) {
  try {
    const data: RequestBody = await req.json();

    if (data.mode !== 'creed-streamer') {
      return NextResponse.json({ success: false, error: 'Invalid mode' }, { status: 400 });
    }

    const parts = data.parts || [];
    if (parts.length !== 11) {
      return NextResponse.json({ success: false, error: 'Creed Streamer requires exactly 11 parts' }, { status: 400 });
    }

    const tempDir = join(process.cwd(), 'temp');
    const tempOutputDir = join(process.cwd(), 'public', 'temp-videos');
    await ensureDirectoryExists(tempDir);
    await ensureDirectoryExists(tempOutputDir);

    const timestamp = Date.now();
    const outputFileName = `creed_streamer_${timestamp}.mp4`;
    const outputPath = join(tempOutputDir, outputFileName);

    // Helpers
    async function saveUrlToFile(urlStr: string, prefix: string): Promise<string> {
      if (urlStr.startsWith('data:')) {
        const partsSplit = urlStr.split('base64,');
        if (partsSplit.length < 2) throw new Error('Invalid data URL');
        const before = partsSplit[0];
        const base64Data = partsSplit[1];
        const mimeType = before.split(':')[1]?.split(';')[0] || '';
        let ext = '.mp4';
        if (mimeType.includes('png')) ext = '.png';
        else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = '.jpg';
        else if (mimeType.includes('webp')) ext = '.webp';
        else if (mimeType.includes('gif')) ext = '.gif';
        else if (mimeType.includes('image')) ext = '.jpg';
        const buf = Buffer.from(base64Data, 'base64');
        const p = join(tempDir, `${prefix}_${timestamp}${ext}`);
        writeFileSync(p, buf);
        return p;
      }
      if (urlStr.startsWith('http')) {
        const res = await nodeFetch(urlStr);
        const contentType = res.headers.get('content-type') || '';
        let ext = '.mp4';
        if (contentType.includes('image/png')) ext = '.png';
        else if (contentType.includes('image/jpeg')) ext = '.jpg';
        else if (contentType.includes('image/webp')) ext = '.webp';
        else if (contentType.includes('image/gif')) ext = '.gif';
        const buf = await res.buffer();
        const p = join(tempDir, `${prefix}_${timestamp}${ext}`);
        writeFileSync(p, buf);
        return p;
      }
      if (urlStr.startsWith('/')) {
        return join(process.cwd(), 'public', urlStr.slice(1));
      }
      return urlStr;
    }

    // Définir les timecodes et durées pour chaque partie basés sur tes timestamps
    const partTimings = [
      { start: 0.00, end: 13.86, duration: 13.86 },     // Part 1: 00:00,00 → 00:13,86
      { start: 13.87, end: 14.02, duration: 0.15 },     // Part 2: 00:13,87 → 00:14,02
      { start: 14.03, end: 14.19, duration: 0.16 },     // Part 3: 00:14,03 → 00:14,19
      { start: 14.20, end: 14.56, duration: 0.36 },     // Part 4: 00:14,20 → 00:14,56
      { start: 14.57, end: 18.89, duration: 4.32 },     // Part 5: 00:14,57 → 00:18,89
      { start: 18.90, end: 19.05, duration: 0.15 },     // Part 6: 00:18,90 → 00:19,05
      { start: 19.06, end: 19.26, duration: 0.20 },     // Part 7: 00:19,06 → 00:19,26
      { start: 19.27, end: 19.59, duration: 0.32 },     // Part 8: 00:19,27 → 00:19,59
      { start: 19.60, end: 19.88, duration: 0.28 },     // Part 9: 00:19,60 → 00:19,88
      { start: 19.89, end: 20.19, duration: 0.30 },     // Part 10: 00:19,89 → 00:20,19
      { start: 20.20, end: 23.93, duration: 3.73 }      // Part 11: 00:20,20 → 00:23,93
    ];

    updateProgress(10);

    // Sauvegarder et traiter chaque partie avec la durée spécifique
    const processedParts: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const timing = partTimings[i];
      const duration = timing.duration;
      
      const src = await saveUrlToFile(p.url, `creed_part${i + 1}`);
      const isImg = isImageFile(src);
      const processed = join(tempDir, `creed_part${i + 1}_processed_${timestamp}.mp4`);
      
      const targetWidth = 1080;
      const targetHeight = 1920;
      
      let cmd = '';
      if (isImg || p.type === 'image') {
        // Pour les images, créer une vidéo de la durée exacte
        cmd = `ffmpeg -loop 1 -i "${src}" -t ${duration.toFixed(3)} -vf "scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},setsar=1" -metadata:s:v:0 rotate=0 -c:v libx264 -pix_fmt yuv420p -r 30 "${processed}"`;
      } else {
        // Pour les vidéos, ajuster à la durée exacte
        cmd = `ffmpeg -noautorotate -i "${src}" -t ${duration.toFixed(3)} -vf "scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},setsar=1" -metadata:s:v:0 rotate=0 -c:v libx264 -pix_fmt yuv420p -r 30 "${processed}"`;
      }
      
      await execPromise(cmd);
      processedParts.push(processed);
      
      updateProgress(10 + (i + 1) * 5); // Progress from 10 to 65
    }

    updateProgress(65);

    // Concaténer toutes les parties
    const inputs = processedParts.map((p) => `-i "${p}"`).join(' ');
    const n = processedParts.length;

    // Gérer l'audio de la musique
    const songPath = await saveUrlToFile(data.song.url, 'song');
    
    // Durée totale de la vidéo (fin de la dernière partie)
    const totalDuration = 23.93;

    const concatInputs = processedParts.map((_, idx) => `[${idx}:v]`).join('');
    let finalCmd = `ffmpeg ${inputs} -i "${songPath}" -filter_complex "${concatInputs}concat=n=${n}:v=1:a=0[outv];[${n}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,atrim=0:${totalDuration.toFixed(3)},asetpts=PTS-STARTPTS[outa]" -map "[outv]" -map "[outa]" -c:v libx264 -c:a aac -t ${totalDuration.toFixed(3)} "${outputPath}"`;

    updateProgress(80);
    await execPromise(finalCmd);

    // Overlay du hook si présent
    if (data.hook?.imageUrl || data.hook?.text) {
      const hookImagePath = join(tempDir, `hook_${timestamp}.png`);
      const position = data.hook.position || 'top';
      const offset = data.hook.offset || 0;

      if (data.hook.imageUrl) {
        // Utiliser l'image capturée directement du preview
        console.log('Using captured hook image from preview');
        const base64Data = data.hook.imageUrl.replace(/^data:image\/png;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        writeFileSync(hookImagePath, imageBuffer);
      } else if (data.hook.text) {
        // Fallback vers Puppeteer si pas d'image (pour compatibilité)
        console.log('Fallback to Puppeteer text rendering');
        const puppeteer = eval('require')('puppeteer');
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });

        const style = data.hook.style || 2;
        const html = `
          <html><head><style>
          @font-face { 
            font-family: 'TikTok Display Medium'; 
            src: url('http://localhost:3000/fonts/TikTokDisplayMedium.otf'); 
          }
          body { 
            margin: 0; 
            width: 1080px; 
            height: 1920px; 
            display: flex; 
            align-items: ${position === 'top' ? 'flex-start' : position === 'middle' ? 'center' : 'flex-end'}; 
            justify-content: center; 
            padding: ${position === 'top' ? '300px' : position === 'bottom' ? '300px' : '0px'} 0; 
            font-family: 'TikTok Display Medium', sans-serif; 
          }
          .style1 {
            font-size: 75px;
            line-height: 1.2;
            font-family: 'TikTok Display Medium', sans-serif;
            color: white;
            text-shadow: 2px 2px 0 black, -2px -2px 0 black, 2px -2px 0 black, -2px 2px 0 black;
            transform: translateY(${offset * 8}px);
            max-width: 80%;
            text-align: center;
            font-weight: normal;
          }
          .style2 {
            font-size: 75px;
            line-height: 1.2;
            font-family: 'TikTok Display Medium', sans-serif;
            font-weight: 600;
            color: black;
            background: white;
            padding: 24px;
            border-radius: 18px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transform: translateY(${offset * 8}px);
            max-width: 85%;
            text-align: center;
            box-decoration-break: clone;
            display: inline;
          }
          .style3 {
            font-size: 75px;
            line-height: 1.2;
            font-family: 'TikTok Display Medium', sans-serif;
            font-weight: 600;
            color: white;
            background: black;
            padding: 24px;
            border-radius: 18px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            transform: translateY(${offset * 8}px);
            max-width: 85%;
            text-align: center;
            box-decoration-break: clone;
            display: inline;
          }
          </style></head><body><h1 style="width:85%;text-align:center;margin:0;padding:0"><div class="style${style}">${data.hook.text}</div></h1>
          </body></html>`;

        await page.setContent(html);
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: hookImagePath, omitBackground: true, type: 'png' });
        await browser.close();
      }

      // Overlay de l'image sur la vidéo
      const videoWithHookPath = join(process.cwd(), 'public', 'generated', `video_with_hook_${timestamp}.mp4`);
      let yPos = '150';
      if (position === 'middle') yPos = '(H-h)/2';
      else if (position === 'bottom') yPos = 'H-h-360';
      
      const overlayCmd = `ffmpeg -i "${outputPath}" -i "${hookImagePath}" -filter_complex "[0:v][1:v]overlay=(W-w)/2:${yPos}:format=auto,format=yuv420p[outv]" -map "[outv]" -map 0:a -c:v libx264 -c:a copy "${videoWithHookPath}"`;
      await execPromise(overlayCmd);
      await execPromise(`mv "${videoWithHookPath}" "${outputPath}"`);
    }

    // Overlay du logo si présent
    if (data.logo?.url) {
      const logoPath = await saveUrlToFile(data.logo.url, 'logo');
      
      // Valeurs fixes pour le logo Creed Streamer (mêmes que FE!N)
      const sizePercent = 30; // Toujours 30%
      const logoSize = Math.round((1080 * sizePercent) / 100); // 324px pour une vidéo 1080px de large
      
      // Position centré en bas
      const xPos = `(W-w)/2`; // Centré horizontalement
      const yPos = `H-h-250`; // En bas avec 250px de marge
      
      console.log('Logo Creed Streamer - Fixed settings (same as FE!N):', {
        sizePercent: '30%',
        logoSize: logoSize + 'px',
        position: 'center-bottom'
      });
      
      console.log('FFmpeg overlay positions:', { xPos, yPos });
      
      const videoWithLogoPath = join(tempDir, `video_with_logo_${timestamp}.mp4`);
      const logoCmd = `ffmpeg -i "${outputPath}" -i "${logoPath}" -filter_complex "[1:v]scale=${logoSize}:-1[logo];[0:v][logo]overlay=${xPos}:${yPos}:format=auto,format=yuv420p[outv]" -map "[outv]" -map 0:a -c:v libx264 -c:a copy "${videoWithLogoPath}"`;
      
      await execPromise(logoCmd);
      await execPromise(`mv "${videoWithLogoPath}" "${outputPath}"`);
    }

    updateProgress(100);

    const expirationTime = Date.now() + 15 * 60 * 1000;
    try {
      const metaFilePath = join(tempOutputDir, `${outputFileName}.meta.json`);
      await fsPromises.writeFile(metaFilePath, JSON.stringify({ expires: expirationTime, created: Date.now() }));
    } catch {}

    return NextResponse.json({ success: true, videoPath: `/temp-videos/${outputFileName}`, expiresAt: expirationTime });
  } catch (error) {
    console.error('Creed Streamer route error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}