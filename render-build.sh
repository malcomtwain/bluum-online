#!/usr/bin/env bash

# Script de build pour Render.com
echo "🚀 Starting Render build script..."

# Installer FFmpeg
echo "📦 Installing FFmpeg..."
apt-get update && apt-get install -y ffmpeg

# Vérifier l'installation de FFmpeg
echo "✅ Checking FFmpeg installation..."
ffmpeg -version

# Installer les dépendances Node
echo "📦 Installing Node dependencies..."
npm install

# Build Next.js
echo "🔨 Building Next.js application..."
npm run build

echo "✅ Build complete!"