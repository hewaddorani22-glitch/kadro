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

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const fn = read('supabase/functions/waitlist/index.ts');
const migration = read('supabase/migrations/20260903210000_add_waitlist.sql');
const config = read('supabase/config.toml');
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
assert.match(fn, /'Access-Control-Allow-Origin': SITE/,
  'a write endpoint open to every origin is a write endpoint for every origin');
assert.ok(!/Access-Control-Allow-Origin': '\*'/.test(fn), 'the origin is wide open');
assert.match(fn, /HOURLY_LIMIT/, 'nothing stops a script signing up all night');
assert.match(fn, /count \?\? 0\) >= HOURLY_LIMIT\) return json\(\{ code: 'too_many' \}, 429\)/,
  'the hourly cap is measured but not enforced');

// --- Double opt-in ---------------------------------------------------------
assert.match(migration, /confirmed_at timestamptz/,
  'without a confirmation timestamp the consent cannot be evidenced');
assert.match(migration, /unsubscribed_at timestamptz/, 'no record of an unsubscribe');
assert.match(fn, /sendConfirmation\(email, language, token\)/,
  'the address is stored without a confirmation ever being sent');
// A sign-up must never be usable before the click.
assert.ok(!/confirmed_at: new Date\(\)\.toISOString\(\)[\s\S]{0,400}upsert/.test(fn),
  'a sign-up confirms itself, which is single opt-in wearing a costume');
assert.match(fn, /if \(!resendKey \|\| !mailFrom\) return json\(\{ code: 'not_accepting' \}, 503\)/,
  'addresses are collected even when no confirmation can be sent');

// --- What the endpoint gives away ------------------------------------------
assert.match(fn, /return json\(\{ status: 'check_your_mail' \}\)/,
  'the answer differs for a known address, which turns the form into a lookup');
assert.ok(!/already_subscribed|exists/.test(fn),
  'the endpoint tells a stranger whether an address is on the list');
assert.match(fn, /const digest = await crypto\.subtle\.digest\('SHA-256'/,
  'the raw IP is stored, turning rate limiting into a visitor log');
assert.ok(!/ip: ip\b|ip_address/.test(fn), 'the raw IP reaches the database');

// --- Said out loud, in both languages --------------------------------------
for (const [language, file, needles] of [
  ['de', 'src/i18n/legal.de.ts', ['Warteliste auf getkandro.com', 'Double-Opt-in', 'Art. 6 Abs. 1 lit. a DSGVO', 'Abmeldelink', 'Resend']],
  ['en', 'src/i18n/legal.en.ts', ['Waiting list on getkandro.com', 'double opt-in', 'Art. 6(1)(a) GDPR', 'unsubscribe link', 'Resend']],
]) {
  const legal = read(file);
  for (const needle of needles) {
    if (!legal.includes(needle)) problems.push(`${language} privacy policy never mentions "${needle}"`);
  }
}

// --- The page cannot ask for what it cannot confirm ------------------------
const script = read('site/waitlist.js');
assert.match(script, /payload\.accepting\) form\.hidden = false/,
  'the form is drawn before the endpoint says it can send anything');
// The status line lives beside the form, so that it can still speak while the
// form is hidden. Looking for it inside the form found nothing, and every
// message the script tried to show threw instead.
assert.match(script, /var status = document\.querySelector\('\[data-waitlist-status\]'\)/,
  'the status line is looked up inside the form it sits beside');
for (const page of ['site/index.html', 'site/en/index.html']) {
  const html = read(page);
  const form = html.slice(html.indexOf('<form class="signup"'), html.indexOf('</form>'));
  if (form.includes('data-waitlist-status')) {
    problems.push(`${page}: the status line is inside the form, so it disappears with it`);
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
const community = read('site/community.js');
assert.match(community, /if \(!window\.KANDRO_DISCORD\) return;/,
  'an empty invite would render a dead join button');
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
