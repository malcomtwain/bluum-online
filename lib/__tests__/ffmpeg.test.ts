import { generateVideoWithFFmpeg, generateImageWithHook } from '../ffmpeg';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

// Mock FFmpeg
jest.mock('@ffmpeg/ffmpeg', () => ({
  createFFmpeg: jest.fn(() => ({
    isLoaded: jest.fn(() => false),
    load: jest.fn(),
    FS: jest.fn(),
    run: jest.fn(),
  })),
  fetchFile: jest.fn(),
}));

describe('FFmpeg Utils', () => {
  const mockFFmpeg = {
    isLoaded: jest.fn(() => false),
    load: jest.fn(),
    FS: jest.fn(),
    run: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createFFmpeg as jest.Mock).mockReturnValue(mockFFmpeg);
  });

  describe('generateImageWithHook', () => {
    const mockOptions = {
      templateImage: 'https://example.com/template.png',
      hook: 'Test Hook',
      font: '/fonts/test.ttf',
      position: { x: 100, y: 100, scale: 1.5 },
    };

    it('should load FFmpeg if not already loaded', async () => {
      await generateImageWithHook(
        mockOptions.templateImage,
        mockOptions.hook,
        mockOptions.font,
        mockOptions.position
      );

      expect(mockFFmpeg.load).toHaveBeenCalled();
    });

    it('should download and process the template image', async () => {
      const mockImageData = new Uint8Array([1, 2, 3]);
      (fetchFile as jest.Mock).mockResolvedValue(mockImageData);

      await generateImageWithHook(
        mockOptions.templateImage,
        mockOptions.hook,
        mockOptions.font,
        mockOptions.position
      );

      expect(fetchFile).toHaveBeenCalledWith(mockOptions.templateImage);
      expect(mockFFmpeg.FS).toHaveBeenCalledWith('writeFile', 'template.png', mockImageData);
    });

    it('should apply the correct filter complex for text overlay', async () => {
      await generateImageWithHook(
        mockOptions.templateImage,
        mockOptions.hook,
        mockOptions.font,
        mockOptions.position
      );

      const expectedFilter = [
        `[0:v]scale=${mockOptions.position.scale}*iw:${mockOptions.position.scale}*ih[scaled];`,
        `[scaled]drawtext=text='${mockOptions.hook}':fontfile=${mockOptions.font}:fontsize=72:fontcolor=white:`,
        `x=${mockOptions.position.x}:y=${mockOptions.position.y}[v1]`
      ].join('');

      expect(mockFFmpeg.run).toHaveBeenCalledWith(
        '-i', 'template.png',
        '-filter_complex', expectedFilter,
        '-map', '[v1]',
        'output.png'
      );
    });
  });

  describe('generateVideoWithFFmpeg', () => {
    const mockOptions = {
      templateImage: 'https://example.com/template.png',
      mediaFile: 'https://example.com/media.mp4',
      hook: 'Test Hook',
      font: '/fonts/test.ttf',
      music: 'https://example.com/music.mp3',
      templateDuration: 3,
      mediaDuration: 5,
      templatePosition: { x: 100, y: 100, scale: 1.5 },
    };

    it('should load FFmpeg if not already loaded', async () => {
      await generateVideoWithFFmpeg(mockOptions);
      expect(mockFFmpeg.load).toHaveBeenCalled();
    });

    it('should download and process all required files', async () => {
      const mockTemplateData = new Uint8Array([1, 2, 3]);
      const mockMediaData = new Uint8Array([4, 5, 6]);
      const mockMusicData = new Uint8Array([7, 8, 9]);

      (fetchFile as jest.Mock)
        .mockResolvedValueOnce(mockTemplateData)
        .mockResolvedValueOnce(mockMediaData)
        .mockResolvedValueOnce(mockMusicData);

      await generateVideoWithFFmpeg(mockOptions);

      expect(fetchFile).toHaveBeenCalledWith(mockOptions.templateImage);
      expect(fetchFile).toHaveBeenCalledWith(mockOptions.mediaFile);
      expect(fetchFile).toHaveBeenCalledWith(mockOptions.music);

      expect(mockFFmpeg.FS).toHaveBeenCalledWith('writeFile', 'template.png', mockTemplateData);
      expect(mockFFmpeg.FS).toHaveBeenCalledWith('writeFile', 'media.mp4', mockMediaData);
      expect(mockFFmpeg.FS).toHaveBeenCalledWith('writeFile', 'music.mp3', mockMusicData);
    });

    it('should apply the correct filter complex for video generation', async () => {
      await generateVideoWithFFmpeg(mockOptions);

      const expectedFilter = [
        `[0:v]scale=${mockOptions.templatePosition.scale}*iw:${mockOptions.templatePosition.scale}*ih,`,
        `setpts=PTS-STARTPTS+${mockOptions.templatePosition.x}/TB[template];`,
        `[1:v]scale=1920:1080[media];`,
        `[media][template]overlay=${mockOptions.templatePosition.x}:${mockOptions.templatePosition.y}:enable='between(t,0,${mockOptions.templateDuration})'[v1];`,
        `[v1]drawtext=text='${mockOptions.hook}':fontfile=${mockOptions.font}:fontsize=72:fontcolor=white:`,
        `x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,0,${mockOptions.templateDuration})'[v2]`
      ].join('');

      expect(mockFFmpeg.run).toHaveBeenCalledWith(
        '-i', 'template.png',
        '-i', 'media.mp4',
        '-i', 'music.mp3',
        '-filter_complex', expectedFilter,
        '-map', '[v2]',
        '-map', '1:a',
        '-map', '2:a',
        '-filter_complex', 'amix=inputs=2:duration=first:dropout_transition=2',
        '-t', `${mockOptions.templateDuration + mockOptions.mediaDuration}`,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-pix_fmt', 'yuv420p',
        'output.mp4'
      );
    });

    it('should handle video generation without music', async () => {
      const optionsWithoutMusic = { ...mockOptions, music: undefined };
      await generateVideoWithFFmpeg(optionsWithoutMusic);

      expect(mockFFmpeg.run).toHaveBeenCalledWith(
        expect.not.arrayContaining(['-i', 'music.mp3']),
        expect.not.arrayContaining(['-map', '2:a']),
        expect.not.arrayContaining(['amix=inputs=2:duration=first:dropout_transition=2'])
      );
    });
  });
}); 