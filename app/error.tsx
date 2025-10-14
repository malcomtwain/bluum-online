'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log l'erreur sur le serveur
    console.error('Erreur rencontrée:', error);
  }, [error]);

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-white">
      <div className="flex flex-col items-center">
        <div className="mb-8 text-4xl font-extrabold">Oups, quelque chose s'est mal passé</div>
        <p className="mb-8 text-center text-xl text-gray-600">
          Nous travaillons à résoudre ce problème.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => reset()}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Réessayer
          </button>
          <Link
            href="/"
            className="px-6 py-3 border border-gray-300 text-gray-600 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
} 