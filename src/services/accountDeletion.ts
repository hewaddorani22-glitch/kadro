import { clearLocalKadroData } from '@/services/localRepository';
import { clearLocalWellnessConsent } from '@/services/consent';
import {
  disableCloudSyncAfterDeletion,
  isSupabaseConfigured,
  rememberSupabaseUser,
  supabase,
} from '@/services/supabaseClient';
import { clearTelemetryAfterAccountDeletion } from '@/services/telemetry';

export async function deleteKadroAccount() {
  if (!supabase || !isSupabaseConfigured) {
    await Promise.all([clearLocalKadroData(), clearLocalWellnessConsent(), clearTelemetryAfterAccountDeletion()]);
    return;
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) throw new Error('Die aktuelle Kontositzung ist nicht mehr verfügbar.');

  const { error } = await supabase.functions.invoke('delete-account', { method: 'DELETE' });
  if (error) throw error;

  await disableCloudSyncAfterDeletion();
  rememberSupabaseUser(null);
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  await Promise.all([
    clearLocalKadroData(),
    clearLocalWellnessConsent(),
    clearTelemetryAfterAccountDeletion(),
  ]);
}

export function accountDeletionErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLocaleLowerCase('en-US');
  if (normalized.includes('session') || normalized.includes('jwt') || normalized.includes('unauthorized')) {
    return 'Deine Sitzung ist abgelaufen. Öffne Kadro erneut und versuche die Löschung noch einmal.';
  }
  if (normalized.includes('function') || normalized.includes('fetch') || normalized.includes('network')) {
    return 'Die sichere Löschfunktion ist gerade nicht erreichbar. Bitte prüfe deine Verbindung und versuche es erneut.';
  }
  return message || 'Der Account konnte gerade nicht gelöscht werden.';
}
