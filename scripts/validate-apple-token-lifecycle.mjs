// Actual JOSE/WebCrypto with generated, in-memory test keys; no external traffic.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as jose from 'jose';
import { createAppleTokenLifecycle } from '../supabase/functions/_shared/apple-token-lifecycle.mjs';
globalThis.fetch = async () => { throw Error('EXTERNAL_HTTP_FORBIDDEN'); };
const user = { id: '10000000-0000-4000-8000-000000000001', is_anonymous: false, identities: [{ provider: 'apple', id: 'apple-test-subject', identity_data: { sub: 'apple-test-subject' } }] };
const nonce = 'synthetic-raw-nonce-for-local-tests';
const body = { authorizationCode: 'synthetic-authorization-code', nonce };
const appleKeys = await jose.generateKeyPair('RS256');
const clientKeys = await jose.generateKeyPair('ES256', { extractable: true });
const jwk = { ...await jose.exportJWK(appleKeys.publicKey), alg: 'RS256', use: 'sig', kid: 'apple-test-key' };
const env = {
 APPLE_SIGN_IN_PRIVATE_KEY: await jose.exportPKCS8(clientKeys.privateKey), APPLE_SIGN_IN_KEY_ID: 'TESTKEY123',
 APPLE_SIGN_IN_TEAM_ID: 'TESTTEAM12', APPLE_SIGN_IN_CLIENT_ID: 'com.hewaddorani.kandro',
 APPLE_TOKEN_ENCRYPTION_KEY: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'),
};
const hashNonce = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce))).toString('hex');
async function idToken(changes = {}, key = appleKeys.privateKey, header = {}) {
 return new jose.SignJWT({ sub: 'apple-test-subject', nonce: hashNonce, ...changes }).setProtectedHeader({ alg: 'RS256', kid: 'apple-test-key', ...header })
 .setIssuer(changes.iss ?? 'https://appleid.apple.com').setAudience(changes.aud ?? 'com.hewaddorani.kandro')
 .setIssuedAt().setExpirationTime(changes.exp ?? '5m').sign(key);
}
function fixture(overrides = {}) {
 const f = { row: null, calls: [], saves: [], claims: 0, allowClaim: true, tokenBody: null, revokeStatus: 200, revokeError: '', ...overrides };
 f.store = {
  async read(id) { assert.equal(id, user.id); if (f.readError) throw Error('db failed'); return f.row; },
  async claim(id) { assert.equal(id, user.id); f.claims++; return f.allowClaim; },
  async save(row) { if (f.saveError) throw Error('db failed'); f.saves.push(row); f.row = structuredClone(row); },
 };
 f.service = createAppleTokenLifecycle({ jose, env: name => (f.env ?? env)[name], fetchImpl: async (url, init) => {
  const target = String(url); f.calls.push(target);
  if (target === 'https://appleid.apple.com/auth/keys') return Response.json({ keys: [jwk] });
  assert.equal(init.method, 'POST'); assert.equal(init.redirect, 'error');
  const form = new URLSearchParams(init.body);
  const verified = await jose.jwtVerify(form.get('client_secret'), clientKeys.publicKey, { algorithms: ['ES256'], issuer: env.APPLE_SIGN_IN_TEAM_ID, audience: 'https://appleid.apple.com', subject: env.APPLE_SIGN_IN_CLIENT_ID });
  assert.equal(verified.protectedHeader.kid, env.APPLE_SIGN_IN_KEY_ID);
  assert.ok(verified.payload.exp - verified.payload.iat <= 300);
  assert.equal(form.get('client_id'), env.APPLE_SIGN_IN_CLIENT_ID);
  if (target === 'https://appleid.apple.com/auth/token') {
   assert.equal(form.get('code'), body.authorizationCode); assert.equal(form.get('grant_type'), 'authorization_code');
   if (f.tokenStatus) return Response.json({ error: f.tokenError }, { status: f.tokenStatus });
   return Response.json(f.tokenBody ?? { id_token: await idToken(), refresh_token: 'synthetic-private-refresh-token', access_token: 'synthetic-access-token', token_type: 'Bearer', expires_in: 3600 });
  }
  assert.equal(target, 'https://appleid.apple.com/auth/revoke');
  assert.equal(form.get('token'), 'synthetic-private-refresh-token'); assert.equal(form.get('token_type_hint'), 'refresh_token');
  return new Response(f.revokeStatus === 200 ? '' : JSON.stringify({ error: f.revokeError }), { status: f.revokeStatus });
 } });
 return f;
}
let count = 0;
async function test(name, run) { await run(); count++; console.log('PASS', name); }
await test('Native code is verified and stored encrypted; replay is idempotent and no credential is returned', async () => {
 const f = fixture(); assert.deepEqual(await f.service.storeAuthorization(user, body, f.store), { stored: true });
 assert.equal(f.saves.length, 1); assert.equal(f.claims, 1);
 const serialized = JSON.stringify(f.row); assert.ok(!serialized.includes('synthetic-private-refresh-token')); assert.ok(!serialized.includes(body.authorizationCode)); assert.ok(!serialized.includes(nonce));
 assert.equal(f.row.user_id, user.id); assert.equal(f.row.apple_subject, 'apple-test-subject');
 const calls = f.calls.length; assert.deepEqual(await f.service.storeAuthorization(user, body, f.store), { stored: true }); assert.equal(f.calls.length, calls);
 assert.equal(await f.service.revokeForDeletion(user, f.store), 'revoked'); assert.ok(f.calls.at(-1).endsWith('/revoke'));
});
await test('JWT signature, issuer, audience, expiry, subject and nonce are checked before saving', async () => {
 const wrongKeys = await jose.generateKeyPair('RS256');
 for (const [changes, key] of [[{ iss: 'https://attacker.invalid' }], [{ aud: 'other.app' }], [{ exp: 1 }], [{ sub: 'other-person' }], [{ nonce: 'wrong-nonce' }], [{}, wrongKeys.privateKey]]) {
  const f = fixture({ tokenBody: { id_token: await idToken(changes, key), refresh_token: 'synthetic-private-refresh-token', access_token: 'synthetic-access-token', token_type: 'Bearer', expires_in: 3600 } });
  await assert.rejects(f.service.storeAuthorization(user, body, f.store)); assert.equal(f.saves.length, 0);
 }
});
await test('Anonymous, forged metadata, ambiguous identities, missing nonce and oversized code cause no external call', async () => {
 for (const [u, b] of [[{ ...user, is_anonymous: true }, body], [{ ...user, identities: [], user_metadata: { sub: 'apple-test-subject', provider: 'apple' } }, body], [{ ...user, identities: [...user.identities, { provider: 'apple', id: 'other' }] }, body], [user, { authorizationCode: body.authorizationCode }], [user, { ...body, authorizationCode: 'x'.repeat(5000) }]]) {
  const f = fixture(); await assert.rejects(f.service.storeAuthorization(u, b, f.store)); assert.equal(f.calls.length, 0);
 }
});
await test('Server configuration and rate limit fail before the one-time code is consumed', async () => {
 for (const extra of [{ env: { ...env, APPLE_TOKEN_ENCRYPTION_KEY: 'not-a-key' } }, { env: { ...env, APPLE_SIGN_IN_PRIVATE_KEY: '' } }, { allowClaim: false }]) {
  const f = fixture(extra); await assert.rejects(f.service.storeAuthorization(user, body, f.store)); assert.equal(f.calls.length, 0);
 }
});
await test('Missing/invalid Apple tokens cannot produce a stored success; storage failure requests a fresh credential', async () => {
 for (const tokenBody of [{ id_token: await idToken() }, { id_token: await idToken(), refresh_token: '', token_type: 'Bearer' }, { id_token: 'not-a-jwt', refresh_token: 'synthetic-private-refresh-token', token_type: 'Bearer' }]) {
  const f = fixture({ tokenBody }); await assert.rejects(f.service.storeAuthorization(user, body, f.store)); assert.equal(f.saves.length, 0);
 }
 const failed = fixture({ saveError: true }); await assert.rejects(failed.service.storeAuthorization(user, body, failed.store), e => e.code === 'apple_token_storage_unavailable' && e.retryWithFreshAppleCredential === true);
 const consumed = fixture({ tokenStatus: 400, tokenError: 'invalid_grant' }); await assert.rejects(consumed.service.storeAuthorization(user, body, consumed.store), e => e.code === 'apple_authorization_invalid' && e.retryWithFreshAppleCredential === true);
});
await test('AES-GCM binds the ciphertext to account, Apple identity and client; tampering never revokes another token', async () => {
 const original = fixture(); await original.service.storeAuthorization(user, body, original.store);
 for (const change of [{ apple_subject: 'other-person' }, { client_id: 'other.app' }, { refresh_token_ciphertext: 'AAAA' }, { refresh_token_iv: Buffer.alloc(12).toString('base64') }]) {
  const f = fixture({ row: { ...original.row, ...change } });
  assert.equal(await f.service.revokeForDeletion(user, f.store), 'manual_required'); assert.equal(f.calls.length, 0);
 }
 const wrongKey = fixture({ row: original.row, env: { ...env, APPLE_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 2).toString('base64') } });
 assert.equal(await wrongKey.service.revokeForDeletion(user, wrongKey.store), 'manual_required'); assert.equal(wrongKey.calls.length, 0);
});
await test('Missing/unusable tokens report manual help; transient Apple failure preserves deletion retry', async () => {
 const missing = fixture(); assert.equal(await missing.service.revokeForDeletion(user, missing.store), 'manual_required');
 assert.equal(await missing.service.revokeForDeletion({ ...user, identities: [] }, missing.store), 'not_applicable');
 for (const [status, error, result] of [[400, 'invalid_grant', 'manual_required'], [400, 'invalid_token', 'manual_required'], [503, 'server_error', null], [400, 'invalid_client', null]]) {
  const f = fixture({ revokeStatus: status, revokeError: error }); await f.service.storeAuthorization(user, body, f.store);
  if (result) assert.equal(await f.service.revokeForDeletion(user, f.store), result);
  else await assert.rejects(f.service.revokeForDeletion(user, f.store), e => e.code === 'apple_token_storage_unavailable');
 }
});
// Compile actual handlers with controlled SDK boundary, not a duplicate handler.
function handler(file, context, lifecycle, envGetter = () => 'synthetic') {
 const src = fs.readFileSync(file, 'utf8');
 const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
 const module = { exports: {} };
 const imports = { 'npm:@supabase/server@1.5.1': { withSupabase: (_options, fn) => request => fn(request, context) }, '../_shared/apple-token-service.ts': lifecycle };
 new Function('require', 'exports', 'module', 'Deno', js)(id => { assert.ok(id in imports, id); return imports[id]; }, module.exports, module, { env: { get: envGetter } });
 return module.exports.default;
}
await test('Actual token endpoint enforces method, verified identity, payload bound and safe error response', async () => {
 let calls = 0; let currentUser = user;
 const context = { supabase: { auth: { getUser: async () => ({ data: { user: currentUser }, error: null }) } }, supabaseAdmin: {} };
 const app = handler('supabase/functions/apple-account-token/index.ts', context, { storeAppleAuthorization: async (_admin, u, b) => { calls++; assert.equal(u.id, user.id); assert.deepEqual(b, body); return { stored: true }; }, appleTokenErrorResponse: e => ({ status: e.status ?? 503, body: { code: e.code ?? 'apple_token_storage_unavailable' } }) });
 assert.equal((await app.fetch(new Request('http://localhost', { method: 'GET' }))).status, 405);
 currentUser = null; assert.equal((await app.fetch(new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) }))).status, 401); assert.equal(calls, 0);
 currentUser = user; const ok = await app.fetch(new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) })); assert.equal(ok.status, 200); assert.deepEqual(await ok.json(), { stored: true });
 const tooLarge = await app.fetch(new Request('http://localhost', { method: 'POST', body: 'x'.repeat(9000) })); assert.equal(tooLarge.status, 400); assert.equal(calls, 1);
});
await test('Actual delete endpoint revokes before existing erasures, returns fallback honestly and preserves RC errors', async () => {
 const originalFetch = globalThis.fetch;
 try {
  for (const status of ['revoked', 'manual_required', 'not_applicable', 'temporary']) {
   const order = []; const context = { supabase: { auth: { getUser: async () => ({ data: { user }, error: null }) } }, supabaseAdmin: { auth: { admin: { deleteUser: async id => { assert.equal(id, user.id); order.push('supabase'); return { error: null }; } } } } };
   globalThis.fetch = async url => { assert.ok(String(url).startsWith('https://api.revenuecat.com/v2/projects/')); order.push('revenuecat'); return Response.json({ items: [] }); };
   const app = handler('supabase/functions/delete-account/index.ts', context, { revokeAppleForDeletion: async () => { order.push('apple'); if (status === 'temporary') throw Error('internal-secret-must-not-leak'); return status; } });
   const res = await app.fetch(new Request('http://localhost', { method: 'DELETE' }));
   if (status === 'temporary') { assert.equal(res.status, 503); assert.deepEqual(order, ['apple']); assert.ok(!(await res.text()).includes('internal-secret')); }
   else { assert.equal(res.status, 200); assert.deepEqual(await res.json(), { deleted: true, appleRevocation: status }); assert.deepEqual(order, ['apple', 'revenuecat', 'supabase']); }
  }
  const order = []; globalThis.fetch = async () => new Response('', { status: 503 });
  const context = { supabase: { auth: { getUser: async () => ({ data: { user }, error: null }) } }, supabaseAdmin: { auth: { admin: { deleteUser: async () => { order.push('deleted'); return { error: null }; } } } } };
  const app = handler('supabase/functions/delete-account/index.ts', context, { revokeAppleForDeletion: async () => 'revoked' });
  assert.equal((await app.fetch(new Request('http://localhost', { method: 'DELETE' }))).status, 503); assert.deepEqual(order, []);
 } finally { globalThis.fetch = originalFetch; }
});
await test('Actual service adapter scopes all DB operations and preserves counters; safe errors expose no payloads', async () => {
 const source = fs.readFileSync('supabase/functions/_shared/apple-token-service.ts', 'utf8');
 const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
 const module = { exports: {} }; const calls = []; let missingWrite = false;
 const admin = {
  from(table) { assert.equal(table, 'apple_account_tokens'); return {
   select(columns) { assert.ok(!columns.includes('*')); return { eq(column, id) { assert.equal(column, 'user_id'); assert.equal(id, user.id); return { maybeSingle: async () => ({ data: null, error: null }) }; } }; },
   update(fields) { assert.ok(!('user_id' in fields)); assert.ok(!('exchange_attempts' in fields)); calls.push('update'); return { eq(column, id) { assert.equal(column, 'user_id'); assert.equal(id, user.id); return { select: () => ({ single: async () => ({ data: missingWrite ? null : { user_id: id }, error: null }) }) }; } }; },
  }; },
  async rpc(name, args) { assert.equal(name, 'claim_apple_token_exchange'); assert.deepEqual(args, { p_user_id: user.id }); return { data: true, error: null }; },
 };
 class SafeError extends Error { constructor() { super('apple_token_storage_unavailable'); this.code='apple_token_storage_unavailable'; this.status=503; } }
 const imports = { 'npm:jose@6.2.10': jose, './apple-token-lifecycle.mjs': { AppleTokenError: SafeError, createAppleTokenLifecycle(options) {
  assert.equal(options.env('SAFE_TEST_NAME'), 'synthetic-env');
  return { async storeAuthorization(u, b, store) { assert.equal(u,user); assert.equal(b,body); assert.equal(await store.read(u.id),null); assert.equal(await store.claim(u.id),true); await store.save({user_id:u.id,apple_subject:'synthetic'}); return {stored:true}; }, async revokeForDeletion(u,store){ await store.read(u.id); return 'manual_required'; } };
 } } };
 new Function('require','exports','module','Deno',js)(id => { assert.ok(id in imports,id); return imports[id]; },module.exports,module,{env:{get:()=> 'synthetic-env'}});
 assert.deepEqual(await module.exports.storeAppleAuthorization(admin,user,body),{stored:true}); assert.deepEqual(calls,['update']);
 missingWrite=true; await assert.rejects(module.exports.storeAppleAuthorization(admin,user,body));
 assert.equal(await module.exports.revokeAppleForDeletion(admin,user),'manual_required');
 assert.deepEqual(module.exports.appleTokenErrorResponse(new Error('sensitive synthetic payload')), {status:503,body:{code:'apple_token_storage_unavailable'}});
});
console.log(`Apple token lifecycle: ${count} groups passed; generated local keys and mocked HTTP only.`);
