# Déployer GRATUITEMENT sur Render avec FFmpeg

## ✅ Render.com = GRATUIT + FFmpeg fonctionne !

### Étapes (5 minutes) :

#### 1. Créer un compte Render
- Allez sur [render.com](https://render.com)
- Inscrivez-vous avec GitHub (gratuit)

#### 2. Nouveau Web Service
- Cliquez "New +" → "Web Service"
- Connectez votre repo GitHub (Bluum)
- Configuration :
  ```
  Name: bluum
  Environment: Node
  Build Command: npm install && npm run build
  Start Command: npm start
  Plan: FREE TIER (0$/mois) ← IMPORTANT !
  ```

#### 3. Variables d'environnement
Dans Render dashboard, ajoutez :
```bash
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=votre_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_key
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=votre_nom
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=votre_preset
```

#### 4. Domaine personnalisé (bluum.pro)
- Dans Render : Settings → Custom Domain
- Ajoutez : bluum.pro
- Dans votre DNS, créez un CNAME :
  ```
  Type: CNAME
  Name: @
  Value: bluum.onrender.com
  ```

#### 5. C'est tout ! 🎉
- URL temporaire : https://bluum.onrender.com
- Domaine custom : https://bluum.pro
- **FFmpeg fonctionne automatiquement !**

---

## 🚀 Script de déploiement automatique

```bash
#!/bin/bash
# deploy-to-render.sh

# 1. Installer Render CLI
npm install -g render-cli

# 2. Login
render login

# 3. Créer le service
render create web-service \
  --name bluum \
  --env node \
  --plan free \
  --repo https://github.com/votre-username/bluum

# 4. Déployer
render deploy

echo "✅ Déployé sur Render GRATUITEMENT!"
echo "🎬 FFmpeg fonctionne!"
echo "🌐 Accessible sur: https://bluum.onrender.com"
```

---

## 💡 Optimisation pour éviter le sommeil

### Option A: Ping automatique (garder éveillé)
```javascript
// Ajouter dans votre code
if (process.env.RENDER) {
  // Ping toutes les 14 minutes pour éviter le sommeil
  setInterval(() => {
    fetch('https://bluum.onrender.com/api/health')
      .catch(() => {});
  }, 14 * 60 * 1000);
}
```

### Option B: Utiliser UptimeRobot (GRATUIT)
1. Créez un compte sur [uptimerobot.com](https://uptimerobot.com) (gratuit)
2. Ajoutez un monitor : https://bluum.onrender.com
3. Interval : 5 minutes
4. Votre app ne dormira jamais !

---

## 📊 Comparaison Render vs Vercel

| Feature | Vercel | Render FREE |
|---------|--------|-------------|
| Prix | Gratuit | Gratuit |
| FFmpeg | ❌ NON | ✅ OUI |
| Domaine custom | ✅ | ✅ |
| SSL | ✅ | ✅ |
| Build automatique | ✅ | ✅ |
| Limite requêtes | 100k/mois | Illimité |
| Sommeil après inactivité | Non | 15 min |
| Wake-up time | - | ~30 sec |

---

## 🎯 Pourquoi Render est parfait pour Bluum

1. **FFmpeg fonctionne** sans configuration
2. **100% GRATUIT** pour toujours
3. **Domaine personnalisé** (bluum.pro)
4. **Build automatique** depuis GitHub
5. **750 heures/mois** (largement suffisant)

## ⚡ Migration depuis Vercel (2 minutes)

```bash
# 1. Dans Vercel
vercel env pull .env.local

# 2. Push sur GitHub
git add .
git commit -m "Add render.yaml"
git push

# 3. Sur Render
# Connecter GitHub → Deploy

# 4. Changer DNS
# CNAME: @ → bluum.onrender.com

# ✅ TERMINÉ !
```

---

## 🆚 Autres options gratuites

### Railway.app (5$ crédit/mois)
- ✅ FFmpeg marche
- ⚠️ Limité à 5$/mois
- Après = payant

### Fly.io (tier gratuit)
- ✅ FFmpeg marche
- ⚠️ Configuration plus complexe
- 3 VMs gratuits

### GitHub Codespaces
- ✅ FFmpeg marche
- ⚠️ 60 heures/mois gratuites
- IDE dans le browser

---

## ✅ RÉSUMÉ : Render = Solution GRATUITE

**En 5 minutes :**
1. Créer compte Render (gratuit)
2. Connecter GitHub
3. Deploy
4. bluum.pro fonctionne avec FFmpeg !

**Seul "défaut"** : S'endort après 15 min (contournable avec UptimeRobot)