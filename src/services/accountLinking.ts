import { User } from '@supabase/supabase-js';
import type { Language } from '@/i18n';

import { getDictionary } from '@/i18n/active';
import {
  ensureSupabaseUser,
  enableCloudSyncAfterDeletion,
  isCloudSyncDisabledAfterDeletion,
  isSupabaseConfigured,
  rememberSupabaseUser,
  supabase,
} from '@/services/supabaseClient';

export type AccountLinkState =
  | { status: 'unavailable' }
  | { status: 'disabled' }
  | { status: 'anonymous'; userId: string }
  | { status: 'pending'; userId: string; email: string }
  | { status: 'linked'; userId: string; email: string };

function stateFromUser(user: User | null): AccountLinkState {
  if (!user) return { status: 'unavailable' };
  if (!user.is_anonymous && user.email) return { status: 'linked', userId: user.id, email: user.email };
  if (user.new_email) return { status: 'pending', userId: user.id, email: user.new_email };
  return { status: 'anonymous', userId: user.id };
}

function requireClient() {
  if (!supabase || !isSupabaseConfigured) throw new Error(getDictionary().errors.cloudNotConfigured);
  return supabase;
}

function normalizeEmail(email: string) {
  // Invariant, not locale-aware: an address is not German text.
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error(getDictionary().errors.invalidEmail);
  return normalized;
}

function assertSameUser(expectedUserId: string, user: User | null) {
  if (!user || user.id !== expectedUserId) {
    throw new Error(getDictionary().errors.linkingLostId);
  }
  rememberSupabaseUser(user);
  return user;
}

async function currentUser() {
  const client = requireClient();
  const sessionUser = await ensureSupabaseUser();
  if (!sessionUser) return null;
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  const user = data.user ?? sessionUser;
  rememberSupabaseUser(user);
  return user;
}

export async function getAccountLinkState(): Promise<AccountLinkState> {
  if (!supabase || !isSupabaseConfigured) return { status: 'unavailable' };
  if (await isCloudSyncDisabledAfterDeletion()) return { status: 'disabled' };
  return stateFromUser(await currentUser());
}

export async function enableNewCloudAccount(): Promise<AccountLinkState> {
  if (!supabase || !isSupabaseConfigured) return { status: 'unavailable' };
  await enableCloudSyncAfterDeletion();
  const user = await ensureSupabaseUser();
  return stateFromUser(user);
}

export async function requestEmailLink(email: string, displayName: string, language: Language): Promise<AccountLinkState> {
  const client = requireClient();
  const user = await currentUser();
  if (!user) throw new Error(getDictionary().errors.sessionNotLoaded);
  if (!user.is_anonymous) return stateFromUser(user);

  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await client.auth.updateUser({
    email: normalizedEmail,
    data: {
      ...user.user_metadata,
      display_name: displayName.trim(),
      kandro_language: language,
    },
  });
  if (error) throw error;
  const updatedUser = assertSameUser(user.id, data.user);
  return { status: 'pending', userId: updatedUser.id, email: updatedUser.new_email ?? normalizedEmail };
}

export async function resendEmailLink(email: string) {
  const client = requireClient();
  const normalizedEmail = normalizeEmail(email);
  const { error } = await client.auth.resend({ type: 'email_change', email: normalizedEmail });
  if (error) throw error;
}

export async function verifyEmailLink(email: string, token: string): Promise<AccountLinkState> {
  const client = requireClient();
  const user = await currentUser();
  if (!user) throw new Error(getDictionary().errors.sessionNotLoaded);
  const normalizedToken = token.replace(/\s/g, '');
  if (!/^\d{6,8}$/.test(normalizedToken)) throw new Error(getDictionary().account.codeInvalid);

  const { data, error } = await client.auth.verifyOtp({
    email: normalizeEmail(email),
    token: normalizedToken,
    type: 'email_change',
  });
  if (error) throw error;
  return stateFromUser(assertSameUser(user.id, data.user));
}

export async function refreshEmailLink(): Promise<AccountLinkState> {
  const client = requireClient();
  const user = await currentUser();
  if (!user) throw new Error(getDictionary().errors.sessionNotLoaded);
  const { data, error } = await client.auth.refreshSession();
  if (error) throw error;
  return stateFromUser(assertSameUser(user.id, data.user));
}

export async function setAccountPassword(password: string): Promise<AccountLinkState> {
  const client = requireClient();
  const user = await currentUser();
  if (!user || user.is_anonymous || !user.email) throw new Error(getDictionary().errors.confirmEmailFirst);
  if (password.length < 8) throw new Error(getDictionary().account.passwordInvalid);
  const { data, error } = await client.auth.updateUser({ password });
  if (error) throw error;
  return stateFromUser(assertSameUser(user.id, data.user));
}

export async function signInToExistingAccount(email: string, password: string): Promise<AccountLinkState> {
  const client = requireClient();
  if (password.length < 8) throw new Error(getDictionary().account.passwordInvalid);
  const { data, error } = await client.auth.signInWithPassword({ email: normalizeEmail(email), password });
  if (error) throw error;
  if (!data.user || data.user.is_anonymous) throw new Error(getDictionary().errors.permanentAccountNotLoaded);
  rememberSupabaseUser(data.user);
  return stateFromUser(data.user);
}

export function accountLinkErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLocaleLowerCase('en-US');
  if (normalized.includes('manual linking')) return getDictionary().errors.linkingNotEnabled;
  if (normalized.includes('already') || normalized.includes('registered')) return getDictionary().errors.emailAlreadyUsed;
  if (normalized.includes('rate') || normalized.includes('seconds')) return getDictionary().errors.tooManyEmails;
  if (normalized.includes('invalid login')) return getDictionary().errors.wrongCredentials;
  if (normalized.includes('token') || normalized.includes('otp')) return getDictionary().errors.codeExpired;
  return message || getDictionary().errors.linkingFailed;
}
