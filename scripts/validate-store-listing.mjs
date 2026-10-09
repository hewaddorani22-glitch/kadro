#!/usr/bin/env node
/**
 * The App Store indexes the name, the subtitle and the keyword field together,
 * and each word counts once. A term repeated across two of them is not twice
 * as strong — it is one of the three fields spent on nothing.
 *
 * The limits are hard: App Store Connect refuses anything longer, and finding
 * that out during submission is a wasted evening.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../store.config.json', import.meta.url), 'utf8'));
const problems = [];
const locales = Object.entries(config.apple.info);
assert.ok(locales.length >= 2, 'the listing is no longer bilingual');

for (const [locale, info] of locales) {
  const name = info.title;
  const keywords = (info.keywords ?? []).join(',');

  assert.equal(typeof name, 'string', `${locale}: title must be present`);
  if (name.length > 30) problems.push(`${locale}: name is ${name.length} characters, Apple allows 30`);
  if (info.subtitle.length > 30) problems.push(`${locale}: subtitle is ${info.subtitle.length} characters, Apple allows 30`);
  if (keywords.length > 100) problems.push(`${locale}: keywords are ${keywords.length} characters, Apple allows 100`);
  if (!info.description || info.description.length > 4000) problems.push(`${locale}: description missing or exceeds 4000 characters`);
  if ((info.promoText ?? '').length > 170) problems.push(`${locale}: promotional text exceeds 170 characters`);
  for (const field of ['marketingUrl', 'supportUrl', 'privacyPolicyUrl']) {
    if (!info[field]?.startsWith('https://getkandro.com/')) problems.push(`${locale}: invalid ${field}`);
  }
  if (!info.description.includes('/terms/') || !info.description.includes('/privacy/')) {
    problems.push(`${locale}: subscription metadata must link terms and privacy`);
  }
  if (!info.description.includes('Kandro Pro') || !/monthly|monatliches/.test(info.description)
    || !/annual|jährliches/.test(info.description)) problems.push(`${locale}: subscription disclosure missing`);
  // Store offers do not prove a customer's eligibility. Keep the seven-day
  // condition and full yearly charge together, not a monthly-equivalent price.
  const trialCopy = info.description.split('\n\n').find(paragraph => /Apple Account/.test(paragraph)) ?? '';
  const trialRules = locale === 'de-DE'
    ? [/sieben Tage/i, /nur,? wenn Apple/, /gewählten Plan/, /Berechtigung bestätigt/, /vor dem Kauf angezeigte volle Jahrespreis/, /einmal pro Jahr/, /Ohne berechtigten Trial/]
    : [/seven-day free trial/i, /only when Apple/, /selected plan/, /confirms your eligibility/, /full annual price shown before purchase/, /once per year/, /Without an eligible trial/];
  if (trialRules.some(rule => !rule.test(trialCopy)) || /no annual trial is promised|Jahres-Trial wird nicht zugesagt/i.test(trialCopy)) {
    problems.push(`${locale}: trial disclosure must require the actual Apple offer and eligibility, and explain the full annual renewal charge`);
  }

  // Positioning decision 09.10.2026: the listing leads with "what fits next"
  // (three dishes for the rest of the day), the app is 16+, and the paused
  // access test is not described to customers.
  const german = locale === 'de-DE';
  const lead = info.description.split('\n\n').slice(0, 2).join(' ');
  if (!(german ? /was als Nächstes passt/ : /what fits next/).test(lead)
    || !(german ? /drei Gerichte/ : /three dishes/).test(lead)
    || !(german ? /zu Hause.*Supermarkt.*unterwegs/ : /at home.*supermarket.*on the go/).test(lead)) {
    problems.push(`${locale}: the description must open with the next-meal promise (three dishes, at home / supermarket / on the go)`);
  }
  if (!(german ? /ab 16 Jahren/ : /aged 16 and over/).test(info.description)
    || /\b14\b|sorgeberechtig|Elternteil|guardian/i.test(info.description)) {
    problems.push(`${locale}: the description must state 16+ and no longer mention ages 14–15 or guardian consent`);
  }
  if (!(german ? /medizinische Beratung/ : /medical advice/).test(info.description)) {
    problems.push(`${locale}: keep the short no-medical-advice line`);
  }
  const freeAndPro = german ? [/Kostenlos:/, /drei KI-Analysen/, /Kandro Pro:/, /Fair Use/, /Wochenrückblick/]
    : [/Free:/, /three AI analyses/, /Kandro Pro:/, /fair use/, /weekly review/];
  if (freeAndPro.some(rule => !rule.test(info.description))) {
    problems.push(`${locale}: the free and Pro scope must be stated plainly`);
  }
  const listing = [info.description, info.promoText, info.releaseNotes ?? ''].join('\n');
  if (/A\/B|variant|Variante|verifi|Zugangstest|access test|experiment/i.test(listing)) {
    problems.push(`${locale}: customer copy must not describe access tests, variants or verified accounts`);
  }
  if (!info.description.includes('stdeula')) problems.push(`${locale}: link Apple's standard EULA`);
  // Apple counts characters, but multi-byte umlauts have tripped the field
  // before. Staying within 100 bytes is safe under either reading.
  if (Buffer.byteLength(keywords, 'utf8') > 100) {
    problems.push(`${locale}: keywords are ${Buffer.byteLength(keywords, 'utf8')} bytes; keep them within 100 bytes`);
  }

  const words = (text) => new Set(text.toLowerCase().match(/[\p{L}]+/gu) ?? []);
  const named = new Set([...words(name), ...words(info.subtitle)]);
  for (const keyword of info.keywords ?? []) {
    for (const word of words(keyword)) {
      if (named.has(word)) {
        problems.push(`${locale}: "${word}" is in both the keywords and the name or subtitle, so one of them is wasted`);
      }
    }
  }

  // Apple rejects listings that read as keyword stuffing rather than a name.
  if ((name.match(/[,|]/g) ?? []).length > 0) {
    problems.push(`${locale}: the name uses a comma or pipe, which reads as keyword stuffing`);
  }
  if (/\b(best|top|#1|free|kostenlos)\b/i.test(name)) {
    problems.push(`${locale}: the name makes a ranking or price claim, which Apple rejects`);
  }
}

if (problems.length) {
  console.error('Store listing check failed:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`Validated ${locales.length} store listings: within Apple's limits, and no word is paid for twice.`);
