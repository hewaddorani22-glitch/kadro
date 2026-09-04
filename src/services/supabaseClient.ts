import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, User } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const CLOUD_DISABLED_KEY = '@kandro/cloud-disabled-after-deletion:v1';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

/** Base URL of the hosted edge functions, or null when Supabase is not set up. */
export const functionsBaseUrl = isSupabaseConfigured ? `${supabaseUrl!.replace(/\/$/, '')}/functions/v1` : null;
export const supabaseAnonKey = supabasePublishableKey ?? null;

export type SupabaseAccessSession = {
  accessToken: string;
  userId: string;
};

/**
 * Access token for the current session, refreshing it first when needed.
 * Returns null when Supabase is unavailable or the user opted out of the cloud.
 */
export async function getAccessToken(): Promise<string | null> {
  return (await getAccessSession())?.accessToken ?? null;
}

/** The token and subject are captured from the same Supabase session read. */
export async function getAccessSession(): Promise<SupabaseAccessSession | null> {
  if (!supabase) return null;
  if (!await ensureSupabaseUser().catch(() => null)) return null;
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  return session ? { accessToken: session.access_token, userId: session.user.id } : null;
}

/** Reads only the persisted session; unlike ensureSupabaseUser it never creates a new identity. */
export async function getCurrentSessionUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user.id ?? null;
}

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
let cloudDisabledPromise: Promise<boolean> | null = null;

export function isCloudSyncDisabledAfterDeletion() {
  cloudDisabledPromise ??= AsyncStorage.getItem(CLOUD_DISABLED_KEY).then((value) => value === 'true');
  return cloudDisabledPromise;
}

export async function disableCloudSyncAfterDeletion() {
  await AsyncStorage.setItem(CLOUD_DISABLED_KEY, 'true');
  cloudDisabledPromise = Promise.resolve(true);
  sessionPromise = null;
}

export async function enableCloudSyncAfterDeletion() {
  await AsyncStorage.removeItem(CLOUD_DISABLED_KEY);
  cloudDisabledPromise = Promise.resolve(false);
  sessionPromise = null;
}

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
    if (await isCloudSyncDisabledAfterDeletion()) return null;
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
