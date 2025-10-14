'use client';

import { useState, useEffect } from 'react';
import { X, Upload, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface TikTokAccount {
  id: string;
  platform: string;
  platformUsername?: string;
  displayName?: string;
}

interface TikTokPublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  videoPath?: string;
  defaultCaption?: string;
  onSuccess?: () => void;
}

export function TikTokPublishModal({
  isOpen,
  onClose,
  videoUrl,
  videoPath,
  defaultCaption = '',
  onSuccess
}: TikTokPublishModalProps) {
  const [accounts, setAccounts] = useState<TikTokAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [caption, setCaption] = useState(defaultCaption);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishAsDraft, setPublishAsDraft] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchAccounts();
      setCaption(defaultCaption);
    }
  }, [isOpen, defaultCaption]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/post-bridge/social-accounts');
      const data = await response.json();
      
      if (response.ok && data.accounts) {
        setAccounts(data.accounts);
        if (data.accounts.length > 0 && !selectedAccountId) {
          setSelectedAccountId(data.accounts[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast.error('Impossible de charger les comptes TikTok');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedAccountId) {
      toast.error('Veuillez sélectionner un compte TikTok');
      return;
    }

    if (!caption.trim()) {
      toast.error('Veuillez ajouter une légende');
      return;
    }

    try {
      setPublishing(true);
      
      const response = await fetch('/api/post-bridge/create-posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoUrl,
          videoPath,
          caption,
          socialMediaId: selectedAccountId,
          publishAsDraft,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(
          publishAsDraft 
            ? 'Vidéo envoyée en draft sur TikTok !' 
            : 'Vidéo programmée sur TikTok !'
        );
        onSuccess?.();
        onClose();
      } else {
        throw new Error(result.error || 'Erreur lors de la publication');
      }
    } catch (error) {
      console.error('Error publishing to TikTok:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la publication');
    } finally {
      setPublishing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      
      <div className="relative bg-gray-900 rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold text-white mb-6">
          Publier sur TikTok
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <p className="text-gray-300 mb-4">
              Aucun compte TikTok connecté
            </p>
            <p className="text-sm text-gray-400 mb-6">
              Connectez votre compte TikTok sur Post-bridge pour publier vos vidéos
            </p>
            <a
              href="https://post-bridge.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              Connecter un compte
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Compte TikTok
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.displayName || account.platformUsername || 'Compte TikTok'}
                    {account.platformUsername && ` (@${account.platformUsername})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Légende
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Ajoutez une légende pour votre vidéo..."
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
                rows={4}
                maxLength={2200}
              />
              <p className="text-xs text-gray-500 mt-1">
                {caption.length}/2200 caractères
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="publishAsDraft"
                checked={publishAsDraft}
                onChange={(e) => setPublishAsDraft(e.target.checked)}
                className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500"
              />
              <label htmlFor="publishAsDraft" className="text-sm text-gray-300">
                Envoyer en mode draft (recommandé)
              </label>
            </div>

            {publishAsDraft && (
              <div className="p-4 bg-blue-900/20 border border-blue-600 rounded-lg">
                <p className="text-sm text-blue-400">
                  La vidéo sera envoyée en draft sur TikTok. Vous pourrez la réviser et la publier manuellement depuis l'app TikTok.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={publishing}
                className="flex-1 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing || !selectedAccountId || !caption.trim()}
                className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {publishing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Publication...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    {publishAsDraft ? 'Envoyer en draft' : 'Publier'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}