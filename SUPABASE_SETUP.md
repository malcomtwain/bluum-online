# Configuration Supabase Storage pour Bluum

## Problème actuel

L'application affiche des erreurs comme :
```
Bucket 'media' does not exist. Attempting to create...
Could not create bucket 'media': new row violates row-level security policy
```

Cela se produit parce que les buckets Supabase Storage ne peuvent pas être créés automatiquement à cause des politiques RLS (Row Level Security).

## Solution

### Option 1: Via l'interface Supabase (Recommandé)

1. Va dans ton [dashboard Supabase](https://supabase.com/dashboard)
2. Sélectionne ton projet
3. Va dans **Storage** dans le menu de gauche
4. Clique sur **Create a new bucket** pour chaque bucket requis :
   - `templates` (public, 10MB limit)
   - `media` (public, 10MB limit) 
   - `music` (public, 10MB limit)
   - `generated` (public, 10MB limit)
   - `clips` (public, 10MB limit)

### Option 2: Via SQL - Version Simple (Recommandée en premier)

Si tu as déjà des politiques RLS existantes, utilise cette version qui ne touche qu'aux buckets :

1. Dans ton dashboard Supabase, va dans **SQL Editor**
2. Crée une nouvelle requête
3. Copie-colle le contenu de `supabase/migrations/20240305_create_storage_buckets_simple.sql`
4. Exécute la requête

### Option 3: Via SQL - Version Complète (Si la simple ne suffit pas)

Si tu veux aussi configurer les politiques RLS :

1. Dans ton dashboard Supabase, va dans **SQL Editor**
2. Crée une nouvelle requête
3. Copie-colle le contenu de `supabase/migrations/20240305_create_storage_buckets.sql`
4. Exécute la requête

**Note :** Cette version remplace les politiques existantes. Si tu as l'erreur "policy already exists", utilise d'abord la version simple.

### Option 4: Via la ligne de commande

Si tu as `supabase-cli` installé :

```bash
cd /Users/twain/Bluum/Bluum_1.4
supabase db push
```

## Résolution des erreurs de politiques

### Erreur "policy already exists"
```
ERROR: 42710: policy "Allow public read access" for table "objects" already exists
```

**Solution :** Utilise la version simple de la migration qui ne touche qu'aux buckets.

### Erreur RLS persistante après création des buckets
Si tu as créé les buckets mais que l'erreur RLS persiste :

1. Va dans **Storage** → **Policies** dans ton dashboard Supabase
2. Vérifie que les buckets ont des politiques d'accès appropriées
3. Ou exécute la version complète de la migration

## Vérification

Après avoir créé les buckets, redémarre l'application. Tu devrais voir dans la console :

```
Successfully initialized buckets: templates, media, music, generated, clips
```

Au lieu de :
```
Could not create bucket 'media': new row violates row-level security policy
```

## Fallback local

Si les buckets ne sont toujours pas accessibles, l'application utilisera automatiquement le stockage local (localStorage) comme fallback. Les fichiers seront stockés en base64 dans le navigateur.

## Structure des buckets

- **templates**: Images et vidéos de templates (10MB max)
- **media**: Médias uploadés par l'utilisateur (10MB max)
- **music**: Fichiers audio (10MB max)
- **generated**: Vidéos générées par l'application (10MB max)
- **clips**: Clips utilisateur pour la bibliothèque (10MB max)

## Politiques RLS

Les buckets sont configurés avec :
- Accès public en lecture
- Upload/modification/suppression pour utilisateurs authentifiés
- Support spécial pour les utilisateurs avec codes d'invitation (user_id commençant par 'invitation_')
