import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const dir = mkdtempSync(join(tmpdir(), 'kandro-accuracy-'));
const input = join(dir, 'local-fixture.csv');
try {
  const header = 'id,dish,weighed_g,true_kcal,true_protein,true_fat,app_g,app_kcal,app_protein,app_fat,matched,hidden_fat,notes';
  writeFileSync(input, `${header}\n1,unmeasured,250,500,30,10,,,,,,,fixture\n`);
  const run = () => execFileSync(process.execPath, [fileURLToPath(new URL('./analyze-accuracy.mjs', import.meta.url)), input], { encoding: 'utf8' });
  const missing = run();
  assert.match(missing, /noch keine bewerteten Fälle/);
  assert.doesNotMatch(missing, /-100\.0%|n=\s*\d+\s+Bias/);
  writeFileSync(input, `${header}\n1,unmeasured,250,500,30,10,,,,,,,fixture\n2,measured,250,500,30,10,275,550,33,11,hit,no,fixture\n`);
  const mixed = run();
  assert.match(mixed, /1\/1 bewertete Fälle/);
  assert.match(mixed, /Bewertungsabdeckung\s+1\/2/);
  assert.match(mixed, /n=\s*1\s+Bias\s+\+10\.0%/);
  assert.doesNotMatch(mixed, /-100\.0%/);
  console.log('Accuracy report: missing measurements excluded; coverage and actual measured error stay separate.');
} finally { rmSync(dir, { recursive: true, force: true }); }
