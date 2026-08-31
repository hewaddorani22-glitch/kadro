import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, User } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

let sessionPromise: Promise<User | null> | null = null;

export function rememberSupabaseUser(user: User | null) {
  sessionPromise = user ? Promise.resolve(user) : null;
}

export function startSupabaseAuthLifecycle() {
  if (!supabase || Platform.OS === 'web') return () => undefined;

  if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });

  return () => {
    subscription.remove();
    supabase.auth.stopAutoRefresh();
  };
}

export function ensureSupabaseUser(): Promise<User | null> {
  if (!supabase) return Promise.resolve(null);
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (sessionData.session?.user) return sessionData.session.user;

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    return data.user;
  })().catch((error) => {
    sessionPromise = null;
    throw error;
  });

  return sessionPromise;
}
