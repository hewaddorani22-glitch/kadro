import { clearLocalKandroData, invalidatePrivateData } from '@/services/localRepository';
import { clearLocalWellnessConsent } from '@/services/consent';
import {
  disableCloudSyncAfterDeletion,
  isSupabaseConfigured,
  rememberSupabaseUser,
  supabase,
} from '@/services/supabaseClient';
import { clearRemindersAfterAccountDeletion } from '@/services/reminders';
import { clearTelemetryAfterAccountDeletion } from '@/services/telemetry';
import { clearSubscriptionIdentityAfterAccountDeletion } from '@/services/subscription';
import { clearRevenueCatExperimentMeasurementForAccountDeletion } from '@/services/revenueCatExperimentAnalytics';
import { beginAppleAccountDeletion, clearAppleAuthenticationState, runAccountOperation } from '@/services/appleReauthentication';
import { getDictionary } from '@/i18n/active';

export async function deleteKandroAccount() {
  // Capture which account the deletion request refers to before waiting for a
  // concurrent login. Waiting must not turn 'delete A' into 'delete B'.
  const snapshot = supabase && isSupabaseConfigured ? await supabase.auth.getSession() : null;
  if (snapshot?.error) throw snapshot.error;
  const expectedUserId = snapshot?.data.session?.user.id ?? null;
  return runAccountOperation(async () => {
    const finishAppleDeletion = beginAppleAccountDeletion();
    try { return await deleteAccountAndLocalData(expectedUserId); }
    finally { finishAppleDeletion(); }
  }, true);
}

async function deleteAccountAndLocalData(expectedUserId: string | null) {
  // Erase analytics before the irreversible server mutation. If current
  // AsyncStorage or the SDK cannot be drained, deletion stays retryable and no
  // stale adult opt-in/queue can survive into the replacement account.
  await invalidatePrivateData();
  await clearTelemetryAfterAccountDeletion();
  await clearRevenueCatExperimentMeasurementForAccountDeletion();
  if (!supabase || !isSupabaseConfigured) {
    await Promise.all([clearLocalKandroData(), clearLocalWellnessConsent(), clearRemindersAfterAccountDeletion(), clearAppleAuthenticationState()]);
    return { appleRevocation: 'not_applicable' as const };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session || !expectedUserId || sessionData.session.user.id !== expectedUserId) throw new Error(getDictionary().errors.deletionSessionGone);

  const { data, error } = await supabase.functions.invoke('delete-account', { method: 'DELETE' });
  if (error) throw error;
  if (data?.deleted !== true) throw new Error(getDictionary().errors.deletionFailed);

  await clearSubscriptionIdentityAfterAccountDeletion().catch(() => undefined);
  await disableCloudSyncAfterDeletion();
  rememberSupabaseUser(null);
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  await Promise.all([
    clearLocalKandroData(),
    clearLocalWellnessConsent(),
    clearRemindersAfterAccountDeletion(),
    clearAppleAuthenticationState(),
  ]);
  return { appleRevocation: data.appleRevocation === 'manual_required' ? 'manual_required' as const : data.appleRevocation === 'revoked' ? 'revoked' as const : 'not_applicable' as const };
}

export function accountDeletionErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLocaleLowerCase('en-US');
  if (normalized.includes('session') || normalized.includes('jwt') || normalized.includes('unauthorized')) {
    return getDictionary().errors.deletionExpired;
  }
  if (normalized.includes('function') || normalized.includes('fetch') || normalized.includes('network')) {
    return getDictionary().errors.deletionUnreachable;
  }
  return message || getDictionary().errors.deletionFailed;
}
