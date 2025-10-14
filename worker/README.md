# 🎬 Bluum Video Worker

Background video processing service for Bluum using FFmpeg.

## 🚀 Features

- ✅ Asynchronous video generation
- ✅ Automatic job polling from Supabase queue
- ✅ Real-time progress updates
- ✅ FFmpeg with full codec support
- ✅ Puppeteer for hook text rendering
- ✅ Automatic retry on failure
- ✅ Health checks and monitoring

## 📋 Requirements

- Node.js 18+
- FFmpeg (installed automatically in Docker)
- Chromium (installed automatically in Docker)
- Supabase account with service key

## 🔧 Local Development

```bash
# Install dependencies
npm install

# Create .env file
cat > .env << EOF
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
POLL_INTERVAL=5000
PORT=3001
EOF

# Start worker
npm start
```

The worker will:
1. Connect to Supabase
2. Poll for pending jobs every 5 seconds
3. Process videos using FFmpeg
4. Upload results to Supabase Storage
5. Update job status with real-time progress

## 🐳 Docker Deployment

```bash
# Build image
docker build -t bluum-worker .

# Run container
docker run -p 3001:3001 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://... \
  -e SUPABASE_SERVICE_KEY=... \
  bluum-worker
```

## ☁️ Render Deployment

1. Connect your GitHub repository
2. Create a new Web Service
3. Set root directory to `worker`
4. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `POLL_INTERVAL` (optional, default: 5000)
5. Deploy!

Render will automatically use the `render.yaml` configuration.

## 📊 Endpoints

### Health Check
```bash
GET /health

Response:
{
  "status": "healthy",
  "worker_id": "worker-1234567890",
  "uptime": 86400,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### Stats
```bash
GET /stats

Response:
{
  "worker_id": "worker-1234567890",
  "processed": 42,
  "failed": 2,
  "lastJobAt": "2025-01-15T10:30:00Z",
  "uptime": 86400
}
```

## 🔍 Monitoring

### View Logs

**Render:**
Dashboard → Logs → Select service

**Docker:**
```bash
docker logs -f bluum-worker
```

### Example Log Output

```
🚀 Worker worker-1234567890 listening on port 3001
📊 Stats: http://localhost:3001/stats
❤️ Health: http://localhost:3001/health
🔄 Starting job polling every 5000ms

🎬 Processing job abc-123-def-456
📁 Temp directory: /tmp/bluum-xyz
📥 Downloading files...
🎞️ Processing videos...
🔗 Concatenating videos...
🎨 Adding hook overlay...
☁️ Uploading to Supabase...
✅ Job abc-123-def-456 completed: https://...
```

## 🎯 Job Processing Flow

```
1. Poll Supabase for pending job
   ↓
2. Download media files (part1, part2, song)
   ↓
3. Process with FFmpeg (scale, crop, concat)
   ↓
4. Add hook overlay (if present)
   ↓
5. Upload to Supabase Storage
   ↓
6. Update job status to 'completed'
   ↓
7. Clean up temp files
```

## ⚙️ Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | - | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | ✅ | - | Service role key (not anon!) |
| `PORT` | ❌ | 3001 | HTTP server port |
| `POLL_INTERVAL` | ❌ | 5000 | Job polling interval (ms) |
| `WORKER_ID` | ❌ | auto | Unique worker identifier |

## 🚨 Troubleshooting

### Worker not picking up jobs

**Check:**
- Supabase credentials are correct
- Service key has proper permissions
- Jobs table has pending jobs
- Worker logs for errors

### FFmpeg errors

**Common issues:**
- File format not supported → Check input files
- Codec missing → Docker includes all codecs
- Memory limit → Increase worker RAM

### Puppeteer crashes

**Solutions:**
- Ensure Chromium is installed (automatic in Docker)
- Check `--no-sandbox` flag is set
- Verify font files are accessible

## 🔄 Scaling

### Add more workers

Deploy multiple instances on Render:
- Each worker polls independently
- Supabase handles job locking (FOR UPDATE SKIP LOCKED)
- No race conditions

### Auto-scaling

Render can auto-scale based on CPU/Memory usage:
1. Dashboard → Settings → Scaling
2. Enable Auto-Scaling
3. Set min/max instances

## 📝 License

MIT
