import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Singleton instances
let anonClient: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Get or create anonymous client (for client-side operations)
export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials not configured');
    return null;
  }
  
  if (!anonClient) {
    anonClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  
  return anonClient;
}

// Get or create service client (for server-side operations with full access)
export function getSupabaseServiceClient(): SupabaseClient | null {
  if (!supabaseUrl) {
    console.warn('Supabase URL not configured');
    return null;
  }
  
  const key = supabaseServiceKey || supabaseAnonKey;
  if (!key) {
    console.warn('No Supabase keys available');
    return null;
  }
  
  if (!serviceClient) {
    serviceClient = createClient(supabaseUrl, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  
  return serviceClient;
}

// Note: Don't export default client to avoid multiple instances