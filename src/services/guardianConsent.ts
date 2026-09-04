import type { Language } from '@/i18n';
import { ensureSupabaseUser, isSupabaseConfigured, supabase } from '@/services/supabaseClient';

export const GUARDIAN_CONSENT_VERSION = '2026-09-04-guardian-v1';

type GuardianResponse = {
  status?: 'pending' | 'approved';
  code?: string;
};

async function invoke(body: Record<string, unknown>): Promise<GuardianResponse> {
  if (!supabase || !isSupabaseConfigured) throw new Error('guardian_cloud_required');
  const user = await ensureSupabaseUser();
  if (!user) throw new Error('guardian_cloud_required');
  const { data, error } = await supabase.functions.invoke<GuardianResponse>('guardian-consent', { body });
  if (error) throw error;
  return data ?? {};
}

export async function requestGuardianConsent(guardianEmail: string, age: number, language: Language) {
  const result = await invoke({ action: 'request', guardianEmail, age, language });
  if (result.status !== 'pending' && result.status !== 'approved') throw new Error(result.code ?? 'guardian_request_failed');
  return result.status;
}

export async function getGuardianConsentStatus() {
  const result = await invoke({ action: 'status' });
  return result.status === 'approved';
}
