import AsyncStorage from '@react-native-async-storage/async-storage';

import { ensureSupabaseUser, isSupabaseConfigured, supabase } from '@/services/supabaseClient';

/**
 * Bump this whenever the recipients or purposes in the explicit consent text
 * change. Older consent must not silently cover a newly disclosed transfer.
 */
export const PRIVACY_VERSION = '2026-09-04-ai-v2';
const CONSENT_KEY = '@kandro/wellness-consent:v1';

type StoredConsent = {
  version: string;
  acceptedAt: string;
};

export async function recordWellnessConsent(age: number): Promise<StoredConsent> {
  const consent = { version: PRIVACY_VERSION, acceptedAt: new Date().toISOString() };

  if (!Number.isInteger(age) || age < 14 || age > 100) throw new Error('invalid_consent_age');
  // Guardian approval is verified server-side. An under-16 profile must never
  // fall back to a local-only consent that a modified client could mint.
  if (age < 16 && (!supabase || !isSupabaseConfigured)) throw new Error('guardian_cloud_required');

  if (supabase && isSupabaseConfigured) {
    const user = await ensureSupabaseUser();
    // Cloud-disabled after deletion is not the same as a local-only build. A
    // local success here would show active consent while the hosted gateway
    // correctly rejects every request for lack of a server profile.
    if (!user) throw new Error('cloud_account_disabled');
    const { error } = await supabase.from('profiles').upsert({
      user_id: user.id,
      age,
      privacy_version: consent.version,
      wellness_consent_at: consent.acceptedAt,
      updated_at: consent.acceptedAt,
    }, { onConflict: 'user_id' });
    if (error) throw error;
  }

  // Persist locally only after the server accepted the same consent version.
  // Otherwise a failed network request could make the UI look consented while
  // the gateway correctly rejects every analysis.
  await AsyncStorage.setItem(CONSENT_KEY, JSON.stringify(consent));

  return consent;
}

/**
 * Drops the local record when the gateway says the server has no matching
 * consent.
 *
 * The two can legitimately diverge: deleting the account and re-enabling the
 * cloud creates a *new* anonymous user, and that user has no consent row. The
 * screen then said "Consent is active" while every analysis was refused, and
 * the only button offered was "Withdraw": a dead end with no way back.
 */
export async function forgetLocalWellnessConsent() {
  await AsyncStorage.removeItem(CONSENT_KEY);
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
