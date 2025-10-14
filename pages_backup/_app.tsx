import { Toaster } from 'react-hot-toast';
import { SupabaseSync } from '../components/SupabaseSync';
import type { AppProps } from 'next/app';
import { AuthProvider } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import InvitationPage from '../components/InvitationPage';
import '../styles/globals.css';

// Composant de redirection
function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  
  // Pages accessibles sans authentification
  const publicPages = ['/login', '/signup', '/invitation'];
  
  // Afficher un loader pendant la vérification de l'authentification
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Chargement...</div>
      </div>
    );
  }
  
  // Si l'utilisateur n'est pas connecté et qu'il n'est pas sur une page publique
  if (!user && !publicPages.includes(router.pathname)) {
    // Rediriger vers la page de login au lieu d'afficher la page d'invitation
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return null;
  }
  
  // Si l'utilisateur est connecté, afficher le contenu
  return <>{children}</>;
}

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <SupabaseSync />
      <Toaster position="bottom-right" />
      <AuthWrapper>
        <Component {...pageProps} />
      </AuthWrapper>
    </AuthProvider>
  );
}

export default MyApp; 