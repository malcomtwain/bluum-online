# Configuration de Cloudinary pour Bluum

## Étapes pour configurer Cloudinary :

### 1. Créer un compte Cloudinary (Gratuit)
1. Aller sur [https://cloudinary.com/users/register/free](https://cloudinary.com/users/register/free)
2. Créer un compte gratuit (25 GB de bande passante/mois inclus)

### 2. Récupérer vos identifiants
1. Une fois connecté, aller sur le Dashboard
2. Noter votre **Cloud Name** (ex: `dxy1234abc`)

### 3. Créer un Upload Preset (IMPORTANT)
1. Aller dans **Settings** (icône engrenage)
2. Cliquer sur **Upload** dans le menu de gauche
3. Scroll jusqu'à **Upload presets**
4. Cliquer sur **Add upload preset**
5. Configurer :
   - **Preset name** : `bluum-upload` (ou ce que vous voulez)
   - **Signing Mode** : **Unsigned** (TRÈS IMPORTANT)
   - **Folder** : `bluum` (optionnel, pour organiser)
6. Cliquer sur **Save**

### 4. Configurer les variables d'environnement

#### En local (.env.local) :
```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=votre_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=bluum-upload
```

#### Sur Vercel :
1. Aller dans les Settings de votre projet
2. Environment Variables
3. Ajouter :
   - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` = votre_cloud_name
   - `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` = bluum-upload

### 5. Redéployer
```bash
git add .
git commit -m "Add Cloudinary configuration"
git push
```

## Avantages de Cloudinary :

- ✅ **Gratuit** : 25 GB/mois de bande passante
- ✅ **Rapide** : CDN mondial
- ✅ **Pas de limite de taille** : Peut gérer des fichiers de plusieurs GB
- ✅ **Transformations** : Peut optimiser/compresser automatiquement
- ✅ **Fiable** : 99.9% uptime

## Limites du plan gratuit :

- 25 GB de bande passante/mois
- 25 GB de stockage total
- 25 000 transformations/mois

Pour la plupart des utilisateurs, c'est largement suffisant !

## Dépannage :

### Erreur "Upload preset not found"
→ Vérifier que le preset est bien en mode **Unsigned**

### Erreur "Cloud name not found"
→ Vérifier l'orthographe du cloud name

### Erreur CORS
→ Cloudinary accepte tous les domaines par défaut, pas de configuration nécessaire