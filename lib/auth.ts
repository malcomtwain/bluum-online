import { getSupabaseClient } from './supabase-singleton';

// Utiliser le client Supabase singleton
export const supabase = getSupabaseClient();

// Type pour un utilisateur
export type User = {
  id: string;
  email?: string;
  username?: string;
  fullName?: string;
  avatarUrl?: string;
  invitationCode?: string;
};

// État global d'authentification
let currentUser: User | null = null;
const authListeners: ((user: User | null) => void)[] = [];

// Vérifier un code d'invitation
export async function verifyInvitationCode(code: string): Promise<boolean> {
  if (!supabase) {
    console.error('Supabase client not available');
    return false;
  }
  
  const { data, error } = await supabase
    .from('invitation_codes')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return false;
  }

  // Vérifier que le code n'a pas expiré et n'a pas dépassé le nombre d'utilisations
  const now = new Date();
  if (data.expires_at && new Date(data.expires_at) < now) {
    return false;
  }
  
  if (data.uses_count >= data.uses_allowed) {
    return false;
  }

  return true;
}

// Créer un compte avec un code d'invitation
export async function createAccount(
  username: string, 
  email: string, 
  code: string
): Promise<{ user: User | null; error: string | null }> {
  // Vérifier le code avant de continuer
  const isValid = await verifyInvitationCode(code);
  if (!isValid) {
    return { user: null, error: 'Code d\'invitation invalide ou expiré' };
  }

  // Créer l'utilisateur
  if (!supabase) {
    return { user: null, error: 'Database connection error' };
  }
  
  const { data: userData, error: userError } = await supabase
    .from('users')
    .insert([
      { username, email, invitation_code: code }
    ])
    .select()
    .single();

  if (userError) {
    return { 
      user: null, 
      error: userError.message || 'Erreur lors de la création du compte' 
    };
  }

  // Incrémenter le compteur d'utilisation du code
  if (supabase) {
    await supabase
      .from('invitation_codes')
      .update({ uses_count: supabase.rpc('increment', { row_id: code }) })
      .eq('code', code);
  }

  // Convertir en objet User
  const user: User = {
    id: userData.id,
    email: userData.email,
    username: userData.username,
    fullName: userData.full_name,
    avatarUrl: userData.avatar_url
  };

  // Mettre à jour l'état global
  setCurrentUser(user);
  
  // Stocker l'ID utilisateur dans le localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('bluum_user_id', user.id);
  }

  return { user, error: null };
}

// Se connecter avec nom d'utilisateur ou code d'invitation
export async function login(usernameOrCode: string): Promise<{ user: User | null; error: string | null }> {
  if (!supabase) {
    return { user: null, error: 'Database connection error' };
  }
  
  // Essayer d'abord de se connecter avec le nom d'utilisateur
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('username', usernameOrCode)
    .single();

  if (!userData || userError) {
    // Si le nom d'utilisateur n'existe pas, essayer avec le code d'invitation
    const isValidCode = await verifyInvitationCode(usernameOrCode);
    
    if (!isValidCode) {
      return { user: null, error: 'Code d\'invitation invalide' };
    }
    
    // Generate a consistent ID based on the invitation code
    // This ensures the same user gets the same ID on refresh
    const tempUserId = `invitation_${usernameOrCode}`;
    
    // Pour un simple accès via code, créer un utilisateur temporaire en mémoire
    // sans l'enregistrer dans la base de données
    const tempUser: User = {
      id: tempUserId,
      username: 'Invité',
      // Utiliser le code comme identifiant unique
      invitationCode: usernameOrCode
    };
    
    // Mettre à jour l'état global
    setCurrentUser(tempUser);
    
    // Stocker le code d'invitation dans le localStorage pour les futures visites
    if (typeof window !== 'undefined') {
      localStorage.setItem('bluum_invitation_code', usernameOrCode);
      // Also store the user ID for consistency
      localStorage.setItem('bluum_user_id', tempUserId);
    }
    
    return { user: tempUser, error: null };
  }

  // Cas où l'utilisateur existe déjà (login classique)
  // Mettre à jour la date de dernière connexion
  await supabase
    .from('users')
    .update({ last_login: new Date().toISOString() })
    .eq('user_id', userData.user_id || userData.id);

  // Convertir en objet User
  const user: User = {
    id: userData.id,
    email: userData.email,
    username: userData.username,
    fullName: userData.full_name,
    avatarUrl: userData.avatar_url
  };

  // Mettre à jour l'état global
  setCurrentUser(user);
  
  // Stocker l'ID utilisateur dans le localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('bluum_user_id', user.id);
  }

  return { user, error: null };
}

