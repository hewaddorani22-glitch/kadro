#!/usr/bin/env node
/**
 * Two defects that a screenshot cannot show.
 *
 * Apple asks for a 44pt touch target. Six screens drew their back and close
 * circles at 40 or 42 and gave them no hitSlop, so the reachable area was
 * smaller than the guideline on every one of them.
 *
 * And a timer that outlives its screen still fires: the plan screen pushed the
 * paywall 900ms after a meal was logged without cancelling it, so leaving
 * within that window dropped the paywall on top of wherever the user had gone.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src', import.meta.url).pathname;
const walk = (dir) => readdirSync(dir).flatMap((entry) => {
  const path = join(dir, entry);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
const files = walk(root).filter((file) => file.endsWith('.tsx') || file.endsWith('.ts'));
const problems = [];

// --- Touch targets ----------------------------------------------------------
const MIN_TARGET = 44;
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const short = file.slice(root.length + 1);

  // Style entries small enough to matter, by declared box.
  const small = new Set();
  for (const match of source.matchAll(/([a-zA-Z][\w]*)\s*:\s*\{([^{}]*)\}/g)) {
    const body = match[2];
    const height = Number(body.match(/(?:^|[,{\s])height:\s*(\d+)/)?.[1] ?? 0);
    const width = Number(body.match(/(?:^|[,{\s])width:\s*(\d+)/)?.[1] ?? 0);
    if (height && width && (height < MIN_TARGET || width < MIN_TARGET)) small.add(match[1]);
  }

  // A Pressable wearing one of them needs hitSlop to make up the difference.
  for (const line of source.split('\n')) {
    if (!line.includes('<Pressable')) continue;
    const styled = line.match(/style=\{styles\.([a-zA-Z][\w]*)\}/);
    if (!styled || !small.has(styled[1])) continue;
    if (!/hitSlop/.test(line)) {
      problems.push(`${short}: a Pressable styled ${styled[1]} is under ${MIN_TARGET}pt and has no hitSlop`);
    }
  }
}

// --- Timers that can outlive their screen -----------------------------------
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const short = file.slice(root.length + 1);
  // `await new Promise((resolve) => setTimeout(resolve, ms))` is a sleep, not
  // a scheduled side effect: nothing happens later that could land on the
  // wrong screen, and the awaiting code already guards staleness.
  const scheduled = [...source.matchAll(/set(?:Timeout|Interval)\(\s*([^,\n]*)/g)]
    .filter((match) => !/^resolve\b/.test(match[1].trim()));
  const timers = scheduled.length;
  if (!timers) continue;
  const clears = (source.match(/clear(?:Timeout|Interval)\(/g) ?? []).length;
  if (!clears) problems.push(`${short}: ${timers} timer(s) and nothing cancels them on unmount`);
}

// The specific one that shipped, kept honest by name.
const plan = readFileSync(join(root, 'app/(tabs)/plan.tsx'), 'utf8');
assert.match(plan, /paywallTimer\.current = setTimeout/, 'the delayed paywall is untracked again');
assert.match(plan, /clearTimeout\(paywallTimer\.current\)/, 'the delayed paywall is never cancelled');
assert.match(plan, /useFocusEffect\(useCallback/, 'tabs stay mounted: cancellation must happen on blur, not only unmount');
assert.match(plan, /if \(focused\.current && params\.fromScan/, 'a save completing after blur must not schedule a new paywall');

if (problems.length) {
  console.error('Touch and timer check failed:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`Checked ${files.length} files for statically detectable small Pressables and uncancelled timers; Plan is guarded on blur. Native hit testing remains required.`);
