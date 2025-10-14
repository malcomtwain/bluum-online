"use client";

import { useState } from 'react';
import { verifyInvitationCode, login } from '../lib/auth';
import { toast } from 'react-hot-toast';

export default function InvitationPage() {
  const [invitationCode, setInvitationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Vérifier le code d'invitation et donner accès
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    
    if (!invitationCode.trim()) {
      toast.error('Veuillez entrer un code d\'invitation');
      return;
    }
    
    setIsVerifying(true);
    
    try {
      const isValid = await verifyInvitationCode(invitationCode.trim());
      
      if (isValid) {
        // Utiliser le code pour accéder directement
        const { user, error } = await login(invitationCode.trim());
        
        if (user && !error) {
          toast.success('Accès autorisé');
          // Rediriger vers la page principale
          window.location.href = '/';
        } else {
          toast.error(error || 'Erreur lors de la vérification du code');
          setErrorMessage(error || 'Erreur lors de la vérification du code');
        }
      } else {
        toast.error('Code d\'invitation invalide ou expiré');
        setErrorMessage('Code d\'invitation invalide ou expiré');
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      const errorMsg = error?.message || 'Erreur lors de la vérification';
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0c] dark:bg-[#0a0a0c]">
      <div className="w-full max-w-md mx-auto p-6 md:p-8 space-y-6 md:space-y-8 bg-gray-900 rounded-xl shadow-lg border border-gray-800">
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-white">Bluum</h1>
          <p className="text-gray-300 text-sm md:text-base">Bienvenue sur notre plateforme de génération vidéo</p>
        </div>
        
        {errorMessage && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 p-3 rounded-lg text-sm">
            {errorMessage}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="mt-6 md:mt-8 space-y-5">
          <div>
            <label htmlFor="invitation-code" className="block text-sm font-medium text-gray-200 mb-2">
              Code d'invitation
            </label>
            <input
              id="invitation-code"
              type="text"
              value={invitationCode}
              onChange={(e) => setInvitationCode(e.target.value)}
              placeholder="Entrez votre code d'invitation"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-500"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={isVerifying || !invitationCode.trim()}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isVerifying ? 'Vérification...' : 'Accéder au site'}
          </button>
        </form>
      </div>
    </div>
  );
} 