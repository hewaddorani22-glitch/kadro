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
  const keywords = (info.keywords ?? []).join(',');

  if (info.name.length > 30) problems.push(`${locale}: name is ${info.name.length} characters, Apple allows 30`);
  if (info.subtitle.length > 30) problems.push(`${locale}: subtitle is ${info.subtitle.length} characters, Apple allows 30`);
  if (keywords.length > 100) problems.push(`${locale}: keywords are ${keywords.length} characters, Apple allows 100`);

  // Using six of thirty characters on a name nobody searches for wastes the
  // strongest field in the listing.
  if (info.name.length < 18) {
    problems.push(`${locale}: the name uses only ${info.name.length} of 30 characters, the field search weighs most`);
  }

  const words = (text) => new Set(text.toLowerCase().match(/[\p{L}]+/gu) ?? []);
  const named = new Set([...words(info.name), ...words(info.subtitle)]);
  for (const keyword of info.keywords ?? []) {
    for (const word of words(keyword)) {
      if (named.has(word)) {
        problems.push(`${locale}: "${word}" is in both the keywords and the name or subtitle, so one of them is wasted`);
      }
    }
  }

  // Apple rejects listings that read as keyword stuffing rather than a name.
  if ((info.name.match(/[,|]/g) ?? []).length > 0) {
    problems.push(`${locale}: the name uses a comma or pipe, which reads as keyword stuffing`);
  }
  if (/\b(best|top|#1|free|kostenlos)\b/i.test(info.name)) {
    problems.push(`${locale}: the name makes a ranking or price claim, which Apple rejects`);
  }
}

if (problems.length) {
  console.error('Store listing check failed:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`Validated ${locales.length} store listings: within Apple's limits, and no word is paid for twice.`);
