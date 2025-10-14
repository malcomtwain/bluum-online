# Configuration FFmpeg pour Vercel

## Problème
Vercel utilise des fonctions serverless qui ne permettent pas facilement l'exécution de binaires comme FFmpeg.

## Solutions Appliquées

### 1. Configuration Automatique
- `/lib/ffmpeg-config.ts` : Configuration principale qui détecte l'environnement
- `/lib/ffmpeg-vercel.ts` : Recherche spécifique pour Vercel
- `/lib/ffmpeg-layer.ts` : Solution alternative avec détection de commande

### 2. Packages Installés
- `ffmpeg-static` : Binaires statiques de FFmpeg
- `@ffmpeg-installer/ffmpeg` : Installation automatique de FFmpeg

### 3. Script Post-Installation
- `/scripts/postinstall.js` : Configure FFmpeg après installation

### 4. Configuration Vercel
- `vercel.json` : Configure l'environnement et les commandes d'installation

## Solutions Alternatives

Si FFmpeg ne fonctionne toujours pas sur Vercel, voici les alternatives :

### Option 1: Utiliser un Service Externe
Au lieu d'exécuter FFmpeg sur Vercel, utilisez un service de traitement vidéo :
- AWS MediaConvert
- Cloudinary Video API
- Mux
- Transloadit

### Option 2: Utiliser une Function Séparée
Déployez le traitement vidéo sur une plateforme qui supporte FFmpeg :
- AWS Lambda avec Layer FFmpeg
- Google Cloud Functions
- Railway.app
- Render.com
- Fly.io

### Option 3: API de Traitement Vidéo
Créez une API séparée sur un VPS ou service qui supporte FFmpeg :
```javascript
// Exemple d'appel à une API externe
const processVideo = async (videoUrl) => {
  const response = await fetch('https://your-video-api.com/process', {
    method: 'POST',
    body: JSON.stringify({ url: videoUrl, operations: [...] })
  });
  return response.json();
};
```

### Option 4: Utiliser Netlify Functions
Netlify Functions supportent mieux les binaires. Vous pourriez :
1. Déployer sur Netlify au lieu de Vercel
2. Utiliser Netlify Functions pour le traitement vidéo

## Configuration Actuelle

La configuration actuelle essaie dans l'ordre :
1. `ffmpeg-static` pour Vercel
2. `@ffmpeg-installer/ffmpeg` comme fallback
3. Commande système `ffmpeg` en dernier recours

Les logs détaillés montrent quel chemin est utilisé et pourquoi.

## Débogage

Pour déboguer FFmpeg sur Vercel :
1. Vérifiez les logs de fonction dans le dashboard Vercel
2. Les logs montrent les chemins testés et les erreurs
3. Si "ffmpeg: command not found", utilisez une solution alternative

## Recommandation

Pour une solution robuste en production, je recommande d'utiliser **Cloudinary** pour le traitement vidéo car :
- Vous utilisez déjà Cloudinary pour l'upload
- Leur API vidéo est puissante et fiable
- Pas de problème de binaires sur Vercel
- Traitement plus rapide et scalable

Exemple avec Cloudinary :
```javascript
const cloudinary = require('cloudinary').v2;

const processVideo = async (publicId) => {
  return cloudinary.video(publicId, {
    transformation: [
      { width: 1080, height: 1920, crop: 'fill' },
      { quality: 'auto' },
      { format: 'mp4' }
    ]
  });
};
```