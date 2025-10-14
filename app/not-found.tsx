import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
      <h2 className="text-4xl font-bold text-gray-800">Page non trouvée</h2>
      <p className="text-xl text-gray-600">
        Désolé, la page que vous recherchez n'existe pas.
      </p>
      <div className="mt-6 flex gap-4">
        <Button asChild variant="default">
          <Link href="/">Retour à l'accueil</Link>
        </Button>
      </div>
    </div>
  );
} 