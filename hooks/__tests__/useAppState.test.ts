import { renderHook, act } from '@testing-library/react';
import { useAppState } from '../useAppState';

describe('useAppState', () => {
  beforeEach(() => {
    // Reset the store before each test
    const { result } = renderHook(() => useAppState());
    act(() => {
      result.current.reset();
    });
  });

  describe('Project Management', () => {
    it('should set current project', () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.setCurrentProject('project-1', 'Test Project');
      });

      expect(result.current.currentProjectId).toBe('project-1');
      expect(result.current.projectName).toBe('Test Project');
    });
  });

  describe('Template Management', () => {
    it('should set template image', () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.setTemplateImage('https://example.com/template.png');
      });

      expect(result.current.templateImage).toBe('https://example.com/template.png');
    });

    it('should set template position', () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.setTemplatePosition({ x: 100, y: 100, scale: 1.5 });
      });

      expect(result.current.templatePosition).toEqual({
        x: 100,
        y: 100,
        scale: 1.5,
      });
    });

    it('should set template duration', () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.setTemplateDuration(5);
      });

      expect(result.current.templateDuration).toBe(5);
    });
  });

  describe('Media Management', () => {
    it('should add and remove media files', () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.addMediaFile({
          type: 'image',
          url: 'https://example.com/image.jpg',
          duration: 3,
        });
      });

      expect(result.current.mediaFiles).toHaveLength(1);
      expect(result.current.mediaFiles[0].type).toBe('image');
      expect(result.current.mediaFiles[0].url).toBe('https://example.com/image.jpg');
      expect(result.current.mediaFiles[0].duration).toBe(3);

      act(() => {
        result.current.removeMediaFile(result.current.mediaFiles[0].id);
      });

      expect(result.current.mediaFiles).toHaveLength(0);
    });
  });

  describe('Music Management', () => {
    it('should add and remove songs', () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.addSong({
          url: 'https://example.com/song.mp3',
        });
      });

      expect(result.current.selectedSongs).toHaveLength(1);
      expect(result.current.selectedSongs[0].url).toBe('https://example.com/song.mp3');

      act(() => {
        result.current.removeSong(result.current.selectedSongs[0].id);
      });

      expect(result.current.selectedSongs).toHaveLength(0);
    });
  });

  describe('Hook Management', () => {
    it('should add and remove hooks', () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.addHook({
          text: 'Test Hook',
          position: { x: 50, y: 50 },
        });
      });

      expect(result.current.hooks).toHaveLength(1);
      expect(result.current.hooks[0].text).toBe('Test Hook');
      expect(result.current.hooks[0].position).toEqual({ x: 50, y: 50 });

      act(() => {
        result.current.removeHook(result.current.hooks[0].id);
      });

      expect(result.current.hooks).toHaveLength(0);
    });
  });

  describe('Font Selection', () => {
    it('should toggle font selection', () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.toggleFont('withBackground');
      });

      expect(result.current.selectedFonts.withBackground).toBe(false);

      act(() => {
        result.current.toggleFont('normal');
      });

      expect(result.current.selectedFonts.normal).toBe(true);
    });
  });

  describe('Generated Content Management', () => {
    it('should add generated images', () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.addGeneratedImage({
          url: 'https://example.com/generated.png',
          hook: 'Test Hook',
          font: 'withBackground',
        });
      });

      expect(result.current.generatedImages).toHaveLength(1);
      expect(result.current.generatedImages[0].url).toBe('https://example.com/generated.png');
      expect(result.current.generatedImages[0].hook).toBe('Test Hook');
      expect(result.current.generatedImages[0].font).toBe('withBackground');
    });

    it('should add generated videos', () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.addGeneratedVideo({
          url: 'https://example.com/generated.mp4',
          template: 'template-1',
          media: 'media-1',
          hook: 'Test Hook',
          font: 'normal',
        });
      });

      expect(result.current.generatedVideos).toHaveLength(1);
      expect(result.current.generatedVideos[0].url).toBe('https://example.com/generated.mp4');
      expect(result.current.generatedVideos[0].template).toBe('template-1');
      expect(result.current.generatedVideos[0].media).toBe('media-1');
      expect(result.current.generatedVideos[0].hook).toBe('Test Hook');
      expect(result.current.generatedVideos[0].font).toBe('normal');
    });
  });
}); 