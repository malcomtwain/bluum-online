# Déploiement GRATUIT avec FFmpeg

## Option 1: Render.com (GRATUIT)

### Étapes de déploiement :

1. **Créer un compte sur Render.com**
   - Allez sur [render.com](https://render.com)
   - Inscrivez-vous (gratuit)

2. **Créer un nouveau Web Service**
   - Cliquez sur "New +"
   - Choisissez "Web Service"
   - Connectez votre repo GitHub

3. **Configuration**
   ```
   Name: bluum-app
   Environment: Node
   Build Command: npm install && npm run build
   Start Command: npm start
   Plan: FREE
   ```

4. **Variables d'environnement**
   - Copiez toutes vos variables de `.env.local`
   - Ajoutez-les dans Render

5. **Déployer**
   - Render installera automatiquement FFmpeg
   - Votre app sera disponible sur `bluum-app.onrender.com`

### Limitations du tier gratuit :
- App s'endort après 15 min sans trafic
- Premier chargement après sommeil : ~30 secondes
- 750 heures/mois (suffisant pour un projet)

---

## Option 2: Hébergement LOCAL (100% GRATUIT)

Si vous avez un ordinateur qui peut rester allumé :

### 1. **Utiliser votre ordinateur comme serveur**

```bash
# Installer ngrok (tunnel sécurisé)
brew install ngrok  # Mac
# ou télécharger sur ngrok.com

# Lancer votre app localement
npm run build
npm start

# Dans un autre terminal, exposer votre app
ngrok http 3000
```

Vous obtiendrez une URL publique comme : `https://abc123.ngrok.io`

### 2. **Utiliser un Raspberry Pi** (~40€ une fois)
- Achetez un Raspberry Pi
- Installez Node.js et FFmpeg
- Utilisez votre connexion internet personnelle

---

## Option 3: Solution Hybride GRATUITE

### Frontend sur Vercel (GRATUIT) + API sur Render (GRATUIT)

1. **Séparer le code en 2 parties :**

```javascript
// Frontend (Vercel) - pages et UI
/app
/components
/public

// Backend API (Render) - traitement vidéo
/api-server
  /routes
    - video-processing.js
  - server.js
```

2. **Créer un serveur Express simple pour l'API :**

```javascript
// api-server/server.js
const express = require('express');
const cors = require('cors');
const { processVideo } = require('./video-processor');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/process-video', async (req, res) => {
  try {
    const result = await processVideo(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(process.env.PORT || 3001);
```

3. **Dans le frontend, appeler l'API Render :**

```javascript
// Au lieu d'appeler /api/create-video local
const response = await fetch('https://your-api.onrender.com/process-video', {
  method: 'POST',
  body: JSON.stringify(data)
});
```

---

## Option 4: FFmpeg dans le NAVIGATEUR (100% GRATUIT)

### Utiliser FFmpeg.wasm (traitement côté client)

```bash
npm install @ffmpeg/ffmpeg @ffmpeg/util
```

```javascript
// components/ClientVideoProcessor.tsx
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

const ffmpeg = new FFmpeg();

async function processVideoInBrowser(videoFile) {
  if (!ffmpeg.loaded) {
    await ffmpeg.load();
  }
  
  // Écrire le fichier en mémoire
  await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));
  
  // Exécuter FFmpeg
  await ffmpeg.exec(['-i', 'input.mp4', /* options */, 'output.mp4']);
  
  // Lire le résultat
  const data = await ffmpeg.readFile('output.mp4');
  const blob = new Blob([data], { type: 'video/mp4' });
  
  return URL.createObjectURL(blob);
}
```

### Avantages :
- ✅ 100% gratuit
- ✅ Pas de serveur nécessaire
- ✅ Fonctionne sur Vercel

### Inconvénients :
- ⚠️ Plus lent (utilise le CPU du client)
- ⚠️ Limité par la RAM du navigateur
- ⚠️ Pas idéal pour grosses vidéos

---

## RECOMMANDATION FINALE

**Pour commencer GRATUITEMENT :**

1. **Court terme** : Déployez sur **Render.com** (gratuit, facile, FFmpeg fonctionne)

2. **Moyen terme** : Si l'app grandit, utilisez l'**architecture hybride** :
   - Frontend sur Vercel (gratuit)
   - API vidéo sur Render (gratuit)

3. **Long terme** : Si succès, passez à Railway (5$/mois) ou solution payante

**Commande pour migrer rapidement vers Render :**
```bash
# Installer Render CLI
npm install -g render-cli

# Déployer
render deploy
```