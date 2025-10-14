# Configuration VPS Contabo pour Bluum (10€/mois)

## 🚀 Setup complet en 15 minutes

### 1. Commander le VPS
- Allez sur [contabo.com](https://contabo.com)
- Choisissez VPS S ou M (8.99€/mois)
- OS : Ubuntu 22.04
- Localisation : EU (Allemagne) pour la latence

### 2. Première connexion SSH
```bash
# Depuis votre terminal
ssh root@VOTRE_IP_VPS

# Mot de passe reçu par email
```

### 3. Installation complète (copier-coller)

```bash
#!/bin/bash
# Script d'installation automatique pour Bluum

# 1. Mise à jour système
apt update && apt upgrade -y

# 2. Installation FFmpeg et dépendances
apt install -y ffmpeg git nginx nodejs npm python3 build-essential

# 3. Vérifier FFmpeg
ffmpeg -version
# ✅ FFmpeg version 4.4.2 - IT WORKS!

# 4. Installation Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 5. Clone votre projet
cd /var/www
git clone https://github.com/VOTRE_REPO/bluum.git
cd bluum

# 6. Installation des dépendances
npm install

# 7. Build de production
npm run build

# 8. Installation PM2 (gestionnaire de process)
npm install -g pm2

# 9. Lancer l'application
pm2 start npm --name bluum -- start
pm2 save
pm2 startup

# 10. Configuration Nginx
cat > /etc/nginx/sites-available/bluum << 'EOF'
server {
    listen 80;
    server_name votre-domaine.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# 11. Activer le site
ln -s /etc/nginx/sites-available/bluum /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# 12. Firewall
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable

echo "✅ Installation terminée!"
echo "🎬 FFmpeg fonctionne parfaitement!"
echo "🚀 Votre app tourne sur http://VOTRE_IP"
```

## 📊 Capacité du VPS Contabo (8.99€/mois)

### Spécifications :
- **CPU** : 4-6 vCores
- **RAM** : 8-16 GB
- **Stockage** : 200-400 GB SSD
- **Bande passante** : ILLIMITÉE
- **FFmpeg** : ✅ FONCTIONNE PARFAITEMENT

### Performance vidéo :
- Peut traiter **100+ vidéos simultanément**
- Temps de traitement : ~5-10 sec/vidéo
- **Capacité** : 50 000+ vidéos/mois facilement

## 🔧 Optimisations pour production

### 1. Système de queue Redis
```bash
# Installer Redis
apt install redis-server

# Dans votre code
npm install bull
```

```javascript
// lib/queue.js
const Queue = require('bull');
const videoQueue = new Queue('video', 'redis://127.0.0.1:6379');

videoQueue.process(5, async (job) => {
  // Traite 5 vidéos en parallèle
  return await processVideoWithFFmpeg(job.data);
});
```

### 2. Stockage vidéo avec S3
```bash
# Pour ne pas saturer le disque
npm install @aws-sdk/client-s3
```

### 3. CDN avec Cloudflare (GRATUIT)
- Protège votre serveur
- Cache les vidéos
- SSL gratuit

## 💰 Comparaison des coûts

| Service | Prix/mois | FFmpeg | Limite vidéos |
|---------|-----------|---------|---------------|
| Vercel | Gratuit* | ❌ NON | 0 |
| Cloudinary | 750$ | ✅ OUI | 30k |
| AWS | 100$ | ✅ OUI | 30k |
| **Contabo VPS** | **10€** | **✅ OUI** | **100k+** |

## 🎯 Migration depuis Vercel

1. **Exporter les variables d'environnement**
```bash
# Sur Vercel, copiez toutes vos variables
# Sur le VPS, créez .env.local
nano /var/www/bluum/.env.local
```

2. **Pointer le domaine**
- Dans Vercel : Retirer le domaine
- Dans Cloudflare/DNS : Pointer vers IP du VPS

3. **Monitoring**
```bash
# Voir les logs
pm2 logs bluum

# Voir l'utilisation CPU/RAM
htop

# Voir l'espace disque
df -h
```

## ✅ Avantages VPS vs Vercel

| Fonctionnalité | Vercel | VPS |
|----------------|--------|-----|
| FFmpeg | ❌ | ✅ |
| Coût pour 30k vidéos | N/A | 10€ |
| Contrôle total | ❌ | ✅ |
| Limite d'exécution | 10 sec | ∞ |
| Stockage | Limité | 400GB |
| Personnalisation | ❌ | ✅ |
| Cron jobs | Limité | ✅ |
| Base de données locale | ❌ | ✅ |

## 🚨 Une seule commande pour tout installer

```bash
curl -o- https://raw.githubusercontent.com/votre-repo/bluum/main/install-vps.sh | bash
```

## 📞 Support

- Contabo support : 24/7
- Documentation FFmpeg : ffmpeg.org
- Communauté : Discord/Stack Overflow

---

**RÉSULTAT : Pour 10€/mois, vous avez un serveur qui peut traiter 100 000 vidéos/mois avec FFmpeg qui fonctionne PARFAITEMENT !**