import { createClient } from '@supabase/supabase-js';
// ADR-022 + ADR-010: auth tokens must use expo-secure-store (Keychain iOS), NOT AsyncStorage
import { LargeSecureStore } from './large-secure-store';

// Supabase configuration from environment variables
// IMPORTANT: These MUST be set in .env or app will fail
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: LargeSecureStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
