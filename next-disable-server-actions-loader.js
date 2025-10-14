/**
 * Loader Webpack personnalisé pour supprimer les Server Actions des fichiers JavaScript et TypeScript.
 * Ce loader recherche et supprime la directive "use server" dans les fichiers pour rendre
 * le projet compatible avec l'export statique de Next.js.
 */
module.exports = function(source) {
  // Remplacer la directive "use server" par un commentaire
  const modifiedSource = source.replace(/["']use server["'];?/g, '/* server action disabled */');
  
  // Retourner le code source modifié
  return modifiedSource;
};
