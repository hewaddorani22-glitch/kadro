import AsyncStorage from '@react-native-async-storage/async-storage';

import { ensureSupabaseUser, isSupabaseConfigured, supabase } from '@/services/supabaseClient';

export const PRIVACY_VERSION = '2026-08-31-mvp';
const CONSENT_KEY = '@kandro/wellness-consent:v1';

type StoredConsent = {
  version: string;
  acceptedAt: string;
};

export async function recordWellnessConsent(): Promise<StoredConsent> {
  const consent = { version: PRIVACY_VERSION, acceptedAt: new Date().toISOString() };
  await AsyncStorage.setItem(CONSENT_KEY, JSON.stringify(consent));

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

  return consent;
}

export async function clearLocalWellnessConsent() {
  await AsyncStorage.removeItem(CONSENT_KEY);
}
