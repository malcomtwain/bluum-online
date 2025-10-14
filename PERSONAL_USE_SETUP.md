# Configuration pour Usage Personnel (100% GRATUIT)

## 🏆 MEILLEURE OPTION : Tailscale (VPN personnel gratuit)

### Qu'est-ce que Tailscale ?
- VPN mesh gratuit pour connecter tous tes appareils
- Accède à ton Mac depuis n'importe où
- Ultra sécurisé (personne d'autre ne peut accéder)
- 100% GRATUIT pour usage personnel

### Installation (5 minutes) :

#### 1. Installer Tailscale
```bash
# Sur ton Mac
brew install tailscale

# Ou télécharger depuis tailscale.com
```

#### 2. Se connecter
```bash
# Lancer Tailscale
tailscale up

# Se connecter avec Google/GitHub
# Accepter sur le site web
```

#### 3. Lancer Bluum
```bash
cd ~/Bluum/Bluum_1.4
npm run dev
```

#### 4. Accéder depuis n'importe où
- Sur ton iPhone/iPad : Installe Tailscale
- Sur un autre PC : Installe Tailscale
- Accède à : `http://ton-mac.tail-scale.ts.net:3000`
- **FFmpeg fonctionne parfaitement !**

---

## 🔥 Option 2 : Serveur à la maison (Raspberry Pi)

Si tu veux un "mini serveur" personnel :

### Matériel (40€ une fois)
- Raspberry Pi 4 (35€)
- Carte SD 32GB (5€)

### Installation
```bash
# Sur le Raspberry Pi
sudo apt update
sudo apt install nodejs npm ffmpeg git

# Cloner Bluum
git clone ton-repo
cd bluum
npm install
npm run build

# Lancer avec PM2
npm install -g pm2
pm2 start npm --name bluum -- start
```

### Accès distant
- Avec Tailscale (gratuit)
- Ou port forwarding sur ta box internet

---

## 🌐 Option 3 : GitHub Codespaces (60h/mois gratuit)

Parfait pour usage personnel !

1. Va sur ton repo GitHub
2. Clique "Code" → "Codespaces" → "Create"
3. VS Code s'ouvre dans le browser
4. Terminal intégré :
```bash
npm install
npm run dev
# FFmpeg marche !
```
5. Accès : `https://ton-username-bluum-abc123.github.dev`

**Avantages :**
- 60 heures/mois GRATUITES
- FFmpeg fonctionne
- Accessible partout
- Sauvegarde automatique

---

## 💡 Option 4 : Oracle Cloud (TOUJOURS GRATUIT)

Oracle offre un VPS **gratuit à vie** :

### Specs gratuites
- 4 CPU ARM
- 24GB RAM
- 200GB stockage
- **100% GRATUIT pour toujours**

### Installation
1. Créer compte sur cloud.oracle.com
2. Créer instance "Always Free"
3. SSH et installer :
```bash
sudo apt update
sudo apt install nodejs npm ffmpeg
git clone ton-repo
npm install && npm run build
pm2 start npm -- start
```

---

## 🎯 MON CHOIX pour usage perso :

### Si je voulais juste pour moi :

**1. Court terme :** GitHub Codespaces
- 0€
- 60h/mois gratuites
- Zéro config

**2. Moyen terme :** Tailscale + Mac local
- Ton Mac fait serveur
- Accès sécurisé partout
- FFmpeg natif

**3. Long terme :** Oracle Cloud Free
- VPS gratuit à vie
- 24GB RAM (!!)
- Parfait pour projets perso

---

## ⚡ Script "Usage Personnel" (2 min)

```bash
#!/bin/bash
# setup-personal.sh

echo "🏠 Configuration pour usage personnel"

# Option A : Tailscale
brew install tailscale
tailscale up

# Option B : Ngrok
brew install ngrok
ngrok http 3000 &

# Lancer l'app
npm run dev

echo "✅ Accessible depuis :"
echo "- Local : http://localhost:3000"
echo "- Tailscale : http://$(hostname).tail-scale.ts.net:3000"
echo "- Ngrok : Check terminal for URL"
```

---

## 📊 Comparaison pour usage perso

| Solution | Coût | FFmpeg | Accès distant | Effort |
|----------|------|---------|---------------|---------|
| Local + Tailscale | 0€ | ✅ | ✅ | 5 min |
| GitHub Codespaces | 0€ | ✅ | ✅ | 2 min |
| Oracle Cloud | 0€ | ✅ | ✅ | 20 min |
| Raspberry Pi | 40€ | ✅ | ✅ | 30 min |
| Render | 0€ | ✅ | ✅ | 5 min |

---

## ✅ RÉSUMÉ : Pour usage perso

**Ne te complique pas la vie !**

1. **Utilise GitHub Codespaces** (60h/mois gratuites)
2. Ou **Tailscale** pour accéder à ton Mac
3. Ou **Oracle Cloud** (VPS gratuit à vie)

Pas besoin de payer quoi que ce soit pour un usage personnel !