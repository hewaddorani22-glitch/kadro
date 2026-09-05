#!/usr/bin/env node
/**
 * The waitlist is the one endpoint on this project that anybody on the
 * internet can call, and the one table that is a ready-made mailing list. Two
 * different ways to get badly hurt, so both are pinned down here.
 *
 * The legal half matters as much as the technical one: a launch mail to a
 * German audience is marketing, and an address that only typed itself into a
 * form has consented to nothing anyone could evidence.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const fn = read('supabase/functions/waitlist/index.ts');
const migration = read('supabase/migrations/20260903210000_add_waitlist.sql');
const retention = read('supabase/migrations/20260904184701_add_waitlist_retention.sql');
const config = read('supabase/config.toml');
const runbook = read('site/README.md');
const problems = [];

// --- Nothing but the function may reach the table --------------------------
assert.match(migration, /alter table public\.waitlist enable row level security;/,
  'row level security is off, so the anon key can read the list');
assert.match(migration, /revoke all on public\.waitlist from anon, authenticated;/,
  'the published anon key still has table privileges');
assert.ok(!/create policy/i.test(migration),
  'a policy on this table is a policy the website\'s published key can use');
assert.match(fn, /SUPABASE_SERVICE_ROLE_KEY/, 'the function cannot reach its own table');

// --- Public, and therefore defended in code --------------------------------
assert.match(config, /\[functions\.waitlist\]\s*\nverify_jwt = false/,
  'the website has no session, so the platform cannot check one');
assert.match(fn, /const ALLOWED_ORIGINS = new Set\(\[\s*SITE,/,
  'the write endpoint has no explicit origin allowlist');
assert.match(fn, /'http:\/\/127\.0\.0\.1:4173'/,
  'the real form cannot be tested from the local preview');
assert.match(fn, /ALLOWED_ORIGINS\.has\(origin\) \? origin : SITE/,
  'unknown origins are reflected instead of being rejected by CORS');
assert.ok(!/Access-Control-Allow-Origin': '\*'/.test(fn), 'the origin is wide open');
assert.match(retention, /create table if not exists private\.waitlist_rate_limits/,
  'there is no dedicated attempt ledger, so repeated addresses evade a row count');
assert.match(retention, /primary key \(kind, key_hash\)/,
  'concurrent attempts do not contend on one rate-limit record');
assert.match(retention, /create or replace function private\.consume_waitlist_rate_limit/,
  'the IP and email limits are not consumed atomically');
assert.match(retention, /on conflict \(kind, key_hash\) do update[\s\S]*attempt_count/,
  'rate-limit increments race through separate count and write operations');
assert.match(retention, /interval '10 minutes'[\s\S]*interval '1 hour'/,
  'per-email cooldown or per-network hourly window is missing');
assert.match(retention, /email_attempts = 1 and ip_attempts <= 3/,
  'the database does not enforce both abuse limits');
assert.match(retention, /grant execute on function private\.consume_waitlist_rate_limit\(text, text, timestamptz\)[\s\S]*to service_role/,
  'the invoker wrapper cannot reach the private waitlist limiter as service_role');
assert.match(retention, /grant execute on function public\.consume_waitlist_rate_limit\(text, text\) to service_role/,
  'the edge function cannot consume the private abuse limit');
assert.match(fn, /db\.rpc\('consume_waitlist_rate_limit'/,
  'the public endpoint never consumes the atomic abuse limit');
assert.match(fn, /rateDecision as \{ allowed\?: boolean \}\)\.allowed !== true[\s\S]*status: 'check_your_mail'/,
  'a denied attempt either sends mail or exposes a distinct rate-limit response');
assert.ok(!/\.from\('waitlist'\)[\s\S]{0,200}count: 'exact'/.test(fn),
  'a waitlist row count is still treated as an attempt count');
assert.match(fn, /Boolean\(resendKey && mailFrom && ipSalt\)/,
  'the form opens without the secret required for abuse-resistant hashing');
assert.match(fn, /MAX_JSON_BODY_BYTES = 4_096/,
  'the unauthenticated endpoint accepts unbounded request bodies');
assert.match(fn, /length > MAX_JSON_BODY_BYTES[\s\S]*reader\.cancel/,
  'chunked bodies can bypass the declared content-length limit');

// --- Double opt-in ---------------------------------------------------------
assert.match(migration, /confirmed_at timestamptz/,
  'without a confirmation timestamp the consent cannot be evidenced');
assert.match(fn, /sendConfirmation\(email, language, confirmationToken, unsubscribeToken\)/,
  'the address is stored without a confirmation ever being sent');
// A sign-up must never be usable before the click.
assert.ok(!/confirmed_at: new Date\(\)\.toISOString\(\)[\s\S]{0,400}upsert/.test(fn),
  'a sign-up confirms itself, which is single opt-in wearing a costume');
assert.match(fn, /if \(!resendKey \|\| !mailFrom \|\| !ipSalt\) return json\(request, \{ code: 'not_accepting' \}, 503\)/,
  'addresses are collected even when no confirmation can be sent');

// --- Unsubscribe is an actual deletion, not a preference flag -------------
assert.match(retention, /add column if not exists unsubscribe_token text/,
  'confirmation and unsubscribe still share one token');
assert.match(retention, /delete from public\.waitlist\s*\nwhere unsubscribed_at is not null/,
  'rows retained by the previous unsubscribe implementation survive the migration');
assert.match(retention, /create unique index if not exists waitlist_unsubscribe_token_idx/,
  'unsubscribe tokens are not unique');
assert.match(fn, /sendConfirmation\(email, language, confirmationToken, unsubscribeToken\)/,
  'the mail sender never receives an unsubscribe token');
assert.match(fn, /\/unsubscribe\/\?t=\$\{unsubscribeToken\}/,
  'the confirmation mail has no language-specific unsubscribe link');
assert.match(fn, /text: `\$\{text\.lead\}[\s\S]*\$\{unsubscribeLink\}`/,
  'the plain-text email omits the unsubscribe link');
assert.match(fn, /html: `<p>\$\{text\.lead\}[\s\S]*\$\{unsubscribeLink\}/,
  'the HTML email omits the unsubscribe link');
assert.match(fn, /\.delete\(\)\s*\n\s*\.eq\('unsubscribe_token', token\)/,
  'unsubscribe leaves the email or other waitlist data behind');
assert.match(fn, /return json\(request, \{ status: 'unsubscribed' \}\)/,
  'valid-looking unknown tokens do not receive the same answer as known tokens');
assert.match(fn, /token: makeToken\(\)/,
  'a confirmation token can be reused after confirmation');
assert.ok(!/confirmed_at: null/.test(fn),
  'a repeat sign-up silently revokes an already confirmed waitlist consent');
assert.match(fn, /select\('language,source,token,unsubscribe_token,ip_hash,signed_up_at,confirmed_at'\)/,
  'the previous reachable token state is not captured before a resend');
assert.match(fn, /if \(previous\?\.confirmed_at\) return json\(request, \{ status: 'check_your_mail' \}\)/,
  'a confirmed address can be spammed and have its unsubscribe token rotated');
assert.match(fn, /catch \{[\s\S]*previous[\s\S]*update\(\{[\s\S]*token: previous\.token[\s\S]*unsubscribe_token: previous\.unsubscribe_token/,
  'a failed resend invalidates the previous confirmation and unsubscribe links');
assert.match(fn, /\.eq\('token', confirmationToken\)[\s\S]*\.eq\('unsubscribe_token', unsubscribeToken\)/,
  'send-failure compensation can overwrite a newer concurrent sign-up');
assert.match(fn, /: db\.from\('waitlist'\)\.delete\(\)[\s\S]*\.eq\('email', email\)[\s\S]*\.eq\('token', confirmationToken\)/,
  'a failed first send leaves an unreachable unconfirmed address behind');
assert.match(fn, /if \(cleanupError\) return json\(request, \{ code: 'privacy_cleanup_failed' \}, 503\)/,
  'failed send compensation is silently ignored');

const unsubscribeScript = read('site/unsubscribe.js');
for (const page of ['site/unsubscribe/index.html', 'site/en/unsubscribe/index.html']) {
  const html = read(page);
  assert.match(html, /data-unsubscribe hidden/, `${page}: the form flashes before its token is validated`);
  assert.match(html, /data-unsubscribe-status aria-live="polite"/, `${page}: result is not announced accessibly`);
  assert.match(html, /rel="canonical"/, `${page}: missing canonical URL`);
}
assert.match(unsubscribeScript, /ENDPOINT \+ '\/unsubscribe'/,
  'the public page never invokes the unsubscribe route');
assert.match(unsubscribeScript, /if \(!\/\^\[a-f0-9\]\{48\}\$\/\.test\(token\)\)/,
  'the public page sends malformed tokens to production');
assert.match(unsubscribeScript, /form\.hidden = false/,
  'a valid unsubscribe token never reveals the explicit confirmation control');
assert.match(unsubscribeScript, /status\.textContent = text\.failed/,
  'network failures are misreported as invalid links');

// --- Retention is executable and anchored to the real launch --------------
assert.match(retention, /values \(true, null\)/,
  'the migration invents a launch date instead of waiting for the real event');
assert.match(retention, /create or replace function private\.purge_waitlist/,
  'there is no executable retention function');
assert.match(retention, /confirmed_at is null[\s\S]*interval '30 days'/,
  'unconfirmed addresses have no bounded retention');
assert.match(retention, /configured_launch \+ interval '6 months'/,
  'confirmed addresses are not removed six months after the recorded launch');
assert.match(retention, /create extension if not exists pg_cron/,
  'the cleanup depends on a scheduler that is never installed');
assert.match(retention, /grant usage on schema cron to postgres/,
  'the scheduling role cannot use the cron schema');
assert.match(retention, /cron\.schedule\([\s\S]*'kandro-waitlist-retention'[\s\S]*private\.purge_waitlist\(\)/,
  'the daily cleanup job is not scheduled');
assert.match(retention, /cron\.schedule\([\s\S]*'kandro-waitlist-rate-limit-retention'[\s\S]*private\.purge_waitlist_rate_limits\(\)/,
  'short-lived abuse fingerprints have no cleanup schedule');
assert.match(retention, /revoke all on function private\.purge_waitlist\(timestamptz\) from public, anon, authenticated/,
  'clients can invoke the privileged purge function');
assert.match(runbook, /where singleton = true and launched_at is null/,
  'the runbook does not say how to record the actual launch once');
assert.match(runbook, /\/unsubscribe\/\?t=<unsubscribe_token>/,
  'future launch or follow-up messages are not required to carry an unsubscribe link');

// --- What the endpoint gives away ------------------------------------------
assert.match(fn, /return json\(request, \{ status: 'check_your_mail' \}\)/,
  'the answer differs for a known address, which turns the form into a lookup');
assert.ok(!/already_subscribed|exists/.test(fn),
  'the endpoint tells a stranger whether an address is on the list');
assert.match(fn, /const digest = await crypto\.subtle\.digest\(\s*'SHA-256'/,
  'the raw IP is stored, turning rate limiting into a visitor log');
assert.match(fn, /cf-connecting-ip[\s\S]*x-real-ip[\s\S]*chain\.at\(-1\)/,
  'a caller-controlled first forwarded-for value can bypass the network limit');
assert.ok(!/ip: ip\b|ip_address/.test(fn), 'the raw IP reaches the database');

// --- Said out loud, in both languages --------------------------------------
for (const [language, file, needles] of [
  ['de', 'src/i18n/legal.de.ts', ['Warteliste auf getkandro.com', 'Double-Opt-in', 'Art. 6 Abs. 1 lit. a DSGVO', 'Abmeldelink', 'Resend', '30 Tagen', 'sechs Monate', 'Kampagnenquelle', 'Hashwerte der IP- und E-Mail-Adresse', 'drei Stunden']],
  ['en', 'src/i18n/legal.en.ts', ['Waiting list on getkandro.com', 'double opt-in', 'Art. 6(1)(a) GDPR', 'unsubscribe link', 'Resend', '30 days', 'six months', 'campaign source', 'hashes of the IP and email address', 'three hours']],
]) {
  const legal = read(file);
  for (const needle of needles) {
    if (!legal.includes(needle)) problems.push(`${language} privacy policy never mentions "${needle}"`);
  }
}

// --- The page cannot ask for what it cannot confirm ------------------------
const script = read('site/waitlist.js');
// Execute the shipped browser script, including rejected and stalled requests.
async function runFormCase(language, statusMode, submitMode = 'success') {
  const input = { value: 'qa@example.invalid', disabled: false };
  const button = { disabled: false };
  const status = { textContent: '', className: '' };
  let submit;
  const timers = new Map();
  let timerId = 0;
  let sentBody;
  const form = {
    hidden: true,
    closest: () => ({ querySelector: () => status }),
    querySelector: (selector) => selector === 'button' ? button : input,
    reportValidity: () => true,
    reset: () => { input.value = ''; },
    addEventListener: (_, handler) => { submit = handler; },
  };
  const fetch = (url, options) => {
    const mode = url.endsWith('/status') ? statusMode : submitMode;
    if (options.body) sentBody = JSON.parse(options.body);
    if (mode === 'reject') return Promise.reject(new Error('offline'));
    if (mode === 'stall') return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('timeout'))));
    return Promise.resolve({ ok: true, json: async () => ({ accepting: mode !== 'closed' }) });
  };
  runInNewContext(script, {
    document: { documentElement: { lang: language }, querySelectorAll: () => [form] },
    location: { search: '' }, window: {}, URLSearchParams, AbortController, fetch,
    setTimeout: (fn) => { timers.set(++timerId, fn); return timerId; },
    clearTimeout: (id) => timers.delete(id),
  });
  const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  if (statusMode === 'stall') for (const callback of [...timers.values()]) callback();
  await flush();
  assert.equal(form.hidden, false, `${statusMode}: form must remain discoverable`);
  assert.equal(input.disabled, statusMode === 'closed');
  assert.equal(timers.size, 0, 'status timer must be cleaned up');
  if (statusMode === 'closed') return;
  submit({ preventDefault() {} });
  assert.equal(button.disabled, true);
  if (submitMode === 'stall') for (const callback of [...timers.values()]) callback();
  await flush();
  assert.equal(button.disabled, false, 'submit must recover after failures/timeouts');
  assert.equal(sentBody.language, language);
  assert.equal(timers.size, 0, 'submit timer must be cleaned up');
  assert.match(status.textContent, submitMode === 'success'
    ? language === 'de' ? /Postfach/ : /inbox/
    : language === 'de' ? /nicht geklappt/ : /did not work/);
}
for (const language of ['de', 'en']) {
  for (const status of ['success', 'closed', 'reject', 'stall']) await runFormCase(language, status);
  for (const submission of ['reject', 'stall']) await runFormCase(language, 'success', submission);
}
// Shown either way, but inert until an address can actually be confirmed: a
// blank gap where a sign-up should be reads as a broken page.
assert.match(script, /control\.input\.disabled = true;\s*\n\s*control\.button\.disabled = true;/,
  'the form stays live when the endpoint cannot send a confirmation');
assert.ok(!/payload\.accepting\) form\.hidden = false/.test(script),
  'the form is only drawn when accepting, so it is simply missing beforehand');
// The status line lives beside the form, so that it can still speak while the
// form is hidden. Looking for it inside the form found nothing, and every
// message the script tried to show threw instead.
assert.match(script, /var status = block\.querySelector\('\[data-waitlist-status\]'\)/,
  'each form cannot find the status line inside its own signup block');
for (const page of ['site/index.html', 'site/en/index.html']) {
  const html = read(page);
  for (const form of html.matchAll(/<form class="signup[^>]*>[\s\S]*?<\/form>/g)) {
    if (form[0].includes('data-waitlist-status')) {
      problems.push(`${page}: a status line is inside the form, so it disappears with it`);
    }
  }
}
for (const page of ['site/index.html', 'site/en/index.html']) {
  const html = read(page);
  if (!/<form class="signup" data-waitlist hidden>/.test(html)) {
    problems.push(`${page}: the sign-up form is visible before the endpoint is asked`);
  }
  if (!/data-discord/.test(html)) problems.push(`${page}: no Discord link`);
  if (!/privacy|Datenschutz/.test(html)) problems.push(`${page}: the form does not link the privacy policy`);
}
assert.match(fn, /language[^\n]*=== 'de' \? 'de' : 'en'/,
  'missing language no longer defaults safely to English');
assert.match(script, /document\.documentElement\.lang === 'de' \? 'de' : 'en'/,
  'the website does not derive the email language from the delivered document');
// The form and the Discord button are hidden with the hidden attribute, and
// both carry a display rule that would otherwise beat the browser's own rule
// for it — leaving them on screen while the script believed they were gone.
assert.match(read('site/styles.css'), /\[hidden\] \{ display: none !important; \}/,
  'a display rule can beat [hidden], so hiding the form does not hide it');

const community = read('site/community.js');
assert.match(community, /if \(!window\.KANDRO_DISCORD\) return;/,
  'an empty invite would render a dead join button');
// Once an invite is set it has to be one Discord recognises: a typo here
// renders a confident button that goes nowhere.
const invite = community.match(/window\.KANDRO_DISCORD = '([^']*)'/)?.[1] ?? '';
if (invite && !/^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9]+$/.test(invite)) {
  problems.push(`"${invite}" is not a Discord invite URL`);
}
assert.match(community, /document\.readyState === 'loading'/,
  'a cached script arriving after parsing would leave the button hidden for good');
// The invite and the sender are configured independently, so the closed
// message must not send people to a button that is not there.
assert.match(script, /window\.KANDRO_DISCORD \? text\.closedDiscord : text\.closed/,
  'the closed message points at Discord whether or not the button exists');

if (problems.length) {
  console.error('Waitlist check failed:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log('Waitlist: only the service role reaches the table, sign-ups are double opt-in, and both privacy policies say so.');
