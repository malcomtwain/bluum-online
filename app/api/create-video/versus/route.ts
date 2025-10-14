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
    console.error('Versus: native imports failed:', error);
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

type VersusParts = {
  arrivesStadium: PartInput[];
  training: PartInput[];
  entry: PartInput[];
  lineup: PartInput[];
  faceCam: PartInput[];
  skills: PartInput[];
  goals: PartInput[];
  celebrations: PartInput[];
};

type RequestBody = {
  hook?: { text?: string; style?: number; position?: 'top' | 'middle' | 'bottom'; offset?: number };
  logo?: { 
    url: string; 
    position: {
      horizontal: 'left' | 'center' | 'right';
      vertical: 'top' | 'middle' | 'bottom';
      scale: number;
      offsetX: number;
      offsetY: number;
    }
  };
  // Accept either a pre-ordered flat list (preferred) or the legacy categorized object
  parts: PartInput[] | VersusParts;
  song: { url: string };
  mode: 'versus';
};

export async function POST(req: Request) {
  try {
    const data: RequestBody = await req.json();

    if (data.mode !== 'versus') {
      return NextResponse.json({ success: false, error: 'Invalid mode' }, { status: 400 });
    }

    const parts = data.parts;

    // Normalize to a flat, ordered list of PartInput (what the client already sends)
    let orderedInputs: PartInput[] = [];
    if (Array.isArray(parts)) {
      orderedInputs = parts as PartInput[];
    } else if (parts && typeof parts === 'object') {
      const p = parts as VersusParts;
      const firstFour = [p.arrivesStadium, p.training, p.entry, p.lineup].filter(arr => Array.isArray(arr) && arr.length > 0);
      for (const group of firstFour) orderedInputs.push(group[0]);
      const middle: PartInput[][] = [];
      if (Array.isArray(p.faceCam) && p.faceCam.length > 0) middle.push(p.faceCam);
      if (Array.isArray(p.skills) && p.skills.length > 0) middle.push(p.skills);
      if (Array.isArray(p.goals) && p.goals.length > 0) middle.push(p.goals);
      for (let i = middle.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [middle[i], middle[j]] = [middle[j], middle[i]];
      }
      for (const group of middle) orderedInputs.push(group[0]);
      if (Array.isArray(p.celebrations) && p.celebrations.length > 0) orderedInputs.push(p.celebrations[0]);
    }

    if (!orderedInputs || orderedInputs.length === 0) {
      return NextResponse.json({ success: false, error: 'No videos provided' }, { status: 400 });
    }

    const tempDir = join(process.cwd(), 'temp');
    const tempOutputDir = join(process.cwd(), 'public', 'temp-videos');
    await ensureDirectoryExists(tempDir);
    await ensureDirectoryExists(tempOutputDir);

    const timestamp = Date.now();
    const outputFileName = `versus_${timestamp}.mp4`;
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

    function pickRandom(min: number, max: number) {
      return Math.round((Math.random() * (max - min) + min) * 10) / 10;
    }

    // Durées par défaut pour chaque type de part
    const defaultDurations = {
      arrivesStadium: { min: 2, max: 4 },
      training: { min: 2, max: 4 },
      entry: { min: 2, max: 4 },
      lineup: { min: 2, max: 4 },
      faceCam: { min: 1, max: 3 },
      skills: { min: 3, max: 5 },
      goals: { min: 3, max: 5 },
      celebrations: { min: 2, max: 4 }
    };

    // Save inputs and build scaled segments in the provided order
    const scaledPaths: string[] = [];
    for (let i = 0; i < orderedInputs.length; i++) {
      const p = orderedInputs[i];
      const src = await saveUrlToFile(p.url, `versus_part${i + 1}`);
      const isImg = isImageFile(src);
      const duration = p.type === 'image' ? 2.5 : undefined;
      const scaled = join(tempDir, `versus_part${i + 1}_scaled_${timestamp}.mp4`);
      const targetWidth = 1080;
      const targetHeight = 1920;
      let cmd = '';
      if (isImg || p.type === 'image') {
        cmd = `ffmpeg -loop 1 -i "${src}" -t ${duration ?? 3} -vf "scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},setsar=1" -metadata:s:v:0 rotate=0 -c:v libx264 -pix_fmt yuv420p -r 30 "${scaled}"`;
      } else {
        cmd = `ffmpeg -noautorotate -i "${src}" -vf "scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},setsar=1" -metadata:s:v:0 rotate=0 -c:v libx264 -pix_fmt yuv420p -r 30 "${scaled}"`;
      }
      await execPromise(cmd);
      scaledPaths.push(scaled);
    }

    const sequence: string[] = scaledPaths;

    updateProgress(30);

    // Calculer la durée totale des clips
    let totalVideoDuration = 0;
    for (const clipPath of sequence) {
      try {
        const { stdout } = await execPromise(`ffprobe -v error -show_entries format=duration -of default=nokey=1:noprint_wrappers=1 "${clipPath}" | cat`);
        const duration = parseFloat((stdout || '').trim());
        if (isFinite(duration)) {
          totalVideoDuration += duration;
        }
      } catch (error) {
        console.warn(`Could not get duration for ${clipPath}:`, error);
        // Si on ne peut pas obtenir la durée, on estime 3 secondes par clip
        totalVideoDuration += 3;
      }
    }

    console.log(`Total video duration: ${totalVideoDuration.toFixed(2)}s`);

    // Concaténer toutes les parties
    const inputs = sequence.map((p) => `-i "${p}"`).join(' ');
    const n = sequence.length;

    // Gérer l'audio de la musique - FORCER la durée à s'adapter à la vidéo
    const songPath = await saveUrlToFile(data.song.url, 'song');

    const concatInputs = sequence.map((_, idx) => `[${idx}:v]`).join('');
    let finalCmd = `ffmpeg ${inputs} -i "${songPath}" -filter_complex "${concatInputs}concat=n=${n}:v=1:a=0[outv];[${n}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,atrim=0:${totalVideoDuration.toFixed(3)},asetpts=PTS-STARTPTS[outa]" -map "[outv]" -map "[outa]" -c:v libx264 -c:a aac -t ${totalVideoDuration.toFixed(3)} "${outputPath}"`;

    updateProgress(60);
    await execPromise(finalCmd);

    // Overlay du hook si présent
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

    // Overlay du logo si présent
    if (data.logo?.url) {
      const logoPath = await saveUrlToFile(data.logo.url, 'logo');
      const pos = data.logo.position;
      
      // Calculer la taille et position du logo
      const logoScale = pos.scale || 1;
      const logoSize = Math.floor(150 * logoScale); // Taille de base du logo
      
      // Position X
      let xPos = '';
      if (pos.horizontal === 'left') {
        xPos = `${50 + pos.offsetX}`;
      } else if (pos.horizontal === 'center') {
        xPos = `(W-${logoSize})/2+${pos.offsetX}`;
      } else {
        xPos = `W-${logoSize}-50+${pos.offsetX}`;
      }
      
      // Position Y
      let yPos = '';
      if (pos.vertical === 'top') {
        yPos = `${200 + pos.offsetY}`; // Ajusté pour correspondre à 20% de la hauteur
      } else if (pos.vertical === 'middle') {
        yPos = `(H-${logoSize})/2+${pos.offsetY}`;
      } else {
        yPos = `H-${logoSize}-200+${pos.offsetY}`; // Ajusté pour correspondre à 80%
      }
      
      const videoWithLogoPath = join(tempDir, `video_with_logo_${timestamp}.mp4`);
      const logoCmd = `ffmpeg -i "${outputPath}" -i "${logoPath}" -filter_complex "[1:v]scale=${logoSize}:${logoSize}[logo];[0:v][logo]overlay=${xPos}:${yPos}:format=auto,format=yuv420p[outv]" -map "[outv]" -map 0:a -c:v libx264 -c:a copy "${videoWithLogoPath}"`;
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
    console.error('Versus route error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
