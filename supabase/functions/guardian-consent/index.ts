import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const SITE = 'https://getkandro.com';
const NOTICE_VERSION = '2026-09-04-guardian-v1';
const TOKEN_HOURS = 48;
const RESEND_COOLDOWN_MS = 60_000;
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

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

  const { data: profile } = await admin
    .from('profiles')
    .select('guardian_consent_at,guardian_consent_version')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profile?.guardian_consent_at && profile.guardian_consent_version === NOTICE_VERSION) {
    return json(request, { status: 'approved' });
  }

  const { data: previous } = await admin
    .from('guardian_consent_requests')
    .select('requested_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (previous && Date.now() - new Date(previous.requested_at).getTime() < RESEND_COOLDOWN_MS) {
    return json(request, { code: 'too_many' }, 429);
  }

  const rawToken = token();
  const tokenHash = await hash(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_HOURS * 60 * 60 * 1000).toISOString();

  const { error: profileError } = await admin.from('profiles').upsert({
    user_id: user.id,
    age,
    guardian_consent_at: null,
    guardian_consent_version: null,
    privacy_version: null,
    wellness_consent_at: null,
    updated_at: now.toISOString(),
  }, { onConflict: 'user_id' });
  if (profileError) return json(request, { code: 'store_failed' }, 500);

  const { error: requestError } = await admin.from('guardian_consent_requests').upsert({
    user_id: user.id,
    guardian_email: guardianEmail,
    language,
    notice_version: NOTICE_VERSION,
    token_hash: tokenHash,
    requested_at: now.toISOString(),
    expires_at: expiresAt,
    confirmed_at: null,
    updated_at: now.toISOString(),
  }, { onConflict: 'user_id' });
  if (requestError) return json(request, { code: 'store_failed' }, 500);

  try {
    await sendGuardianMail(guardianEmail, language, rawToken);
    // The address has served its only purpose. Keep the request/timestamp as
    // evidence, but do not turn the database into a list of guardian emails.
    await admin.from('guardian_consent_requests').update({ guardian_email: null }).eq('user_id', user.id);
  } catch {
    await admin.from('guardian_consent_requests').delete().eq('user_id', user.id);
    return json(request, { code: 'send_failed' }, 502);
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
  const { data: pending, error } = await admin
    .from('guardian_consent_requests')
    .select('user_id,notice_version,expires_at,confirmed_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (error || !pending || pending.notice_version !== NOTICE_VERSION || new Date(pending.expires_at).getTime() < Date.now()) {
    return json(request, { code: 'invalid_token' }, 404);
  }
  if (!pending.confirmed_at) {
    const confirmedAt = new Date().toISOString();
    const { data: approvedProfile, error: profileError } = await admin.from('profiles').update({
      guardian_consent_at: confirmedAt,
      guardian_consent_version: NOTICE_VERSION,
      updated_at: confirmedAt,
    }).eq('user_id', pending.user_id).gte('age', 14).lt('age', 16).select('user_id').maybeSingle();
    if (profileError || !approvedProfile) return json(request, { code: 'confirm_failed' }, 409);
    const { error: requestError } = await admin.from('guardian_consent_requests').update({
      confirmed_at: confirmedAt,
      updated_at: confirmedAt,
    }).eq('user_id', pending.user_id);
    if (requestError) return json(request, { code: 'confirm_failed' }, 500);
  }
  return json(request, { status: 'approved' });
}

async function handle(request: Request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'POST') return json(request, { code: 'method_not_allowed' }, 405);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
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
