#!/bin/bash

echo "🚀 Starting local development tunnel for TikTok OAuth..."

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null
then
    echo "❌ ngrok is not installed. Installing..."
    
    # Check OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install ngrok
        else
            echo "Please install ngrok from: https://ngrok.com/download"
            exit 1
        fi
    else
        echo "Please install ngrok from: https://ngrok.com/download"
        exit 1
    fi
fi

# Start ngrok
echo "✅ Starting ngrok tunnel on port 3000..."
echo ""
echo "📝 Once ngrok starts:"
echo "1. Copy the HTTPS URL (like https://xxx.ngrok.io)"
echo "2. Add it to TikTok Developer Console:"
echo "   - Redirect URI: https://xxx.ngrok.io/api/tiktok/callback"
echo ""
echo "Press Ctrl+C to stop the tunnel"
echo ""

ngrok http 3000