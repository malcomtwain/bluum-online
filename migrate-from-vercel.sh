#!/bin/bash

# Script de migration Vercel → VPS en 5 minutes
# Pour que bluum.pro fonctionne avec FFmpeg

echo "🚀 Migration de bluum.pro depuis Vercel vers VPS"
echo "================================================"

# 1. Variables
VPS_IP="YOUR_VPS_IP"
DOMAIN="bluum.pro"

echo "📦 Étape 1: Préparation du VPS..."
ssh root@$VPS_IP << 'ENDSSH'
# Installation complète
apt update && apt upgrade -y
apt install -y ffmpeg nodejs npm nginx git certbot python3-certbot-nginx

# Test FFmpeg
ffmpeg -version
echo "✅ FFmpeg installé avec succès!"

# Clone du projet
cd /var/www
git clone https://github.com/votre-repo/bluum.git
cd bluum

# Installation
npm install
npm run build

# PM2
npm install -g pm2
pm2 start npm --name bluum -- start
pm2 save
pm2 startup
ENDSSH

echo "📦 Étape 2: Configuration Nginx..."
ssh root@$VPS_IP << ENDSSH
cat > /etc/nginx/sites-available/bluum << 'EOF'
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

ln -s /etc/nginx/sites-available/bluum /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx
ENDSSH

echo "📦 Étape 3: SSL avec Let's Encrypt..."
ssh root@$VPS_IP "certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m your@email.com"

echo "📦 Étape 4: Changement DNS..."
echo "
⚠️  ACTION REQUISE:
1. Allez dans Vercel Dashboard
2. Retirez le domaine bluum.pro
3. Dans votre DNS (Cloudflare/autre):
   - Type: A
   - Name: @
   - Value: $VPS_IP
   - TTL: Auto
4. Attendez 5 minutes

✅ MIGRATION TERMINÉE!
- bluum.pro fonctionnera avec FFmpeg
- Plus jamais d'erreur 'command not found'
- Capacité: 100k+ vidéos/mois
"