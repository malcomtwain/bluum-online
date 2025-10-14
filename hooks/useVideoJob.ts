import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface VideoJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  video_url: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

interface UseVideoJobResult {
  job: VideoJob | null;
  loading: boolean;
  error: string | null;
}

export function useVideoJob(jobId: string | null): UseVideoJobResult {
  const [job, setJob] = useState<VideoJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return;
    }

    // Fetch initial job state
    const fetchJob = async () => {
      try {
        const { data, error } = await supabase
          .from('video_jobs')
          .select('*')
          .eq('id', jobId)
          .single();

        if (error) throw error;

        setJob(data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching job:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch job');
        setLoading(false);
      }
    };

    fetchJob();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`video_job_${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_jobs',
          filter: `id=eq.${jobId}`
        },
        (payload) => {
          console.log('Job updated:', payload);
          setJob(payload.new as VideoJob);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  return { job, loading, error };
}

// Hook to fetch all user's jobs
export function useVideoJobs() {
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const { data, error } = await supabase
          .from('video_jobs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        setJobs(data || []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching jobs:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
        setLoading(false);
      }
    };

    fetchJobs();

    // Subscribe to realtime updates for all jobs
    const channel = supabase
      .channel('video_jobs_all')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_jobs'
        },
        (payload) => {
          console.log('Jobs updated:', payload);

          if (payload.eventType === 'INSERT') {
            setJobs((prev) => [payload.new as VideoJob, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setJobs((prev) =>
              prev.map((job) =>
                job.id === payload.new.id ? (payload.new as VideoJob) : job
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setJobs((prev) => prev.filter((job) => job.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { jobs, loading, error };
}
