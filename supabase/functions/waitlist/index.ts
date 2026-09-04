import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

/**
 * Pre-launch waitlist for getkandro.com.
 *
 * Public on purpose — it is called by the website, which has no session — so
 * everything that keeps it from being abused lives in here: a narrow origin allowlist,
 * atomic short-lived per-address/per-network attempt limits, and a reply that never says
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
const MAX_JSON_BODY_BYTES = 4_096;

/** Deliberately strict: a typo that bounces is worse than a rejected sign-up. */
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

function normalizeEmail(value: unknown) {
  const email = String(value ?? '').trim().toLowerCase();
  if (email.length < 6 || email.length > 254 || !EMAIL.test(email)) return null;
  return email;
}

/**
 * Salted fingerprints, never the raw IP address or email address. Rate limiting
 * needs to recognise a repeat caller; it does not need a visitor log.
 */
async function hashFingerprint(kind: 'ip' | 'email', value: string) {
  if (!value || !ipSalt) return null;
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${ipSalt}:${kind}:${value}`),
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashIp(request: Request) {
  const dedicated = request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-real-ip');
  if (dedicated?.trim()) return hashFingerprint('ip', dedicated.trim());
  const chain = (request.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return hashFingerprint('ip', chain.at(-1) ?? '');
}

async function readJsonBody(request: Request): Promise<{ value: unknown; tooLarge: boolean }> {
  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    return { value: null, tooLarge: true };
  }

  const reader = request.body?.getReader();
  if (!reader) return { value: null, tooLarge: false };
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_JSON_BODY_BYTES) {
      await reader.cancel();
      return { value: null, tooLarge: true };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { value: JSON.parse(new TextDecoder().decode(bytes)), tooLarge: false };
  } catch {
    return { value: null, tooLarge: false };
  }
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
    unsubscribe: 'Du möchtest keine weiteren E-Mails von Kandro? Hier kannst du deinen Eintrag vollständig löschen:',
    unsubscribeAction: 'Von der Warteliste abmelden',
  },
  en: {
    subject: 'Confirm your place on the Kandro waiting list',
    lead: 'Almost there. Click the link and we will tell you the moment Kandro is on the App Store.',
    action: 'Confirm sign-up',
    ignore: 'Did not sign up? Ignore this mail — nothing happens without the click.',
    unsubscribe: 'Do not want any more emails from Kandro? You can completely delete your entry here:',
    unsubscribeAction: 'Leave the waiting list',
  },
} as const;

async function sendConfirmation(
  email: string,
  language: 'de' | 'en',
  confirmationToken: string,
  unsubscribeToken: string,
) {
  const text = copy[language];
  const languagePath = language === 'en' ? '/en' : '';
  const confirmationLink = `${SITE}${languagePath}/confirm/?t=${confirmationToken}`;
  const unsubscribeLink = `${SITE}${languagePath}/unsubscribe/?t=${unsubscribeToken}`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: mailFrom,
      to: [email],
      subject: text.subject,
      text: `${text.lead}\n\n${confirmationLink}\n\n${text.ignore}\n\n${text.unsubscribe}\n${unsubscribeLink}`,
      html: `<p>${text.lead}</p><p><a href="${confirmationLink}">${text.action}</a></p><p style="color:#6E7066;font-size:13px">${text.ignore}</p><hr style="border:0;border-top:1px solid #E4E2D9;margin:24px 0"><p style="color:#6E7066;font-size:13px">${text.unsubscribe} <a href="${unsubscribeLink}">${text.unsubscribeAction}</a></p>`,
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
    return json(request, { accepting: Boolean(resendKey && mailFrom && ipSalt) });
  }

  if (route === '/subscribe' && request.method === 'POST') {
    if (!resendKey || !mailFrom || !ipSalt) return json(request, { code: 'not_accepting' }, 503);

    const parsed = await readJsonBody(request);
    if (parsed.tooLarge) return json(request, { code: 'request_too_large' }, 413);
    const body = parsed.value;
    const email = normalizeEmail((body as { email?: unknown } | null)?.email);
    if (!email) return json(request, { code: 'invalid_email' }, 400);
    // Unknown or missing language defaults to English. The website sends an
    // explicit `de` only from the German document, so an integration that
    // forgets the field can never surprise an international reader in German.
    const language = (body as { language?: string } | null)?.language === 'de' ? 'de' : 'en';
    const source = String((body as { source?: unknown } | null)?.source ?? '').slice(0, 40) || null;

    const [ipHash, emailHash] = await Promise.all([
      hashIp(request),
      hashFingerprint('email', email),
    ]);
    if (!ipHash || !emailHash) return json(request, { code: 'unavailable' }, 503);

    // One RPC consumes both limits in a single Postgres transaction. Returning
    // the normal success body when denied prevents this control from becoming
    // an address-enumeration endpoint and does not rotate a valid token.
    const { data: rateDecision, error: rateError } = await db.rpc('consume_waitlist_rate_limit', {
      p_ip_hash: ipHash,
      p_email_hash: emailHash,
    });
    if (rateError || !rateDecision || typeof rateDecision !== 'object') {
      return json(request, { code: 'store_failed' }, 503);
    }
    if ((rateDecision as { allowed?: boolean }).allowed !== true) {
      return json(request, { status: 'check_your_mail' });
    }

    const confirmationToken = makeToken();
    const unsubscribeToken = makeToken();
    const { data: previous, error: lookupError } = await db
      .from('waitlist')
      .select('language,source,token,unsubscribe_token,ip_hash,signed_up_at,confirmed_at')
      .eq('email', email)
      .maybeSingle();
    if (lookupError) return json(request, { code: 'store_failed' }, 500);

    // A confirmed address already has everything needed for the launch mail.
    // Do not let a third party repeatedly send it confirmation messages or
    // invalidate its unsubscribe link.
    if (previous?.confirmed_at) return json(request, { status: 'check_your_mail' });

    // A second sign-up rotates the token and resends rather than creating a
    // duplicate row that nobody can unsubscribe from. An already confirmed
    // address stays confirmed. Keep the old mutable values so a failed send
    // can restore the exact reachable state instead of stranding the row.
    const { error } = await db.from('waitlist').upsert(
      {
        email,
        language,
        source,
        token: confirmationToken,
        unsubscribe_token: unsubscribeToken,
        ip_hash: ipHash,
        signed_up_at: new Date().toISOString(),
      },
      { onConflict: 'email' },
    );
    if (error) return json(request, { code: 'store_failed' }, 500);

    try {
      await sendConfirmation(email, language, confirmationToken, unsubscribeToken);
    } catch {
      // Resend did not accept the message. Restore a pre-existing row, or
      // remove a row created by this attempt. The token predicates make this
      // a compare-and-swap: never overwrite a newer concurrent sign-up.
      const compensation = previous
        ? db.from('waitlist').update({
            language: previous.language,
            source: previous.source,
            token: previous.token,
            unsubscribe_token: previous.unsubscribe_token,
            ip_hash: previous.ip_hash,
            signed_up_at: previous.signed_up_at,
          })
          .eq('email', email)
          .eq('token', confirmationToken)
          .eq('unsubscribe_token', unsubscribeToken)
        : db.from('waitlist').delete()
          .eq('email', email)
          .eq('token', confirmationToken)
          .eq('unsubscribe_token', unsubscribeToken);
      const { error: cleanupError } = await compensation;
      if (cleanupError) return json(request, { code: 'privacy_cleanup_failed' }, 503);
      return json(request, { code: 'send_failed' }, 502);
    }

    // Always the same answer, confirmed or not: whether an address is already
    // on the list is not something a stranger gets to find out.
    return json(request, { status: 'check_your_mail' });
  }

  if (route === '/confirm' && request.method === 'POST') {
    const parsed = await readJsonBody(request);
    if (parsed.tooLarge) return json(request, { code: 'request_too_large' }, 413);
    const body = parsed.value;
    const token = String((body as { token?: unknown } | null)?.token ?? '').trim();
    if (!/^[a-f0-9]{48}$/.test(token)) return json(request, { code: 'invalid_token' }, 400);

    const { data, error } = await db
      .from('waitlist')
      // Rotate the confirmation token after use. The independent unsubscribe
      // token in the same mail stays valid until the row is deleted.
      .update({ confirmed_at: new Date().toISOString(), token: makeToken() })
      .eq('token', token)
      .select('language')
      .maybeSingle();
    if (error) return json(request, { code: 'confirm_failed' }, 500);
    if (!data) return json(request, { code: 'invalid_token' }, 404);
    return json(request, { status: 'confirmed', language: data.language });
  }

  if (route === '/unsubscribe' && request.method === 'POST') {
    const parsed = await readJsonBody(request);
    if (parsed.tooLarge) return json(request, { code: 'request_too_large' }, 413);
    const body = parsed.value;
    const token = String((body as { token?: unknown } | null)?.token ?? '').trim();
    if (!/^[a-f0-9]{48}$/.test(token)) return json(request, { code: 'invalid_token' }, 400);
    const { error } = await db
      .from('waitlist')
      .delete()
      .eq('unsubscribe_token', token);
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
