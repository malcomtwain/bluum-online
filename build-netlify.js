#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Fonction pour exécuter des commandes shell avec logs
function runCommand(command) {
  console.log(`🔄 Exécution de: ${command}`);
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`❌ Erreur lors de l'exécution de la commande: ${command}`);
    return false;
  }
}

// Fonction principale
async function main() {
  console.log('🔧 Installation des dépendances...');
  
  // S'assurer que toutes les dépendances dev sont installées même en production
  if (process.env.NODE_ENV === 'production') {
    // Installer explicitement les dépendances manquantes
    runCommand('npm install --no-save postcss-import postcss-preset-env');
  } else {
    runCommand('npm install');
  }

  // Compiler Next.js
  console.log('🏗️ Building Next.js app...');
  const buildSuccess = runCommand('npm run build');
  
  if (!buildSuccess) {
    console.log('❌ Build failed, mais on continue quand même');
    process.exit(1); // Sortir avec un code d'erreur
  }

  console.log('✅ Build completed successfully!');
}

// Exécuter la fonction principale
main().catch(err => {
  console.error('❌ Une erreur est survenue:', err);
  process.exit(1);
}); 