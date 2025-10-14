# Configuration Supabase - Guide Complet

## Étapes pour configurer Supabase

### 1. Créer les buckets de stockage

Exécutez cette migration SQL dans l'éditeur SQL de Supabase :

```sql
-- Fichier: supabase/migrations/ensure_all_buckets_exist.sql
```

### 2. Créer les tables pour les médias générés

Exécutez cette migration SQL :

```sql
-- Fichier: supabase/migrations/create_generated_media.sql
```

### 3. Vérifier les variables d'environnement

Assurez-vous que ces variables sont définies dans `.env.local` :

```bash
NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key
SUPABASE_SERVICE_KEY=votre_service_key
```

### 4. Ordre d'exécution des migrations

1. `ensure_all_buckets_exist.sql` - Crée tous les buckets nécessaires
2. `create_generated_media.sql` - Crée les tables pour stocker les métadonnées
3. `create_media_collections.sql` - Crée les tables pour les collections
4. `create_scheduled_posts.sql` - Crée les tables pour les posts programmés
5. `create_postfast_api_keys.sql` - Crée les tables pour les clés API

### 5. Vérification

Après avoir exécuté les migrations :

1. Allez dans **Storage** dans le dashboard Supabase
2. Vérifiez que ces buckets existent :
   - `generated-media`
   - `clips`
   - `media`
   - `music`
   - `templates`

3. Allez dans **Table Editor**
4. Vérifiez que ces tables existent :
   - `generated_videos`
   - `generated_slideshows`
   - `media_collections`
   - `user_clips`
   - `user_media`
   - `user_music`

### Problèmes courants

1. **"Bucket does not exist"** : Exécutez `ensure_all_buckets_exist.sql`
2. **"Permission denied"** : Vérifiez que `SUPABASE_SERVICE_KEY` est définie
3. **"Table does not exist"** : Exécutez les migrations SQL correspondantes