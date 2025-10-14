import { getSupabaseClient } from './supabase-singleton';

export const supabase = getSupabaseClient();

export type User = {
  id: string;
  email: string | undefined;
  name?: string;
  created_at?: string;
};

/**
 * Get the current authenticated user
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    if (!supabase) {
      console.error('Supabase client not available');
      return null;
    }
    
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.email?.split('@')[0],
      created_at: user.created_at,
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Sign out the current user
 */
export async function signOut() {
  try {
    if (!supabase) {
      console.error('Supabase client not available');
      return;
    }
    
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
    }
  } catch (error) {
    console.error('Error signing out:', error);
  }
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChanged(callback: (user: User | null) => void) {
  if (!supabase) {
    console.error('Supabase client not available');
    return () => {}; // Return empty unsubscribe function
  }
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      callback({
        id: session.user.id,
        email: session.user.email,
        name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
        created_at: session.user.created_at,
      });
    } else {
      callback(null);
    }
  });

  return () => {
    subscription.unsubscribe();
  };
}

/**
 * Initialize auth and get the current session
 */
export async function initAuth(): Promise<User | null> {
  try {
    if (!supabase) {
      console.error('Supabase client not available');
      return null;
    }
    
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session?.user) {
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
      created_at: session.user.created_at,
    };
  } catch (error) {
    console.error('Error initializing auth:', error);
    return null;
  }
}