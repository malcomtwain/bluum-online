import { renderHook, act } from '@testing-library/react';
import { useSupabase } from '../useSupabase';
import { supabase, uploadFile, getFileUrl } from '@/lib/supabase';
import { generateVideoWithFFmpeg, generateImageWithHook } from '@/lib/ffmpeg';

// Mock dependencies
jest.mock('@clerk/nextjs', () => ({
  useUser: () => ({
    user: {
      id: 'test-user-id',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
    },
  }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: jest.fn(),
      insert: jest.fn(),
      select: jest.fn(),
      eq: jest.fn(),
    })),
  },
  uploadFile: jest.fn(),
  getFileUrl: jest.fn(),
}));

jest.mock('@/lib/ffmpeg', () => ({
  generateVideoWithFFmpeg: jest.fn(),
  generateImageWithHook: jest.fn(),
}));

describe('useSupabase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createProject', () => {
    it('should create a project successfully', async () => {
      const mockUserData = { id: 'db-user-id' };
      const mockProject = { id: 'project-id', name: 'Test Project' };

      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'users') {
          return {
            upsert: jest.fn().mockResolvedValue({ data: mockUserData, error: null }),
          };
        }
        if (table === 'projects') {
          return {
            insert: jest.fn().mockResolvedValue({ data: mockProject, error: null }),
          };
        }
        return {};
      });

      const { result } = renderHook(() => useSupabase());

      await act(async () => {
        const project = await result.current.createProject('Test Project');
        expect(project).toEqual(mockProject);
      });
    });

    it('should handle errors during project creation', async () => {
      (supabase.from as jest.Mock).mockImplementation(() => ({
        upsert: jest.fn().mockResolvedValue({ data: null, error: new Error('Database error') }),
      }));

      const { result } = renderHook(() => useSupabase());

      await act(async () => {
        await expect(result.current.createProject('Test Project')).rejects.toThrow('Database error');
      });
    });
  });

  describe('generateImages', () => {
    it('should generate images successfully', async () => {
      const mockTemplate = {
        id: 'template-id',
        storage_path: 'template/path.png',
        position_x: 100,
        position_y: 100,
        scale: 1.5,
      };

      const mockHook = {
        id: 'hook-id',
        text: 'Test Hook',
      };

      const mockGeneratedImage = {
        id: 'generated-id',
        storage_path: 'generated/path.png',
      };

      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'templates') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: mockTemplate, error: null }),
            }),
          };
        }
        if (table === 'hooks') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: mockHook, error: null }),
            }),
          };
        }
        if (table === 'generated_images') {
          return {
            insert: jest.fn().mockResolvedValue({ data: mockGeneratedImage, error: null }),
          };
        }
        return {};
      });

      (getFileUrl as jest.Mock).mockResolvedValue('https://example.com/template.png');
      (generateImageWithHook as jest.Mock).mockResolvedValue(new Blob());
      (uploadFile as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useSupabase());

      await act(async () => {
        const image = await result.current.generateImages(
          'project-id',
          'template-id',
          'hook-id',
          'withBackground'
        );
        expect(image).toEqual(mockGeneratedImage);
      });
    });
  });

  describe('generateVideo', () => {
    it('should generate a video successfully', async () => {
      const mockGeneratedImage = {
        id: 'generated-id',
        storage_path: 'generated/image.png',
        template: {
          duration: 3,
          position_x: 100,
          position_y: 100,
          scale: 1.5,
        },
        hook: {
          text: 'Test Hook',
        },
        font_type: 'withBackground',
      };

      const mockMedia = {
        id: 'media-id',
        storage_path: 'media/video.mp4',
        duration: 5,
      };

      const mockMusic = {
        id: 'music-id',
        storage_path: 'music/song.mp3',
      };

      const mockGeneratedVideo = {
        id: 'video-id',
        storage_path: 'generated/video.mp4',
      };

      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'generated_images') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: mockGeneratedImage, error: null }),
            }),
          };
        }
        if (table === 'media') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: mockMedia, error: null }),
            }),
          };
        }
        if (table === 'music') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: mockMusic, error: null }),
            }),
          };
        }
        if (table === 'generated_videos') {
          return {
            insert: jest.fn().mockResolvedValue({ data: mockGeneratedVideo, error: null }),
          };
        }
        return {};
      });

      (getFileUrl as jest.Mock)
        .mockResolvedValueOnce('https://example.com/image.png')
        .mockResolvedValueOnce('https://example.com/video.mp4')
        .mockResolvedValueOnce('https://example.com/song.mp3');

      (generateVideoWithFFmpeg as jest.Mock).mockResolvedValue(new Blob());
      (uploadFile as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useSupabase());

      await act(async () => {
        const video = await result.current.generateVideo(
          'project-id',
          'generated-id',
          'media-id',
          'music-id'
        );
        expect(video).toEqual(mockGeneratedVideo);
      });
    });
  });
}); 