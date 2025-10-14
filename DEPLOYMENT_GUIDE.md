# 🚀 Guide de Déploiement Bluum - Architecture Cloud

## 📋 Vue d'ensemble

Cette architecture permet de **générer des vidéos en arrière-plan** même après avoir fermé le navigateur :

```
Frontend (Vercel) → API Job → Queue (Supabase) → Worker (Render) → Storage (Supabase)
                                    ↓
                            Notifications temps réel
```

## ✅ Avantages

- ✨ **Génération asynchrone** : Les vidéos continuent de se créer après fermeture du site
- 🚀 **Pas de timeout** : Pas de limite de 10 secondes comme sur Vercel
- 💪 **FFmpeg complet** : Toutes les fonctionnalités FFmpeg disponibles
- 📊 **Suivi en temps réel** : Progress bar et notifications
- 💰 **Économique** : ~$7/mois pour le worker Render
- 🔄 **Scalable** : Peut ajouter plusieurs workers facilement

---

## 📦 Étape 1 : Préparer Supabase

### 1.1 Appliquer la migration

```bash
# Depuis le dossier du projet
cd /Users/twain/Bluum

# Appliquer la migration
npx supabase db push
```

Ou manuellement dans le Dashboard Supabase → SQL Editor :
```sql
-- Copier le contenu de supabase/migrations/create_video_jobs_queue.sql
```

### 1.2 Créer le bucket `generated-videos`

Dans Supabase Dashboard → Storage :
1. Créer un nouveau bucket : `generated-videos`
2. Mettre **Public bucket** : ✅ (activé)
3. Allowed MIME types : `video/mp4`

### 1.3 Activer Realtime

Dans Supabase Dashboard → Database → Replication :
1. Trouver la table `video_jobs`
2. Activer **Realtime** : ✅

---

## 🔧 Étape 2 : Déployer le Worker sur Render

### 2.1 Créer un compte Render.com

👉 [https://render.com](https://render.com)

### 2.2 Créer un nouveau Web Service

1. **Connect Repository** : Connecter ton repo GitHub
2. **Name** : `bluum-video-worker`
3. **Region** : Oregon (plus proche, moins cher)
4. **Branch** : `master` ou `main`
5. **Root Directory** : `worker`
6. **Environment** : `Node`
7. **Build Command** : `npm install`
8. **Start Command** : `npm start`
9. **Plan** : Starter ($7/mois)

### 2.3 Variables d'environnement sur Render

Ajouter ces variables dans Render Dashboard → Environment :

```bash
NODE_VERSION=18.18.0
NEXT_PUBLIC_SUPABASE_URL=https://ton-projet.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc... (ta service key)
POLL_INTERVAL=5000
```

**⚠️ IMPORTANT** : Utilise la **Service Role Key** (pas la anon key) depuis Supabase Dashboard → Settings → API

### 2.4 Déployer

Render va automatiquement :
- ✅ Installer Node.js 18
- ✅ Installer FFmpeg
- ✅ Installer Puppeteer et Chromium
- ✅ Démarrer le worker

Le worker sera accessible sur : `https://bluum-video-worker.onrender.com`

---

## 🌐 Étape 3 : Garder Vercel pour le Frontend

### 3.1 Variables d'environnement Vercel

Dans Vercel Dashboard → Settings → Environment Variables, **ajouter** (sans supprimer les existantes) :

```bash
WORKER_ENABLED=true
```

### 3.2 Redéployer sur Vercel

```bash
vercel --prod
```

Ou via le Dashboard : Settings → Deployments → Redeploy

---

## 🧪 Étape 4 : Tester le système

### 4.1 Test local du worker

```bash
cd worker
npm install

# Créer un .env
cat > .env << EOF
NEXT_PUBLIC_SUPABASE_URL=https://ton-projet.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
POLL_INTERVAL=5000
EOF

npm start
```

Le worker devrait afficher :
```
🚀 Worker worker-1234567890 listening on port 3001
🔄 Starting job polling every 5000ms
```

### 4.2 Test de création de job

1. Va sur ton site (Vercel ou local)
2. Crée une vidéo comme d'habitude
3. Le frontend devrait afficher : "Video job created successfully"
4. Regarde les logs du worker Render : tu devrais voir le job en cours

### 4.3 Vérifier dans Supabase

Dashboard → Table Editor → `video_jobs` :
- Tu devrais voir ton job avec `status = 'processing'`
- Le `progress` devrait augmenter (10, 20, 30... 100)
- Quand terminé : `status = 'completed'` et `video_url` remplie

---

## 🔔 Étape 5 : Intégrer les notifications frontend

### 5.1 Mettre à jour la page de création

Remplace l'ancien appel API dans `app/create/page.tsx` :

```typescript
// Ancienne méthode (supprime ça)
const response = await fetch('/api/create-video', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token}`
  },
  body: JSON.stringify(videoData)
});

