// Server-only Sign in with Apple token lifecycle. Never import from Expo code.
// JOSE and HTTP are injected so the same code is exercised without external calls.
const ISSUER = 'https://appleid.apple.com';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class AppleTokenError extends Error {
  constructor(code = 'apple_token_storage_unavailable', status = 503, fresh = false) {
    super(code);
    this.code = code;
    this.status = status;
    this.retryWithFreshAppleCredential = fresh;
  }
}

function nonempty(value, max) {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}
function appleSubject(user) {
  if (!user?.id || user.is_anonymous !== false) throw new AppleTokenError('apple_identity_required', 403);
  const subjects = (user.identities ?? []).filter(identity => identity.provider === 'apple').map(identity => {
    const sub = identity.identity_data?.sub ?? identity.id;
    if (!nonempty(sub, 255) || (identity.id && identity.id !== sub)) throw new AppleTokenError('apple_identity_mismatch', 403);
    return sub;
  });
  if (subjects.length !== 1) throw new AppleTokenError('apple_identity_required', 403);
  return subjects[0];
}
function base64(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))); }
function unbase64(value) {
  if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new AppleTokenError();
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
async function hash(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))), b => b.toString(16).padStart(2, '0')).join('');
}
function aad(userId, subject, clientId) { return encoder.encode(JSON.stringify(['kandro-apple-refresh-v1', userId, subject, clientId])); }

