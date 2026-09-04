import { clearLocalKandroData } from '@/services/localRepository';
import { clearLocalWellnessConsent } from '@/services/consent';
import {
  disableCloudSyncAfterDeletion,
  isSupabaseConfigured,
  rememberSupabaseUser,
  supabase,
} from '@/services/supabaseClient';
import { clearRemindersAfterAccountDeletion } from '@/services/reminders';
import { clearTelemetryAfterAccountDeletion } from '@/services/telemetry';
import { getDictionary } from '@/i18n/active';

export async function deleteKandroAccount() {
  // Erase analytics before the irreversible server mutation. If current
  // AsyncStorage or the SDK cannot be drained, deletion stays retryable and no
  // stale adult opt-in/queue can survive into the replacement account.
  await clearTelemetryAfterAccountDeletion();
  if (!supabase || !isSupabaseConfigured) {
    await Promise.all([clearLocalKandroData(), clearLocalWellnessConsent(), clearRemindersAfterAccountDeletion()]);
    return;
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) throw new Error(getDictionary().errors.deletionSessionGone);

  const { error } = await supabase.functions.invoke('delete-account', { method: 'DELETE' });
  if (error) throw error;

  await disableCloudSyncAfterDeletion();
  rememberSupabaseUser(null);
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  await Promise.all([
    clearLocalKandroData(),
    clearLocalWellnessConsent(),
    clearRemindersAfterAccountDeletion(),
  ]);
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
