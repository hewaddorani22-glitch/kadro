import * as jose from 'npm:jose@6.2.10';
import { AppleTokenError, createAppleTokenLifecycle } from './apple-token-lifecycle.mjs';

const lifecycle = createAppleTokenLifecycle({ jose, env: (name: string) => Deno.env.get(name) });

// Service-role-only table. Callers are authenticated separately with getUser().
function tokenStore(admin: any) {
  return {
    async read(userId: string) {
      const { data, error } = await admin.from('apple_account_tokens')
        .select('user_id,apple_subject,client_id,refresh_token_ciphertext,refresh_token_iv,authorization_code_hash')
        .eq('user_id', userId).maybeSingle();
      if (error) throw new AppleTokenError();
      return data;
    },
    async claim(userId: string) {
      const { data, error } = await admin.rpc('claim_apple_token_exchange', { p_user_id: userId });
      if (error) throw new AppleTokenError();
      return data === true;
    },
    async save(row: Record<string, unknown>) {
      const { user_id, ...fields } = row;
      // The rate-limit claim has already created the row. Update only token
      // fields so PostgREST upsert defaults cannot reset the attempt counter.
      const { data, error } = await admin.from('apple_account_tokens').update(fields).eq('user_id', user_id).select('user_id').single();
      if (error || !data) throw new AppleTokenError();
    },
  };
}

export async function storeAppleAuthorization(admin: any, user: any, body: unknown) {
  return lifecycle.storeAuthorization(user, body, tokenStore(admin));
}
export async function revokeAppleForDeletion(admin: any, user: any) {
  return lifecycle.revokeForDeletion(user, tokenStore(admin));
}
export function appleTokenErrorResponse(error: unknown) {
  if (error instanceof AppleTokenError) {
    return { status: error.status, body: { code: error.code,
      ...(error.retryWithFreshAppleCredential ? { retryWithFreshAppleCredential: true } : {}) } };
  }
  // Never return provider payloads, code, JWT, key material, or stack traces.
  return { status: 503, body: { code: 'apple_token_storage_unavailable' } };
}
