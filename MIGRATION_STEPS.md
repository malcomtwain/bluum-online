# 🚀 Post-bridge Migration - Étapes Simples

## Étape 1: Base de Données
1. Va sur: https://supabase.com/dashboard/project/wjtguiusxvxaabutfxls/sql/new
2. Copie tout le contenu de `EXECUTE_IN_SUPABASE_DASHBOARD.sql`
3. Colle dans l'éditeur SQL Supabase
4. Clique "Run"
5. Tu verras ton user ID dans les résultats
6. Copie ton user ID (le UUID)
7. Décommente la ligne avec `INSERT INTO post_bridge_api_keys...`
8. Remplace `'YOUR_USER_ID_HERE'` par ton vrai user ID
9. Execute le script une deuxième fois

## Étape 2: Test
Redémarre ton serveur de dev :
```bash
npm run dev
```

## Étape 3: Vérification
1. Va sur la page Distribution: http://localhost:3000/distribution
2. Tu devrais voir tes comptes sociaux se charger
3. Teste la création d'un post

## 🔑 Ton API Key Post-bridge
```
pb_live_6wCwS8ojvWbVt92qtthRPW
```

## ✅ Avantages
- API plus moderne et stable
- Meilleure documentation
- Support TikTok natif
- Upload de médias simplifié
- Rates limits plus clairs

## 📊 Différences principales
- **IDs des comptes**: Maintenant des numbers au lieu de strings
- **Authentication**: Bearer token au lieu de x-postfast-api-key
- **Endpoints**: `/api/post-bridge/*` au lieu de `/api/postfast/*`

## 🆘 Si ça marche pas
1. Vérifie que ton API key est bien insérée dans Supabase
2. Redémarre le serveur
3. Check la console du navigateur pour les erreurs
4. Vérifie dans Supabase que la table `post_bridge_api_keys` existe