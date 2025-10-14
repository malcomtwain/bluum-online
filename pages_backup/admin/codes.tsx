import { useEffect, useState } from 'react';
import { supabase } from '../../lib/auth';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';

type InvitationCode = {
  id: string;
  code: string;
  uses_allowed: number;
  uses_count: number;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
};

export default function InvitationCodesPage() {
  const { user } = useAuth();
  const [codes, setCodes] = useState<InvitationCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newCode, setNewCode] = useState('');
  const [usesAllowed, setUsesAllowed] = useState(1);
  const [expiryDays, setExpiryDays] = useState(30);
  const [isGenerating, setIsGenerating] = useState(false);

  // Récupérer les codes d'invitation
  const fetchCodes = async () => {
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('invitation_codes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      toast.error('Erreur lors de la récupération des codes');
    } else {
      setCodes(data || []);
    }
    
    setIsLoading(false);
  };

  // Générer un code d'invitation
  const generateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newCode.trim()) {
      toast.error('Veuillez entrer un code');
      return;
    }
    
    setIsGenerating(true);
    
    // Calculer la date d'expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);
    
    const { data, error } = await supabase
      .from('invitation_codes')
      .insert([
        {
          code: newCode.trim(),
          uses_allowed: usesAllowed,
          expires_at: expiresAt.toISOString()
        }
      ])
      .select();
    
    if (error) {
      toast.error('Erreur lors de la création du code');
    } else {
      toast.success('Code créé avec succès');
      fetchCodes();
      setNewCode('');
    }
    
    setIsGenerating(false);
  };

  // Désactiver un code
  const toggleCodeStatus = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('invitation_codes')
      .update({ is_active: !isActive })
      .eq('id', id);
    
    if (error) {
      toast.error('Erreur lors de la mise à jour du code');
    } else {
      toast.success(`Code ${!isActive ? 'activé' : 'désactivé'} avec succès`);
      fetchCodes();
    }
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  // Si l'utilisateur n'est pas authentifié
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white">
        <h1 className="text-2xl">Accès non autorisé</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Gestion des codes d'invitation</h1>
        
        {/* Formulaire de création de code */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Créer un nouveau code</h2>
          
          <form onSubmit={generateCode} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Code
                </label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="ex: BLUUM-2023"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Utilisations autorisées
                </label>
                <input
                  type="number"
                  min="1"
                  value={usesAllowed}
                  onChange={(e) => setUsesAllowed(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Expiration (jours)
                </label>
                <input
                  type="number"
                  min="1"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md"
                  required
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={isGenerating}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium"
            >
              {isGenerating ? 'Création...' : 'Créer le code'}
            </button>
          </form>
        </div>
        
        {/* Liste des codes */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Codes existants</h2>
          
          {isLoading ? (
            <p>Chargement des codes...</p>
          ) : codes.length === 0 ? (
            <p>Aucun code trouvé</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-400 text-left">
                  <tr>
                    <th className="px-4 py-2">Code</th>
                    <th className="px-4 py-2">Utilisations</th>
                    <th className="px-4 py-2">Créé le</th>
                    <th className="px-4 py-2">Expire le</th>
                    <th className="px-4 py-2">Statut</th>
                    <th className="px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((code) => (
                    <tr key={code.id} className="border-t border-gray-700">
                      <td className="px-4 py-3 font-medium">{code.code}</td>
                      <td className="px-4 py-3">
                        {code.uses_count} / {code.uses_allowed}
                      </td>
                      <td className="px-4 py-3">
                        {new Date(code.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {code.expires_at
                          ? new Date(code.expires_at).toLocaleDateString()
                          : 'Jamais'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            code.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {code.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleCodeStatus(code.id, code.is_active)}
                          className={`text-xs px-2 py-1 rounded ${
                            code.is_active
                              ? 'bg-red-500 hover:bg-red-600'
                              : 'bg-green-500 hover:bg-green-600'
                          }`}
                        >
                          {code.is_active ? 'Désactiver' : 'Activer'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 