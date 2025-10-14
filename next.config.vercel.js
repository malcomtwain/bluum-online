/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  // Configuration pour le déploiement Vercel
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
        ],
      },
    ];
  },

  // Optimisation des images
  images: {
    unoptimized: true,
    domains: ['localhost', 'cdn.bluum.app', 'bluum-uploads.s3.amazonaws.com', 'wjtguiusxvxaabutfxls.supabase.co'],
  },
  
  // Configuration expérimentale pour Vercel
  experimental: {
    largePageDataBytes: 128 * 1000000, // 128 MB
    instrumentationHook: false,
  },
  
  // Désactiver temporairement les vérifications strictes
  typescript: {
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Résolution des chemins
  transpilePackages: ['@clerk/nextjs'],
  
  // Configuration webpack optimisée pour Vercel
  webpack: (config, { isServer, dev }) => {
    // Ajouter la résolution des alias
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.join(__dirname),
    };
    
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

    return config;
  },

  // Variables d'environnement pour Vercel
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_FFMPEG_ENV: process.env.NEXT_PUBLIC_FFMPEG_ENV || 'vercel',
  },
};

module.exports = nextConfig;