export function createAppleTokenLifecycle({ jose, env, fetchImpl = fetch }) {
  // Fixed Apple origin, bounded network wait; a client cannot supply a JWKS URL.
  const appleKeys = jose.createRemoteJWKSet(new URL(`${ISSUER}/auth/keys`), {
    timeoutDuration: 8000, cooldownDuration: 30000,
    [jose.customFetch]: fetchImpl,
  });
  function clientId() {
    const value = env('APPLE_SIGN_IN_CLIENT_ID')?.trim();
    if (value !== 'com.hewaddorani.kandro') throw new AppleTokenError();
    return value;
  }
  async function encryptionKey() {
    const bytes = unbase64(env('APPLE_TOKEN_ENCRYPTION_KEY')?.trim());
    if (bytes.length !== 32) throw new AppleTokenError();
    return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  async function clientSecret(id) {
    const team = env('APPLE_SIGN_IN_TEAM_ID')?.trim();
    const kid = env('APPLE_SIGN_IN_KEY_ID')?.trim();
    const pem = env('APPLE_SIGN_IN_PRIVATE_KEY')?.trim().replace(/\\n/g, '\n');
    if (!/^[A-Z0-9]{10}$/.test(team ?? '') || !/^[A-Z0-9]{10}$/.test(kid ?? '') || !pem) throw new AppleTokenError();
    try {
      const key = await jose.importPKCS8(pem, 'ES256');
      const now = Math.floor(Date.now() / 1000);
      return await new jose.SignJWT({}).setProtectedHeader({ alg: 'ES256', kid }).setIssuer(team).setSubject(id)
        .setAudience(ISSUER).setIssuedAt(now).setExpirationTime(now + 300).sign(key);
    } catch { throw new AppleTokenError(); }
  }
  async function post(path, fields) {
    try {
      const response = await fetchImpl(`${ISSUER}${path}`, {
        method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(fields), signal: AbortSignal.timeout(8000),
      });
      const text = await response.text();
      if (text.length > 32768) throw new AppleTokenError();
      let payload = {};
      if (text) { try { payload = JSON.parse(text); } catch { throw new AppleTokenError(); } }
      return { ok: response.ok, status: response.status, payload };
    } catch { throw new AppleTokenError(); }
  }
  async function decrypt(row, userId) {
    if (row.user_id !== userId || row.client_id !== clientId() || !nonempty(row.apple_subject, 255)) throw new AppleTokenError();
    const iv = unbase64(row.refresh_token_iv);
    if (iv.length !== 12) throw new AppleTokenError();
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aad(userId, row.apple_subject, row.client_id), tagLength: 128 },
      await encryptionKey(), unbase64(row.refresh_token_ciphertext));
    const token = decoder.decode(plaintext);
    if (!nonempty(token, 8192)) throw new AppleTokenError();
    return token;
  }
  async function storeAuthorization(user, body, store) {
    const subject = appleSubject(user);
    if (!body || !nonempty(body.authorizationCode, 4096) || !/^[\x21-\x7e]+$/.test(body.authorizationCode)
      || !nonempty(body.nonce, 128) || body.nonce.length < 16 || !/^[A-Za-z0-9._-]+$/.test(body.nonce)) {
      throw new AppleTokenError('invalid_request', 400);
    }
    const id = clientId();
    const key = await encryptionKey();
    const codeHash = await hash(body.authorizationCode);
    let previous;
    try { previous = await store.read(user.id); } catch { throw new AppleTokenError(); }
    if (previous?.authorization_code_hash === codeHash && previous.apple_subject === subject) {
      // A retry after a lost success response must not reuse the one-time code.
      try { await decrypt(previous, user.id); return { stored: true }; } catch { /* obtain a fresh verified token below */ }
    }
    const secret = await clientSecret(id); // Validate configuration before consuming the code.
    let allowed;
    try { allowed = await store.claim(user.id); } catch { throw new AppleTokenError(); }
    if (!allowed) throw new AppleTokenError('apple_token_rate_limited', 429);
    const response = await post('/auth/token', { client_id: id, client_secret: secret, code: body.authorizationCode, grant_type: 'authorization_code' });
    if (!response.ok) {
      if (response.status === 400 && response.payload?.error === 'invalid_grant') throw new AppleTokenError('apple_authorization_invalid', 400, true);
      throw new AppleTokenError();
    }
    const payload = response.payload;
    if (!nonempty(payload?.id_token, 16384) || !nonempty(payload?.refresh_token, 8192)
      || !nonempty(payload?.access_token, 8192) || payload?.token_type?.toLowerCase() !== 'bearer'
      || !Number.isFinite(payload?.expires_in) || payload.expires_in <= 0) {
      throw new AppleTokenError('apple_authorization_invalid', 400, true);
    }
    let claims;
    try {
      ({ payload: claims } = await jose.jwtVerify(payload.id_token, appleKeys, {
        algorithms: ['RS256'], issuer: ISSUER, audience: id, maxTokenAge: 600,
        requiredClaims: ['iss', 'aud', 'sub', 'iat', 'exp', 'nonce'], clockTolerance: 5,
      }));
    } catch { throw new AppleTokenError('apple_authorization_invalid', 400, true); }
    if (claims.sub !== subject || claims.aud !== id) throw new AppleTokenError('apple_identity_mismatch', 403);
    if (claims.nonce !== await hash(body.nonce)) throw new AppleTokenError('apple_authorization_invalid', 400, true);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    try {
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(user.id, subject, id), tagLength: 128 }, key, encoder.encode(payload.refresh_token));
      await store.save({ user_id: user.id, apple_subject: subject, client_id: id,
        refresh_token_ciphertext: base64(ciphertext), refresh_token_iv: base64(iv), authorization_code_hash: codeHash,
        updated_at: new Date().toISOString() });
    } catch { throw new AppleTokenError('apple_token_storage_unavailable', 503, true); }
    return { stored: true };
  }
  async function revokeForDeletion(user, store) {
    const hasApple = (user.identities ?? []).some(identity => identity.provider === 'apple');
    let row;
    try { row = await store.read(user.id); } catch { throw new AppleTokenError(); }
    if (!row?.refresh_token_ciphertext) return hasApple ? 'manual_required' : 'not_applicable';
    let token;
    try { token = await decrypt(row, user.id); } catch {
      // TN3194: a missing/unusable token must not make data deletion impossible.
      return 'manual_required';
    }
    const id = clientId();
    const response = await post('/auth/revoke', { client_id: id, client_secret: await clientSecret(id), token, token_type_hint: 'refresh_token' });
    // Apple also returns 200 for previously invalidated tokens: retries are safe.
    if (response.status === 200) return 'revoked';
    if (response.status === 400 && ['invalid_grant', 'invalid_token'].includes(response.payload?.error)) return 'manual_required';
    // Preserve the token/account on network or client-configuration failure.
    throw new AppleTokenError();
  }
  return { storeAuthorization, revokeForDeletion };
}
