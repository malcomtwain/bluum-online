# Guide: Deploy Bluum Worker sur Google Cloud Platform

## 💰 Coût avec $300 free credit

**VM e2-standard-2** (2 vCPU, 8GB RAM):
- Prix: ~$50/mois
- Avec $300 credit: **6 mois gratuits**
- Capacity: ~500 vidéos/jour

**VM e2-standard-4** (4 vCPU, 16GB RAM):
- Prix: ~$120/mois
- Avec $300 credit: **2.5 mois gratuits**
- Capacity: ~1,000 vidéos/jour

## 📋 Étape 1: Créer compte GCP

1. Va sur https://console.cloud.google.com
2. Crée un compte (carte requise, $1 temporaire)
3. Active les $300 free credit (90 jours)

## 🖥️ Étape 2: Créer une VM

### Via Console Web:

1. **Compute Engine** → **VM instances** → **CREATE INSTANCE**

2. **Configuration recommandée:**
   ```
   Name: bluum-worker-1
   Region: europe-west1 (Belgique) ou us-central1
   Machine type: e2-standard-2 (2 vCPU, 8GB)
   Boot disk: Ubuntu 22.04 LTS (20GB)
   Firewall: Allow HTTP traffic
   ```

3. **Clique "CREATE"**

### Via gcloud CLI (plus rapide):

```bash
# Installe gcloud CLI: https://cloud.google.com/sdk/docs/install

# Crée la VM
gcloud compute instances create bluum-worker-1 \
  --zone=europe-west1-b \
  --machine-type=e2-standard-2 \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=20GB \
  --boot-disk-type=pd-standard \
  --tags=http-server
```

## 🔧 Étape 3: Installer le worker

### 3.1 - SSH dans ta VM

**Option A: Via Console Web**
1. Va sur **Compute Engine** → **VM instances**
2. Clique sur **SSH** à côté de ta VM

**Option B: Via terminal**
```bash
gcloud compute ssh bluum-worker-1 --zone=europe-west1-b
```

### 3.2 - Télécharge et exécute le setup script

```bash
# Télécharge le script d'installation
curl -O https://raw.githubusercontent.com/malcomtwain/bluum/master/gcp-setup.sh

# Rends-le exécutable
chmod +x gcp-setup.sh

# Exécute-le
./gcp-setup.sh
```

### 3.3 - Clone ton code

```bash
cd /home/$USER/bluum-worker
git clone https://github.com/malcomtwain/bluum.git temp
cp temp/worker/server.js .
rm -rf temp
```

### 3.4 - Configure Supabase

```bash
nano .env
```

Remplis avec tes credentials Supabase:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...ton-service-key
WORKER_ID=gcp-worker-1
POLL_INTERVAL=5000
PORT=3001
```

Sauvegarde: `Ctrl+X`, puis `Y`, puis `Enter`

### 3.5 - Installe les dépendances

```bash
npm install
```

### 3.6 - Démarre le worker

```bash
# Active le service
sudo systemctl enable bluum-worker

# Démarre le service
sudo systemctl start bluum-worker

# Vérifie le status
sudo systemctl status bluum-worker
```

## 📊 Étape 4: Monitoring

### Voir les logs en temps réel:
```bash
sudo journalctl -u bluum-worker -f
```

### Voir les stats du worker:
```bash
curl http://localhost:3001/stats
```

### Voir la health:
```bash
curl http://localhost:3001/health
```

## 🔄 Commandes utiles

```bash
# Restart worker
sudo systemctl restart bluum-worker

# Stop worker
sudo systemctl stop bluum-worker

# Voir les logs
sudo journalctl -u bluum-worker -n 100

# Update code
cd /home/$USER/bluum-worker
git pull
npm install
sudo systemctl restart bluum-worker

# Voir l'utilisation CPU/RAM
htop
```

## 🚀 Scaling (optionnel)

### Augmenter le nombre de workers en parallèle:

Modifie `server.js` pour traiter plus de jobs simultanément:

```javascript
// Au lieu de 1 worker, lance 4 en parallèle
const CONCURRENT_JOBS = 4;
```

### Ajouter plus de VMs:

Crée plusieurs VMs identiques et elles vont automatiquement poll la même queue Supabase.

## 💰 Monitoring des coûts

1. **Billing** → **Budgets & alerts**
2. Crée une alerte à $50, $100, $200
3. Tu seras notifié par email

## 🛑 Éteindre pour économiser

Si tu n'utilises pas le worker:

```bash
# Via CLI
gcloud compute instances stop bluum-worker-1 --zone=europe-west1-b

# Redémarrer
gcloud compute instances start bluum-worker-1 --zone=europe-west1-b
```

VM éteinte = tu paies seulement le storage (~$2/mois)

## 📈 Capacité estimée

| VM Type | vCPU | RAM | Vidéos/jour | Prix/mois | Mois gratuits |
|---------|------|-----|-------------|-----------|---------------|
| e2-medium | 2 | 4GB | ~300 | $30 | 10 mois |
| e2-standard-2 | 2 | 8GB | ~500 | $50 | 6 mois |
| e2-standard-4 | 4 | 16GB | ~1,000 | $120 | 2.5 mois |
| n2-standard-8 | 8 | 32GB | ~2,000 | $250 | 1 mois |

## ❓ Troubleshooting

### Worker ne démarre pas:
```bash
sudo journalctl -u bluum-worker -n 50
```

### Out of memory:
Upgrade ta VM à un type plus gros ou réduis `CONCURRENT_JOBS`

### Pas de jobs traités:
Vérifie que Supabase credentials sont corrects dans `.env`

## 🎉 C'est tout!

Ton worker GCP va maintenant traiter les vidéos 24/7 gratuitement pendant 6 mois (avec $300 credit).