// Se déconnecter
export function logout(): void {
  setCurrentUser(null);
  
  // Supprimer les données d'authentification du localStorage
  if (typeof window !== 'undefined') {
    localStorage.removeItem('bluum_user_id');
    localStorage.removeItem('bluum_invitation_code');
  }
}

// Récupérer l'utilisateur courant
export function getCurrentUser(): User | null {
  return currentUser;
}

// Mettre à jour l'utilisateur courant
function setCurrentUser(user: User | null): void {
  currentUser = user;
  // Notifier tous les listeners
  authListeners.forEach(listener => listener(user));
}

// Ajouter un listener pour les changements d'état d'authentification
export function onAuthStateChanged(callback: (user: User | null) => void): () => void {
  authListeners.push(callback);
  
  // Appeler le callback immédiatement avec l'état actuel
  callback(currentUser);
  
  // Retourner une fonction pour supprimer le listener
  return () => {
    const index = authListeners.indexOf(callback);
    if (index !== -1) {
      authListeners.splice(index, 1);
    }
  };
}

// Initialiser l'authentification au chargement
export async function initAuth(): Promise<void> {
  if (typeof window !== 'undefined') {
    // Vérifier d'abord s'il y a un utilisateur existant
    const userId = localStorage.getItem('bluum_user_id');
    if (userId) {
      // Check if this is an invitation-based user ID
      if (userId.startsWith('invitation_')) {
        // Get the invitation code from the user ID or from storage
        const invitationCode = localStorage.getItem('bluum_invitation_code');
        if (invitationCode) {
          // Verify if the code is still valid
          const isValid = await verifyInvitationCode(invitationCode);
          if (isValid) {
            // Create a consistent temporary user
            setCurrentUser({
              id: userId,
              username: 'Invité',
              invitationCode: invitationCode
            });
          } else {
            // If the code is no longer valid, log out
            localStorage.removeItem('bluum_invitation_code');
            localStorage.removeItem('bluum_user_id');
          }
          return;
        }
      }
      
      // For standard users, retrieve from the database
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (!error && data) {
        setCurrentUser({
          id: data.id,
          email: data.email,
          username: data.username,
          fullName: data.full_name,
          avatarUrl: data.avatar_url
        });
      } else {
        // Si l'utilisateur n'existe plus, se déconnecter
        logout();
      }
    } else {
      // Sinon, vérifier s'il y a un code d'invitation stocké
      const invitationCode = localStorage.getItem('bluum_invitation_code');
      if (invitationCode) {
        // Vérifier si le code est toujours valide
        const isValid = await verifyInvitationCode(invitationCode);
        if (isValid) {
          // Generate a consistent ID based on the invitation code
          const tempUserId = `invitation_${invitationCode}`;
          
          // Créer un utilisateur temporaire
          setCurrentUser({
            id: tempUserId,
            username: 'Invité',
            invitationCode: invitationCode
          });
          
          // Store the user ID for future sessions
          localStorage.setItem('bluum_user_id', tempUserId);
        } else {
          // Si le code n'est plus valide, se déconnecter
          localStorage.removeItem('bluum_invitation_code');
        }
      }
    }
  }
} 