-- Create video jobs queue table
CREATE TABLE IF NOT EXISTS video_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  -- Job configuration
  job_data JSONB NOT NULL,

  -- Results
  video_url TEXT,
  error_message TEXT,

  -- Progress tracking
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Worker info
  worker_id TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3
);

-- Index for efficient queries
CREATE INDEX idx_video_jobs_user_id ON video_jobs(user_id);
CREATE INDEX idx_video_jobs_status ON video_jobs(status);
CREATE INDEX idx_video_jobs_created_at ON video_jobs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own jobs
CREATE POLICY "Users can view own jobs"
  ON video_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create their own jobs
CREATE POLICY "Users can create own jobs"
  ON video_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Workers can update jobs (using service key)
CREATE POLICY "Service can update jobs"
  ON video_jobs
  FOR UPDATE
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE video_jobs;

-- Function to clean up old completed/failed jobs (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_video_jobs()
RETURNS void AS $$
BEGIN
  DELETE FROM video_jobs
  WHERE status IN ('completed', 'failed')
    AND completed_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get next pending job (for worker)
CREATE OR REPLACE FUNCTION get_next_video_job()
RETURNS TABLE (
  id UUID,
  job_data JSONB,
  attempts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  UPDATE video_jobs
  SET
    status = 'processing',
    started_at = NOW(),
    attempts = attempts + 1
  WHERE id = (
    SELECT video_jobs.id
    FROM video_jobs
    WHERE status = 'pending'
      AND attempts < max_attempts
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING video_jobs.id, video_jobs.job_data, video_jobs.attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment
COMMENT ON TABLE video_jobs IS 'Queue for video generation jobs';
