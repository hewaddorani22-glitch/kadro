import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

/**
 * Pre-launch waitlist for getkandro.com.
 *
 * Public on purpose — it is called by the website, which has no session — so
 * everything that keeps it from being abused lives in here: a narrow origin allowlist, a
 * per-address row, a per-network hourly cap, and a reply that never says
 * whether an address is already on the list.
 *
 * Double opt-in, because the launch mail is marketing to a German audience and
 * an address that only typed itself into a form has not agreed to anything you
 * could evidence.
 */

const SITE = 'https://getkandro.com';

// The two loopback origins let the owner test the real form from the local
// preview. Remote websites cannot claim a loopback Origin in a browser.
const ALLOWED_ORIGINS = new Set([
  SITE,
  'http://127.0.0.1:4173',
  'http://localhost:4173',
]);

const corsHeadersFor = (request: Request) => {
  const origin = request.headers.get('Origin') ?? '';
  return {
    // Never '*': this endpoint writes. Unknown origins receive the production
    // origin and therefore fail the browser's CORS check.
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : SITE,
    'Access-Control-Allow-Headers': 'apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  };
};

const json = (request: Request, body: unknown, status = 200) =>
  Response.json(body, { status, headers: corsHeadersFor(request) });

const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
const mailFrom = Deno.env.get('WAITLIST_FROM') ?? '';
const ipSalt = Deno.env.get('WAITLIST_IP_SALT') ?? '';
/** Signups per network per hour. Generous for a household, useless for a script. */
const HOURLY_LIMIT = 3;

/** Deliberately strict: a typo that bounces is worse than a rejected sign-up. */
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

function normalizeEmail(value: unknown) {
  const email = String(value ?? '').trim().toLowerCase();
  if (email.length < 6 || email.length > 254 || !EMAIL.test(email)) return null;
  return email;
}

/**
 * A salted hash, never the address. Rate limiting needs to recognise a repeat
 * caller; it does not need a record of who visited the site from where.
 */
async function hashIp(request: Request) {
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  if (!ip || !ipSalt) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ipSalt}:${ip}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function makeToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

const copy = {
  de: {
    subject: 'Bestätige deinen Platz auf der Kandro-Warteliste',
    lead: 'Fast geschafft. Klick auf den Link, dann sagen wir dir Bescheid, sobald Kandro im App Store ist.',
    action: 'Anmeldung bestätigen',
    ignore: 'Du hast dich nicht angemeldet? Dann ignorier diese Mail einfach – ohne Klick passiert nichts.',
  },
  en: {
    subject: 'Confirm your place on the Kandro waiting list',
    lead: 'Almost there. Click the link and we will tell you the moment Kandro is on the App Store.',
    action: 'Confirm sign-up',
    ignore: 'Did not sign up? Ignore this mail — nothing happens without the click.',
  },
} as const;

async function sendConfirmation(email: string, language: 'de' | 'en', token: string) {
  const text = copy[language];
  const link = `${SITE}${language === 'en' ? '/en' : ''}/confirm/?t=${token}`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: mailFrom,
      to: [email],
      subject: text.subject,
      text: `${text.lead}\n\n${link}\n\n${text.ignore}`,
      html: `<p>${text.lead}</p><p><a href="${link}">${text.action}</a></p><p style="color:#6E7066;font-size:13px">${text.ignore}</p>`,
    }),
  });
  if (!response.ok) throw new Error(`resend_${response.status}`);
}

/**
 * The service role, not the caller's key: the table has no policies, so this is
 * the only thing that can reach it. The website never gets a key that can.
 */
const db = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
);

async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeadersFor(request) });

  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/functions\/v1/, '').replace(/^\/waitlist/, '').replace(/\/+$/, '') || '/';

  // The site asks before drawing the form: with no sender configured there is
  // no way to confirm an address, so collecting one would be collecting
  // something that can never legally be used.
  if (route === '/status') {
    return json(request, { accepting: Boolean(resendKey && mailFrom) });
  }

  if (route === '/subscribe' && request.method === 'POST') {
    if (!resendKey || !mailFrom) return json(request, { code: 'not_accepting' }, 503);

    const body = await request.json().catch(() => null);
    const email = normalizeEmail((body as { email?: unknown } | null)?.email);
    if (!email) return json(request, { code: 'invalid_email' }, 400);
    // Unknown or missing language defaults to English. The website sends an
    // explicit `de` only from the German document, so an integration that
    // forgets the field can never surprise an international reader in German.
    const language = (body as { language?: string } | null)?.language === 'de' ? 'de' : 'en';
    const source = String((body as { source?: unknown } | null)?.source ?? '').slice(0, 40) || null;

    const ipHash = await hashIp(request);
    if (ipHash) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await db
        .from('waitlist')
        .select('id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash)
        .gte('signed_up_at', hourAgo);
      if ((count ?? 0) >= HOURLY_LIMIT) return json(request, { code: 'too_many' }, 429);
    }

    const token = makeToken();
    // A second sign-up rotates the token and resends rather than creating a
    // duplicate row that nobody can unsubscribe from. It also clears an old
    // unsubscribe: asking again is asking again.
    const { error } = await db.from('waitlist').upsert(
      { email, language, source, token, ip_hash: ipHash, signed_up_at: new Date().toISOString(), unsubscribed_at: null },
      { onConflict: 'email' },
    );
    if (error) return json(request, { code: 'store_failed' }, 500);

    try {
      await sendConfirmation(email, language, token);
    } catch {
      return json(request, { code: 'send_failed' }, 502);
    }

    // Always the same answer, confirmed or not: whether an address is already
    // on the list is not something a stranger gets to find out.
    return json(request, { status: 'check_your_mail' });
  }

  if (route === '/confirm' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    const token = String((body as { token?: unknown } | null)?.token ?? '').trim();
    if (!/^[a-f0-9]{48}$/.test(token)) return json(request, { code: 'invalid_token' }, 400);

    const { data, error } = await db
      .from('waitlist')
      .update({ confirmed_at: new Date().toISOString() })
      .eq('token', token)
      .select('language')
      .maybeSingle();
    if (error) return json(request, { code: 'confirm_failed' }, 500);
    if (!data) return json(request, { code: 'invalid_token' }, 404);
    return json(request, { status: 'confirmed', language: data.language });
  }

  if (route === '/unsubscribe' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    const token = String((body as { token?: unknown } | null)?.token ?? '').trim();
    if (!/^[a-f0-9]{48}$/.test(token)) return json(request, { code: 'invalid_token' }, 400);
    const { error } = await db
      .from('waitlist')
      .update({ unsubscribed_at: new Date().toISOString(), confirmed_at: null })
      .eq('token', token);
    if (error) return json(request, { code: 'unsubscribe_failed' }, 500);
    // No 404: telling a stranger which tokens exist is the same leak as
    // telling them which addresses do.
    return json(request, { status: 'unsubscribed' });
  }

  return json(request, { code: 'not_found' }, 404);
}

export default {
  fetch(request: Request) {
    return handle(request).catch(() => json(request, { code: 'unavailable' }, 500));
  },
};
