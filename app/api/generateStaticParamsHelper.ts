/**
 * Helper pour rendre toutes les routes API compatibles avec l'export statique de Next.js
 *
 * Ce fichier fournit des exports partagés que toutes les routes API peuvent utiliser
 * pour être compatibles avec `output: 'export'` dans next.config.js
 */

// Forcer le mode statique pour toutes les routes API
export const dynamic = 'force-static';

// Générer des paramètres vides pour l'export statique
// Cette fonction ne génère aucune page statique mais satisfait l'exigence de Next.js
export function generateStaticParams() {
  return [];
}

// Note: En production, ces routes seront gérées par les fonctions Netlify
// grâce à la redirection dans netlify.toml:
// [[redirects]]
//   from = "/api/*"
//   to = "/.netlify/functions/:splat"
//   status = 200
