import { NextResponse } from 'next/server';
import { updateProgress } from '@/lib/progress';

// Lazy require Node APIs only on the server
let pathModule: any = null;
let fsPromises: any = null;
let fs: any = null;
let childProcess: any = null;
let util: any = null;
let nodeFetch: any = null;
let url: any = null;

if (typeof window === 'undefined') {
  try {
    pathModule = require('path');
    fsPromises = require('fs/promises');
    fs = require('fs');
    childProcess = require('child_process');
    util = require('util');
    url = require('url');
    import('node-fetch').then((m) => (nodeFetch = m.default));
  } catch (error) {
    console.error('AutoCut: native imports failed:', error);
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
  hook?: { text?: string; style?: number; position?: 'top' | 'middle' | 'bottom'; offset?: number };
  parts: PartInput[]; // expected length: 5
  durations?: {
    final?: { min: number; max: number };
    perPart?: Array<{ min: number; max: number }>; // optional
  };
  song: { url: string };
};

export async function POST(req: Request) {
  try {
    const data: RequestBody = await req.json();

    const parts = (data.parts || []).slice(0, 5);
    if (parts.length !== 5) {
      return NextResponse.json({ success: false, error: 'AutoCut requires 5 parts' }, { status: 400 });
    }

    const tempDir = join(process.cwd(), 'temp');
    const tempOutputDir = join(process.cwd(), 'public', 'temp-videos');
    await ensureDirectoryExists(tempDir);
    await ensureDirectoryExists(tempOutputDir);

    const timestamp = Date.now();
    const outputFileName = `video_${timestamp}.mp4`;
    const outputPath = join(tempOutputDir, outputFileName);

    // Helpers
    async function saveUrlToFile(urlStr: string, prefix: string): Promise<string> {
      // data:image or data:video
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
      // http(s)
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
      // local path under public
      if (urlStr.startsWith('/')) {
        return join(process.cwd(), 'public', urlStr.slice(1));
      }
      return urlStr;
    }

    function pickRandom(min: number, max: number) {
      return Math.round((Math.random() * (max - min) + min) * 10) / 10;
    }

    // Recommended per-part ranges as fallback
    const defaultRanges = [
      { min: 1, max: 3 }, // Face cam
      { min: 2, max: 4 }, // Pre match
      { min: 3, max: 5 }, // Skills
      { min: 3, max: 5 }, // Goals
      { min: 2, max: 4 }, // Celebrations
    ];
    const perPartRanges = data.durations?.perPart && data.durations.perPart.length === 5 ? data.durations.perPart : defaultRanges;

    // Save inputs and build scaled segments
    const scaledPaths: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const src = await saveUrlToFile(p.url, `auto_part${i + 1}`);
      const isImg = isImageFile(src);
      const partDuration = isImg || p.type === 'image' ? pickRandom(perPartRanges[i].min, perPartRanges[i].max) : undefined;
      const scaled = join(tempDir, `ac_part${i + 1}_scaled_${timestamp}.mp4`);
      const targetWidth = 1080;
      const targetHeight = 1920;
      let cmd = '';
      // Générer des valeurs aléatoires subtiles pour l'originalité
      const brightness = (Math.random() * 0.3 - 0.15).toFixed(3); // -0.15 à +0.15
      const contrast = (1 + Math.random() * 0.4 - 0.2).toFixed(3); // 0.8 à 1.2
      const saturation = (1 + Math.random() * 0.3 - 0.15).toFixed(3); // 0.85 à 1.15
      const gamma = (1 + Math.random() * 0.2 - 0.1).toFixed(3); // 0.9 à 1.1
      const speedFactor = (1 + Math.random() * 0.1 - 0.05).toFixed(3); // 0.95 à 1.05

      // Filtres optionnels aléatoires (30% de chance)
      const randomEffects = [];
      if (Math.random() < 0.3) {
        const sharpening = (Math.random() * 0.5 + 0.5).toFixed(3); // 0.5 à 1.0
        randomEffects.push(`unsharp=5:5:${sharpening}:5:5:0.0`);
      }

      const effectsStr = randomEffects.length > 0 ? `,${randomEffects.join(',')}` : '';
      
      if (isImg || p.type === 'image') {
        console.log(`[AutoCut] Part ${i + 1} (image) - applying filters: brightness:${brightness}, contrast:${contrast}, saturation:${saturation}, gamma:${gamma}, effects:${randomEffects.join(',')}`);
        cmd = `ffmpeg -loop 1 -i "${src}" -t ${partDuration ?? 3} -vf "scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}:gamma=${gamma}${effectsStr},setsar=1" -c:v libx264 -pix_fmt yuv420p -r 30 "${scaled}"`;
      } else {
        console.log(`[AutoCut] Part ${i + 1} (video) - applying filters: brightness:${brightness}, contrast:${contrast}, saturation:${saturation}, gamma:${gamma}, speed:${speedFactor}, effects:${randomEffects.join(',')}`);
        cmd = `ffmpeg -i "${src}" -vf "scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}:gamma=${gamma},setpts=${speedFactor}*PTS${effectsStr},setsar=1" -c:v libx264 -pix_fmt yuv420p -r 30 "${scaled}"`;
      }
      await execPromise(cmd);
      scaledPaths.push(scaled);
    }

    // Concat all 5 parts
    const inputs = scaledPaths.map((p) => `-i "${p}"`).join(' ');
    const n = scaledPaths.length;

    // Handle song audio
    const songPath = await saveUrlToFile(data.song.url, 'song');

    // Générer des filtres globaux finaux pour l'originalité
    const finalBrightness = (Math.random() * 0.2 - 0.1).toFixed(3); // -0.1 à +0.1 (plus subtil)
    const finalContrast = (1 + Math.random() * 0.2 - 0.1).toFixed(3); // 0.9 à 1.1
    const finalSaturation = (1 + Math.random() * 0.2 - 0.1).toFixed(3); // 0.9 à 1.1
    const finalSpeedAdjust = (1 + Math.random() * 0.08 - 0.04).toFixed(3); // 0.96 à 1.04
    
    console.log(`[AutoCut] Final video filters - brightness:${finalBrightness}, contrast:${finalContrast}, saturation:${finalSaturation}, speed:${finalSpeedAdjust}`);

    const concatInputs = scaledPaths.map((_, idx) => `[${idx}:v]`).join('');
    let finalCmd = `ffmpeg ${inputs} -i "${songPath}" -filter_complex "${concatInputs}concat=n=${n}:v=1:a=0[concat];[concat]eq=brightness=${finalBrightness}:contrast=${finalContrast}:saturation=${finalSaturation},setpts=${finalSpeedAdjust}*PTS[outv];[${n}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[outa]" -map "[outv]" -map "[outa]" -c:v libx264 -c:a aac -shortest "${outputPath}"`;

    updateProgress(0);
    await execPromise(finalCmd);

    // Optional hook overlay (reuse simple overlay like in base route)
    if (data.hook?.text) {
      const puppeteer = eval('require')('puppeteer');
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });

      const hookImagePath = join(tempDir, `hook_${timestamp}.png`);
      const position = data.hook.position || 'top';
      const offset = data.hook.offset || 0;
      const style = data.hook.style || 2;

      const normalStyle = `font-size: 60px; line-height: 1.2; display: inline-block; width: 100%; max-width: 80%; margin: 0 auto; text-align: center; color: #fff; font-weight: normal; text-shadow: -2.8px -2.8px 0 #000, 2.8px -2.8px 0 #000, -2.8px 2.8px 0 #000, 2.8px 2.8px 0 #000; padding: 0.8rem 1.5rem 1rem 1.5rem; background: transparent; filter: none;`;
      const backgroundWhiteStyle = `font-size: 65px; line-height: 1.2; display: inline; box-decoration-break: clone; background: #fff; padding: 0.1rem 1.5rem 0.75rem 1.5rem; filter: url('#goo'); max-width: 80%; text-align: center; color: #000; font-weight: normal;`;
      const backgroundBlackStyle = `font-size: 65px; line-height: 1.2; display: inline; box-decoration-break: clone; background: #000; padding: 0.1rem 1.5rem 0.75rem 1.5rem; filter: url('#goo'); max-width: 80%; text-align: center; color: #fff; font-weight: normal;`;

      const html = `
        <html><head><style>
        @font-face { font-family: 'TikTok Display Medium'; src: url('${join(process.cwd(), 'public/fonts/TikTokDisplayMedium.otf')}'); }
        body { margin:0; width:1080px; height:1920px; display:flex; align-items:${position === 'top' ? 'flex-start' : position === 'middle' ? 'center' : 'flex-end'}; justify-content:center; padding:${position === 'top' ? '96px' : position === 'bottom' ? '480px' : '0px'} 0; font-family:'TikTok Display Medium', sans-serif; }
        .goo { ${style === 1 ? normalStyle : style === 2 ? backgroundWhiteStyle : backgroundBlackStyle} transform: translateY(${offset * 8}px); }
        </style></head><body><h1 style="width:85%;text-align:center;margin:0;padding:0"><div class="goo">${data.hook.text}</div></h1>
        <svg style="visibility:hidden;position:absolute" width="0" height="0" xmlns="http://www.w3.org/2000/svg" version="1.1"><defs><filter id="goo"><feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur"/><feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo"/><feComposite in="SourceGraphic" in2="goo" operator="atop"/></filter></defs></svg>
        </body></html>`;

      await page.setContent(html);
      await page.screenshot({ path: hookImagePath, omitBackground: true, type: 'png' });
      await browser.close();

      const videoWithHookPath = join(process.cwd(), 'public', 'generated', `video_with_hook_${timestamp}.mp4`);
      let yPos = '96'; // 5% de 1920px pour position top
      if (position === 'middle') yPos = '(H-h)/2';
      else if (position === 'bottom') yPos = 'H-h-360'; // 75% de 1920px pour bottom
      
      const scaleFactor = style === 1 ? '1.15' : '1';
      const overlayCmd = `ffmpeg -i "${outputPath}" -i "${hookImagePath}" -filter_complex "[1:v]scale=iw*${scaleFactor}:-1[overlay];[0:v][overlay]overlay=(W-w)/2:${yPos}:format=auto,format=yuv420p[outv]" -map "[outv]" -map 0:a -c:v libx264 -c:a copy "${videoWithHookPath}"`;
      await execPromise(overlayCmd);
      await execPromise(`mv "${videoWithHookPath}" "${outputPath}"`);
    }

    updateProgress(100);

    const expirationTime = Date.now() + 15 * 60 * 1000;
    try {
      const metaFilePath = join(tempOutputDir, `${outputFileName}.meta.json`);
      await fsPromises.writeFile(metaFilePath, JSON.stringify({ expires: expirationTime, created: Date.now() }));
    } catch {}

    return NextResponse.json({ success: true, videoPath: `/temp-videos/${outputFileName}`, expiresAt: expirationTime });
  } catch (error) {
    console.error('AutoCut route error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}


