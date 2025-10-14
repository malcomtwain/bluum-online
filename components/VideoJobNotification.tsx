'use client';

import { useEffect } from 'react';
import { useVideoJob } from '@/hooks/useVideoJob';
import { toast } from 'react-hot-toast';

interface VideoJobNotificationProps {
  jobId: string | null;
  onComplete?: (videoUrl: string) => void;
  onError?: (error: string) => void;
}

export function VideoJobNotification({
  jobId,
  onComplete,
  onError
}: VideoJobNotificationProps) {
  const { job, loading, error } = useVideoJob(jobId);

  useEffect(() => {
    if (!job) return;

    // Show toast based on status
    if (job.status === 'processing' && job.progress > 0) {
      toast.loading(`Processing video... ${job.progress}%`, {
        id: job.id,
        duration: Infinity
      });
    }

    if (job.status === 'completed' && job.video_url) {
      toast.success('Video ready!', { id: job.id });
      onComplete?.(job.video_url);
    }

    if (job.status === 'failed') {
      toast.error(job.error_message || 'Video processing failed', {
        id: job.id
      });
      onError?.(job.error_message || 'Processing failed');
    }
  }, [job, onComplete, onError]);

  if (loading) {
    return <div className="text-sm text-gray-500">Loading job status...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-500">Error: {error}</div>;
  }

  if (!job) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm border border-gray-200">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {job.status === 'pending' && (
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          )}
          {job.status === 'processing' && (
            <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-yellow-600 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          )}
          {job.status === 'completed' && (
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          )}
          {job.status === 'failed' && (
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">
            {job.status === 'pending' && 'Video queued'}
            {job.status === 'processing' && 'Processing video'}
            {job.status === 'completed' && 'Video ready!'}
            {job.status === 'failed' && 'Processing failed'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {job.status === 'pending' && 'Waiting for worker...'}
            {job.status === 'processing' && `${job.progress}% complete`}
            {job.status === 'completed' && 'Your video is ready to download'}
            {job.status === 'failed' && job.error_message}
          </p>

          {job.status === 'processing' && (
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          )}

          {job.status === 'completed' && job.video_url && (
            <a
              href={job.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              Download video
              <svg
                className="w-4 h-4 ml-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
