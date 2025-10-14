/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,

  // Configuration pour le déploiement Netlify
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
      {
        source: '/temp-videos/:path*',
        headers: [
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
    ];
  },

  // Optimisation des images
  images: {
    unoptimized: true,
    domains: ['localhost', 'cdn.bluum.app', 'bluum-uploads.s3.amazonaws.com', 'wjtguiusxvxaabutfxls.supabase.co'],
  },
  
  // Configuration expérimentale minimale
  experimental: {
    largePageDataBytes: 128 * 1000000, // 128 MB
    instrumentationHook: false,
  },
  
  // Désactiver temporairement les vérifications strictes
  typescript: {
    ignoreBuildErrors: true, // Ignore TypeScript errors during build
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Résolution des chemins
  transpilePackages: ['@clerk/nextjs'],
  
  // Configuration webpack avec résolution des alias
  webpack: (config, { isServer, dev }) => {
    // Ajouter la résolution des alias
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.join(__dirname),
    };
    
    // Sur Netlify en production, remplacer Clerk par notre mock
    const isNetlify = process.env.NETLIFY === 'true' || process.env.NEXT_PUBLIC_NETLIFY_DEPLOYMENT === 'true';
    
    if (isNetlify && !dev) {
      console.log('📣 Netlify détecté: Utilisation du mock d\'authentification');
      config.resolve.alias['@clerk/nextjs'] = path.join(__dirname, 'lib/auth-mock.ts');
      config.resolve.alias['@clerk/clerk-react'] = path.join(__dirname, 'lib/auth-mock.ts');
    }
    
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        child_process: false,
        net: false,
        tls: false,
        canvas: false,
        crypto: false,
        stream: false,
        '@ffmpeg/ffmpeg': false,
        '@ffmpeg/util': false,
      };
    }

    // Résoudre l'erreur de 'self is not defined' pour les modules web
    config.module.rules.push({
      test: /\.m?js/,
      resolve: {
        fullySpecified: false,
      },
    });

    // Personnaliser le comportement de webpack pour les workers
    config.module.rules.push({
      test: /\.worker\.js$/,
      use: {
        loader: 'worker-loader',
        options: {
          filename: 'static/[hash].worker.js',
          publicPath: '/_next/',
        },
      },
    });

    return config;
  },

  // Gestion de l'environnement
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_FFMPEG_ENV: process.env.NEXT_PUBLIC_FFMPEG_ENV || 'local',
    NEXT_PUBLIC_NETLIFY_DEPLOYMENT: process.env.NETLIFY === 'true' ? 'true' : 'false',
  },
};

// Export du module configuré
module.exports = nextConfig; 