// ✅ NOUVELLE MÉTHODE (utilise ça à la place)
const response = await fetch('/api/create-video-job', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token}`
  },
  body: JSON.stringify(videoData)
});

const result = await response.json();

if (result.success) {
  // Stocker le jobId pour suivre la progression
  setCurrentJobId(result.jobId);

  toast.success('Video queued! Processing in background...');

  // Optionnel : Rediriger vers une page de suivi
  router.push(`/videos?job=${result.jobId}`);
}
```

### 5.2 Ajouter le composant de notification

Dans ta page où tu crées les vidéos :

```typescript
import { VideoJobNotification } from '@/components/VideoJobNotification';

// Dans ton composant
const [currentJobId, setCurrentJobId] = useState<string | null>(null);

return (
  <>
    {/* Ton interface existante */}

    {/* Notification en bas à droite */}
    <VideoJobNotification
      jobId={currentJobId}
      onComplete={(videoUrl) => {
        console.log('Video ready:', videoUrl);
        // Rafraîchir la liste de vidéos, etc.
      }}
      onError={(error) => {
        console.error('Job failed:', error);
      }}
    />
  </>
);
```

---

## 📊 Monitoring et Debug

### Logs du Worker

Render Dashboard → Logs → `bluum-video-worker`

Tu verras :
```
🎬 Processing job abc-123-def
📥 Downloading files...
🎞️ Processing videos...
🔗 Concatenating videos...
☁️ Uploading to Supabase...
✅ Job abc-123-def completed
```

### Stats du Worker

Visite : `https://bluum-video-worker.onrender.com/stats`

Retourne :
```json
{
  "worker_id": "worker-1234567890",
  "processed": 42,
  "failed": 2,
  "lastJobAt": "2025-01-15T10:30:00Z",
  "uptime": 86400
}
```

### Health Check

`https://bluum-video-worker.onrender.com/health`

```json
{
  "status": "healthy",
  "worker_id": "worker-1234567890",
  "uptime": 86400
}
```

---

## 🔥 Nettoyage automatique

La migration SQL inclut une fonction de nettoyage :

```sql
-- Supprimer les jobs terminés > 7 jours
SELECT cleanup_old_video_jobs();
```

Pour automatiser (optionnel), créer un Cron Job sur Supabase :
1. Dashboard → Database → Cron Jobs
2. Ajouter : `SELECT cleanup_old_video_jobs();`
3. Fréquence : Tous les jours à 3h du matin

---

## 💰 Coûts estimés

| Service | Plan | Prix |
|---------|------|------|
| **Vercel** | Hobby | Gratuit |
| **Supabase** | Free | Gratuit (500MB stockage) |
| **Render Worker** | Starter | $7/mois |
| **Total** | | **~$7/mois** |

### Optimisations pour réduire les coûts

1. **Supabase** : Nettoyer les vieilles vidéos après 7 jours
2. **Render** : Utiliser "Suspend" si pas d'activité (économise des $)
3. **Scaling** : Ajouter un 2e worker seulement si nécessaire

---

## 🚨 Troubleshooting

### Problème : Le worker ne récupère pas les jobs

**Solution** : Vérifier les variables d'environnement sur Render
```bash
# Dans Render Dashboard → Environment
NEXT_PUBLIC_SUPABASE_URL=https://...  ✅
SUPABASE_SERVICE_KEY=eyJhbGc...      ✅
```

### Problème : FFmpeg not found

**Solution** : Le Dockerfile inclut FFmpeg automatiquement, redéployer sur Render

### Problème : Puppeteer crash

**Solution** : Le Dockerfile inclut Chromium + dépendances, vérifier les logs Render

### Problème : "Authentication required"

**Solution** : L'utilisateur doit être connecté pour créer des jobs
- Vérifier que le token est bien passé dans `Authorization: Bearer ...`
- Vérifier que Supabase Auth fonctionne

---

## 🎉 C'est tout !

Tu as maintenant une architecture **production-ready** qui permet :

✅ Générer des vidéos en arrière-plan
✅ Fermer le site pendant le traitement
✅ Recevoir des notifications en temps réel
✅ Scalable et économique
✅ Pas de problèmes avec Vercel/FFmpeg

**Prochaines étapes :**
1. Appliquer la migration Supabase
2. Déployer le worker sur Render
3. Tester avec une vraie vidéo
4. Profiter ! 🎊
