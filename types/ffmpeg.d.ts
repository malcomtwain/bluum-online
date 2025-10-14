// Déclarations de types pour @ffmpeg/ffmpeg et @ffmpeg/util
declare module '@ffmpeg/ffmpeg' {
  export interface FFmpegOptions {
    log?: boolean;
    corePath?: string;
    logger?: (message: any) => void;
  }

  export interface FFmpeg {
    load(): Promise<void>;
    FS(command: string, ...args: any[]): any;
    setProgress(progressCallback: (progress: { ratio: number }) => void): void;
    run(...args: string[]): Promise<void>;
    exit(): void;
    isLoaded(): boolean;
  }

  export function createFFmpeg(options?: FFmpegOptions): FFmpeg;
}

declare module '@ffmpeg/util' {
  export function fetchFile(file: File | string | URL): Promise<Uint8Array>;
} 