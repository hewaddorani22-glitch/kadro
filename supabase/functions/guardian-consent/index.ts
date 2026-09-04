import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const SITE = 'https://getkandro.com';
const NOTICE_VERSION = '2026-09-04-guardian-v1';
const MAX_BODY_BYTES = 4_096;
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const rateLimitSalt = Deno.env.get('GUARDIAN_RATE_LIMIT_SALT') ?? '';

const allowedOrigins = new Set([
  SITE,
  'http://127.0.0.1:4173',
  'http://localhost:4173',
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : SITE,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

const json = (request: Request, body: unknown, status = 200) =>
  Response.json(body, { status, headers: corsHeaders(request) });

const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
);

function normalizeEmail(value: unknown) {
  const email = String(value ?? '').trim().toLowerCase();
  return email.length >= 6 && email.length <= 254 && EMAIL.test(email) ? email : null;
}

function token() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hash(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashFingerprint(kind: 'user' | 'ip' | 'email', value: string) {
  if (!value || !rateLimitSalt) return null;
  return hash(`${rateLimitSalt}:${kind}:${value}`);
}

/**
 * Supabase's edge proxy supplies the connection address. Prefer the proxy's
 * dedicated headers; if only a forwarded chain exists, use the last hop rather
 * than the attacker-controlled first entry. Missing provenance fails closed.
 */
function trustedClientIp(request: Request) {
  const dedicated = request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-real-ip');
  if (dedicated?.trim()) return dedicated.trim();
  const chain = (request.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return chain.at(-1) ?? null;
}

async function readJsonBody(request: Request) {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return { body: null, tooLarge: true };
  }

  const reader = request.body?.getReader();
  if (!reader) return { body: null, tooLarge: false };
  const decoder = new TextDecoder();
  let byteLength = 0;
  let raw = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { body: null, tooLarge: true };
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    return { body: JSON.parse(raw) as Record<string, unknown>, tooLarge: false };
  } catch {
    return { body: null, tooLarge: false };
  }
}

async function currentUser(request: Request) {
  const authorization = request.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return null;
  const client = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { auth: { persistSession: false }, global: { headers: { Authorization: authorization } } },
  );
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user;
}

const mail = {
  de: {
    subject: 'Zustimmung zur Nutzung von Kandro bestätigen',
    lead: 'Eine 14- oder 15-jährige Person hat deine E-Mail-Adresse als Elternteil oder sorgeberechtigte Person angegeben, um Kandro nutzen zu können.',
    detail: 'Kandro verarbeitet Körperangaben, Ernährungsziele und bestätigte Mahlzeiten. Bei einer bewusst gestarteten Foto- oder Textanalyse werden die Eingaben über OpenRouter in den USA an Microsoft Azure mit GPT-4.1 mini übermittelt. Originalfotos werden nach der Analyse verworfen. Kandro ist ein allgemeines Wellness-Tool und keine medizinische Beratung.',
    action: 'Informationen prüfen und zustimmen',
    ignore: 'Wenn du diese Anfrage nicht erwartest oder nicht sorgeberechtigt bist, klicke nicht auf den Link. Ohne deine Bestätigung wird die Analyse nicht freigeschaltet.',
  },
  en: {
    subject: 'Confirm permission to use Kandro',
    lead: 'A person aged 14 or 15 entered your email address as their parent or legal guardian so they can use Kandro.',
    detail: 'Kandro processes body details, nutrition targets and confirmed meals. When the user deliberately starts a photo or text analysis, the input is sent through OpenRouter in the United States to Microsoft Azure using GPT-4.1 mini. Original photos are discarded after analysis. Kandro is a general wellness tool, not medical advice.',
    action: 'Review the information and give permission',
    ignore: 'If you did not expect this request or are not the legal guardian, do not click the link. Analysis stays locked without your confirmation.',
  },
} as const;

async function sendGuardianMail(email: string, language: 'de' | 'en', rawToken: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
  const from = Deno.env.get('GUARDIAN_CONSENT_FROM') ?? Deno.env.get('WAITLIST_FROM') ?? '';
  if (!resendKey || !from) throw new Error('mail_not_configured');
  const text = mail[language];
  const link = `${SITE}${language === 'en' ? '/en' : ''}/guardian-consent/?t=${rawToken}`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      subject: text.subject,
      text: `${text.lead}\n\n${text.detail}\n\n${link}\n\n${text.ignore}`,
      html: `<p>${text.lead}</p><p>${text.detail}</p><p><a href="${link}">${text.action}</a></p><p style="color:#6E7066;font-size:13px">${text.ignore}</p>`,
    }),
  });
  if (!response.ok) throw new Error(`resend_${response.status}`);
}

