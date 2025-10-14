// Ce fichier n'est plus nécessaire car le plugin @netlify/plugin-nextjs
// gère automatiquement le rendu de l'application Next.js
// Ce fichier est maintenu pour compatibilité, mais ne fait rien de particulier

exports.handler = async function(event, context) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Cette fonction est remplacée par le plugin @netlify/plugin-nextjs"
    })
  };
}; 