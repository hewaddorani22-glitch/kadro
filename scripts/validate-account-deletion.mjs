import assert from 'node:assert/strict';

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!url || !key) throw new Error('Supabase public client configuration is missing.');

const client = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: signIn, error: signInError } = await client.auth.signInAnonymously();
if (signInError || !signIn.user) throw signInError ?? new Error('Temporary anonymous user was not created.');

const userId = signIn.user.id;
const profileWrite = await client.from('profiles').insert({ user_id: userId, display_name: 'Deletion smoke test' });
if (profileWrite.error) throw profileWrite.error;

const { error: invokeError } = await client.functions.invoke('delete-account', { method: 'DELETE' });
if (invokeError) throw invokeError;

const profileRead = await client.from('profiles').select('user_id').eq('user_id', userId);
if (profileRead.error) throw profileRead.error;
assert.deepEqual(profileRead.data, [], 'Profile row must cascade-delete with the auth user.');

const userRead = await client.auth.getUser();
assert.ok(userRead.error || !userRead.data.user, 'Deleted auth user must no longer be returned by Auth.');

const refresh = await client.auth.refreshSession();
assert.ok(refresh.error || !refresh.data.session, 'Deleted user must not be able to mint a new access token.');

console.log('Validated live Supabase account deletion, profile cascade, and refresh-token revocation.');
