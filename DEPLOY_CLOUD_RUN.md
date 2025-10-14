# Déploiement du service de traitement vidéo sur Google Cloud Run

## Prérequis
- Un compte Google Cloud (avec les 300$ de crédit gratuit)
- Google Cloud CLI installé (`gcloud`)

## Étapes de déploiement

### 1. Configurer Google Cloud

```bash
# Se connecter à Google Cloud
gcloud auth login

# Créer un nouveau projet (ou utiliser un existant)
gcloud projects create bluum-video-processor --name="Bluum Video Processor"

# Définir le projet par défaut
gcloud config set project bluum-video-processor

# Activer les APIs nécessaires
gcloud services enable run.api
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

### 2. Déployer le service

```bash
# Aller dans le dossier video-processor
cd video-processor

# Déployer sur Cloud Run
gcloud run deploy video-processor \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --concurrency 10 \
  --max-instances 100
```

### 3. Récupérer l'URL du service

Après le déploiement, vous recevrez une URL comme :
```
https://video-processor-xxxxx-uc.a.run.app
```

### 4. Configurer votre application

Ajoutez l'URL dans votre fichier `.env.local` :
```env
NEXT_PUBLIC_VIDEO_PROCESSOR_URL=https://video-processor-xxxxx-uc.a.run.app
```

## Limites du plan gratuit

- **2 millions de requêtes par mois**
- **360,000 GB-secondes de mémoire**
- **180,000 vCPU-secondes**
- **1 GB de trafic sortant**

Avec ces limites, vous pouvez traiter environ :
- **10,000+ vidéos par mois** (selon la durée)
- Traitement en parallèle illimité
- Scale automatique à 0 quand pas utilisé

## Optimisations possibles

### Pour économiser les ressources :
1. Réduire la mémoire à 1Gi si suffisant
2. Réduire le timeout si les vidéos sont courtes
3. Utiliser `--max-instances 10` pour limiter les coûts

### Pour plus de performance :
1. Augmenter `--cpu 4` et `--memory 4Gi`
2. Utiliser une région plus proche de vos utilisateurs
3. Activer Cloud CDN pour les vidéos finales

## Monitoring

Voir les logs :
```bash
gcloud run services logs read video-processor
```

Voir les métriques :
```bash
gcloud run services describe video-processor
```

## Mise à jour du service

```bash
# Après modification du code
cd video-processor
gcloud run deploy video-processor --source .
```

## Suppression (si nécessaire)

```bash
gcloud run services delete video-processor
```