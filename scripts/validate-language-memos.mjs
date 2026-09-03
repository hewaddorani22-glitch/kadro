#!/usr/bin/env node
/**
 * Catches a bug that looks like a translation gap and is not.
 *
 * Non-React code reads the language through a module-level mirror rather than
 * the hook. The mirror starts on the device's language and is corrected one
 * render later, once storage answers. A useMemo that calls such a service
 * without `language` in its dependencies therefore keeps whatever the first
 * render produced: an English reader on a German phone got English headings
 * over German ingredients, and the dictionary check could not see it, because
 * every string in both files was correct.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const problems = [];

const walk = (dir) => readdirSync(dir).flatMap((entry) => {
  const path = join(dir, entry);
  return statSync(path).isDirectory() ? walk(path) : [path];
});

// Which exported functions read the language behind React's back.
const languageAware = new Set();
for (const path of walk(join(root, 'src/services'))) {
  if (!path.endsWith('.ts')) continue;
  const source = readFileSync(path, 'utf8');
  if (!/getLanguage\(\)|getDictionary\(\)/.test(source)) continue;
  // Per function, not per file: personalization.ts translates goal labels and
  // also computes calorie targets, and only one of those two reads a language.
  // Every top-level function ends the previous one's body, exported or not: a
  // private helper in between is not part of its neighbour.
  const declarations = [...source.matchAll(/^(export )?(?:async )?function (\w+)/gm)];
  for (const [index, match] of declarations.entries()) {
    if (!match[1]) continue;
    const to = declarations[index + 1]?.index ?? source.length;
    if (/getLanguage\(\)|getDictionary\(\)/.test(source.slice(match.index, to))) {
      languageAware.add(match[2]);
    }
  }
}
if (languageAware.size < 2) {
  problems.push('found almost no language-aware services, so this check is not checking anything');
}

/** The body of a call starting at `open`, by counting brackets. */
function callBody(source, open) {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '(') depth += 1;
    if (source[index] === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(open, index + 1);
    }
  }
  return source.slice(open);
}

for (const path of walk(join(root, 'src/app'))) {
  if (!path.endsWith('.tsx')) continue;
  const source = readFileSync(path, 'utf8');
  const file = path.slice(root.length);
  for (const hook of ['useMemo', 'useCallback', 'useEffect']) {
    let from = 0;
    for (;;) {
      const at = source.indexOf(`${hook}(`, from);
      if (at < 0) break;
      const body = callBody(source, at + hook.length);
      from = at + hook.length + body.length;
      const used = [...languageAware].filter((name) => new RegExp(`\\b${name}\\(`).test(body));
      if (!used.length) continue;
      const deps = body.slice(body.lastIndexOf('['), body.lastIndexOf(']') + 1);
      if (!/\blanguage\b/.test(deps)) {
        problems.push(`${file}: ${hook} calls ${used.join(', ')} but does not depend on \`language\``);
      }
    }
  }
}

if (problems.length) {
  console.error('Language-memo check failed:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`Checked every memo against ${languageAware.size} language-aware services: none can freeze on the device's language.`);
