// Client pour communiquer avec le service de traitement vidéo Cloud Run

const VIDEO_PROCESSOR_URL = process.env.NEXT_PUBLIC_VIDEO_PROCESSOR_URL;

export interface VideoProcessingRequest {
  parts: Array<{
    url: string;
    type: 'image' | 'video';
    duration?: number;
  }>;
  music?: {
    url: string;
  };
  hook?: {
    text: string;
    fontSize?: number;
    color?: string;
    x?: string | number;
    y?: string | number;
  };
  duration?: {
    min: number;
    max: number;
  };
}

export async function processVideoInCloud(request: VideoProcessingRequest): Promise<string> {
  if (!VIDEO_PROCESSOR_URL) {
    throw new Error('Cloud video processing not configured. Please set NEXT_PUBLIC_VIDEO_PROCESSOR_URL');
  }

  try {
    const response = await fetch(`${VIDEO_PROCESSOR_URL}/process-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Video processing failed');
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Video processing failed');
    }

    // Retourner l'URL ou le base64 de la vidéo
    return result.video;
  } catch (error) {
    console.error('Error processing video in cloud:', error);
    throw error;
  }
}

export function isCloudProcessingEnabled(): boolean {
  return !!VIDEO_PROCESSOR_URL;
}