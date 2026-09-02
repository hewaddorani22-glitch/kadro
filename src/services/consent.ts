import AsyncStorage from '@react-native-async-storage/async-storage';

import { ensureSupabaseUser, isSupabaseConfigured, supabase } from '@/services/supabaseClient';

/**
 * Bump this whenever the recipients or purposes in the explicit consent text
 * change. Older consent must not silently cover a newly disclosed transfer.
 */
export const PRIVACY_VERSION = '2026-09-02-ai-v1';
const CONSENT_KEY = '@kandro/wellness-consent:v1';

type StoredConsent = {
  version: string;
  acceptedAt: string;
};

export async function recordWellnessConsent(): Promise<StoredConsent> {
  const consent = { version: PRIVACY_VERSION, acceptedAt: new Date().toISOString() };

  if (supabase && isSupabaseConfigured) {
    const user = await ensureSupabaseUser();
    if (user) {
      const { error } = await supabase.from('profiles').upsert({
        user_id: user.id,
        privacy_version: consent.version,
        wellness_consent_at: consent.acceptedAt,
        updated_at: consent.acceptedAt,
      }, { onConflict: 'user_id' });
      if (error) throw error;
    }
  }

  // Persist locally only after the server accepted the same consent version.
  // Otherwise a failed network request could make the UI look consented while
  // the gateway correctly rejects every analysis.
  await AsyncStorage.setItem(CONSENT_KEY, JSON.stringify(consent));

  return consent;
}

export async function hasCurrentWellnessConsent(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(CONSENT_KEY);
    if (!stored) return false;
    const consent = JSON.parse(stored) as Partial<StoredConsent>;
    return consent.version === PRIVACY_VERSION && typeof consent.acceptedAt === 'string';
  } catch {
    return false;
  }
}

/**
 * Stops future wellness processing without deleting the user's history.
 * Account deletion remains a separate, stronger action.
 */
export async function withdrawWellnessConsent() {
  if (supabase && isSupabaseConfigured) {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (user) {
      const { error } = await supabase
        .from('profiles')
        .update({ privacy_version: null, wellness_consent_at: null, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      if (error) throw error;
    }
  }
  await clearLocalWellnessConsent();
}

export async function clearLocalWellnessConsent() {
  await AsyncStorage.removeItem(CONSENT_KEY);
}