async function requestConsent(request: Request, body: Record<string, unknown>) {
  const user = await currentUser(request);
  if (!user) return json(request, { code: 'unauthorized' }, 401);
  const age = Number(body.age);
  if (!Number.isInteger(age) || age < 14 || age > 15) return json(request, { code: 'age_not_eligible' }, 400);
  const guardianEmail = normalizeEmail(body.guardianEmail);
  if (!guardianEmail) return json(request, { code: 'invalid_email' }, 400);
  const language = body.language === 'de' ? 'de' : 'en';
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
  const from = Deno.env.get('GUARDIAN_CONSENT_FROM') ?? Deno.env.get('WAITLIST_FROM') ?? '';
  const clientIp = trustedClientIp(request);
  if (!resendKey || !from || !rateLimitSalt || !clientIp) {
    return json(request, { code: 'unavailable' }, 503);
  }

  const rawToken = token();
  const tokenHash = await hash(rawToken);
  const [userHash, ipHash, emailHash] = await Promise.all([
    hashFingerprint('user', user.id),
    hashFingerprint('ip', clientIp),
    hashFingerprint('email', guardianEmail),
  ]);
  if (!userHash || !ipHash || !emailHash) return json(request, { code: 'unavailable' }, 503);

  // The RPC atomically checks the current approval, consumes all applicable
  // limits and rotates the token. Parallel requests cannot all send mail.
  const { data: claim, error: claimError } = await admin.rpc('claim_guardian_consent_request', {
    p_user_id: user.id,
    p_age: age,
    p_language: language,
    p_notice_version: NOTICE_VERSION,
    p_token_hash: tokenHash,
    p_user_hash: userHash,
    p_ip_hash: ipHash,
    p_email_hash: emailHash,
  });
  if (claimError) return json(request, { code: 'store_failed' }, 500);
  if (claim?.status === 'approved') return json(request, { status: 'approved' });
  if (claim?.status === 'rate_limited') return json(request, { code: 'too_many' }, 429);
  if (claim?.status !== 'claimed') return json(request, { code: 'store_failed' }, 500);

  try {
    await sendGuardianMail(guardianEmail, language, rawToken);
  } catch {
    // Token compare-and-swap: a slow failing request must never delete a newer
    // successful request for the same user.
    const { error: cleanupError } = await admin
      .from('guardian_consent_requests')
      .delete()
      .eq('user_id', user.id)
      .eq('token_hash', tokenHash);
    return json(request, { code: cleanupError ? 'privacy_cleanup_failed' : 'send_failed' }, cleanupError ? 503 : 502);
  }
  return json(request, { status: 'pending' });
}

async function consentStatus(request: Request) {
  const user = await currentUser(request);
  if (!user) return json(request, { code: 'unauthorized' }, 401);
  const { data: profile, error } = await admin
    .from('profiles')
    .select('age,guardian_consent_at,guardian_consent_version')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return json(request, { code: 'unavailable' }, 503);
  const approved = Boolean(
    profile
    && Number(profile.age) >= 14
    && Number(profile.age) < 16
    && profile.guardian_consent_at
    && profile.guardian_consent_version === NOTICE_VERSION,
  );
  return json(request, { status: approved ? 'approved' : 'pending' });
}

async function confirmConsent(request: Request, body: Record<string, unknown>) {
  const rawToken = String(body.token ?? '').trim();
  if (!/^[a-f0-9]{64}$/.test(rawToken) || body.guardianConfirmed !== true) {
    return json(request, { code: 'invalid_confirmation' }, 400);
  }
  const tokenHash = await hash(rawToken);
  // One database transaction verifies the unexpired request, records the
  // approval in the protected profile and deletes the request. A replay sees
  // no row and a failed delete rolls the profile update back with it.
  const { data: consumed, error } = await admin.rpc('consume_guardian_consent', {
    p_token_hash: tokenHash,
    p_notice_version: NOTICE_VERSION,
  });
  if (error) return json(request, { code: 'confirm_failed' }, 500);
  if (consumed !== true) return json(request, { code: 'invalid_token' }, 404);
  return json(request, { status: 'approved' });
}

async function handle(request: Request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'POST') return json(request, { code: 'method_not_allowed' }, 405);
  const parsed = await readJsonBody(request);
  if (parsed.tooLarge) return json(request, { code: 'payload_too_large' }, 413);
  const body = parsed.body;
  if (!body) return json(request, { code: 'invalid_input' }, 400);
  if (body.action === 'request') return requestConsent(request, body);
  if (body.action === 'status') return consentStatus(request);
  if (body.action === 'confirm') return confirmConsent(request, body);
  return json(request, { code: 'not_found' }, 404);
}

export default {
  fetch(request: Request) {
    return handle(request).catch(() => json(request, { code: 'unavailable' }, 500));
  },
};
