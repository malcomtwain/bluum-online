#!/bin/bash
# Setup script for Bluum Worker on Google Cloud Platform

echo "🚀 Bluum Worker - GCP Setup"
echo "=============================="

# Update system
echo "📦 Updating system..."
sudo apt-get update
sudo apt-get upgrade -y

# Install Docker
echo "🐳 Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
echo "📦 Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install FFmpeg
echo "🎬 Installing FFmpeg..."
sudo apt-get install -y ffmpeg

# Install Git
echo "📦 Installing Git..."
sudo apt-get install -y git

# Install Node.js
echo "📦 Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Create app directory
echo "📁 Creating app directory..."
mkdir -p /home/$USER/bluum-worker
cd /home/$USER/bluum-worker

# Create worker files
echo "📝 Creating worker configuration..."

# Create package.json
cat > package.json << 'EOL'
{
  "name": "bluum-video-worker",
  "version": "1.0.0",
  "description": "Background video processing worker for Bluum",
  "main": "server.js",
  "engines": {
    "node": "18.x"
  },
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "@ffmpeg-installer/ffmpeg": "^1.1.0",
    "@ffprobe-installer/ffprobe": "^2.1.2",
    "@supabase/supabase-js": "^2.49.1",
    "express": "^4.18.2",
    "fluent-ffmpeg": "^2.1.3",
    "node-fetch": "^3.3.2"
  }
}
EOL

# Create .env file (you'll need to fill this)
cat > .env << 'EOL'
# Fill these values from your Supabase dashboard
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
WORKER_ID=gcp-worker-1
POLL_INTERVAL=5000
PORT=3001
EOL

# Create systemd service for auto-restart
echo "⚙️ Creating systemd service..."
sudo tee /etc/systemd/system/bluum-worker.service > /dev/null << EOL
[Unit]
Description=Bluum Video Worker
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/home/$USER/bluum-worker
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/bluum-worker.log
StandardError=append:/var/log/bluum-worker-error.log
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOL

echo ""
echo "✅ GCP Setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Copy your worker code from GitHub:"
echo "   git clone https://github.com/malcomtwain/bluum.git"
echo "   cp bluum/worker/server.js /home/$USER/bluum-worker/"
echo ""
echo "2. Edit .env file with your Supabase credentials:"
echo "   nano /home/$USER/bluum-worker/.env"
echo ""
echo "3. Install dependencies:"
echo "   cd /home/$USER/bluum-worker"
echo "   npm install"
echo ""
echo "4. Start the worker:"
echo "   sudo systemctl enable bluum-worker"
echo "   sudo systemctl start bluum-worker"
echo ""
echo "5. Check status:"
echo "   sudo systemctl status bluum-worker"
echo "   sudo journalctl -u bluum-worker -f"
echo ""
