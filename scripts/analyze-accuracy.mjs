/**
 * Reads docs/accuracy-series.csv and reports where the estimate actually goes
 * wrong, split by the three independent error sources:
 *
 *   1. recognition — did we identify the right food at all
 *   2. portion     — how far the gram estimate is from the scale
 *   3. hidden fat  — oil, butter, sauce a photo cannot see
 *
 * A single average error hides all three. Improving the model helps 1 and 2;
 * nothing helps 3 except asking the user, which is what the portion correction
 * is for.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2] ?? resolve(projectRoot, 'docs/accuracy-series.csv');

const raw = await readFile(file, 'utf8');
const lines = raw.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
const [header, ...rest] = lines;
const columns = header.split(',');

const rows = rest.map((line) => {
  const cells = line.split(',');
  return Object.fromEntries(columns.map((name, index) => [name, (cells[index] ?? '').trim()]));
});

if (!rows.length) {
  console.log(`No measurements yet in ${file}.`);
  console.log('Fill one row per photographed meal, then run this again.');
  console.log('Aim for 30+ rows: ~10 with hidden_fat=yes and ~10 of one dish at different portion sizes.');
  process.exit(0);
}

const number = (value) => {
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

/** Signed relative error, so bias and spread stay distinguishable. */
const relative = (actual, truth) => (truth ? (actual - truth) / truth : null);

const percentiles = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  return { n: sorted.length, mean, median: at(0.5), p90: at(0.9), min: sorted[0], max: sorted[sorted.length - 1] };
};

const pct = (value) => (value === null || value === undefined ? '  n/a' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`);

const report = (label, values) => {
  const stats = percentiles(values);
  if (!stats) {
    console.log(`  ${label.padEnd(28)} keine Daten`);
    return;
  }
  const absolute = percentiles(values.map(Math.abs));
  console.log(
    `  ${label.padEnd(28)} n=${String(stats.n).padStart(3)}  Bias ${pct(stats.mean).padStart(7)}` +
    `  |Fehler| Median ${pct(absolute.median).padStart(7)}  p90 ${pct(absolute.p90).padStart(7)}`,
  );
};

console.log(`\nGenauigkeitsserie: ${rows.length} Mahlzeiten aus ${file}\n`);

// 1. Recognition ------------------------------------------------------------
const counts = rows.reduce((acc, row) => {
  const key = (row.matched || 'unknown').toLowerCase();
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});
const hits = counts.hit ?? 0;
console.log('1. Erkennung');
console.log(`  richtig erkannt              ${hits}/${rows.length}  (${((hits / rows.length) * 100).toFixed(0)} %)`);
for (const [key, value] of Object.entries(counts)) {
  if (key !== 'hit') console.log(`  ${key.padEnd(28)} ${value}`);
}

// 2. Portion ----------------------------------------------------------------
console.log('\n2. Portionsschätzung (Gramm gegen Waage)');
const portionErrors = rows
  .map((row) => relative(number(row.app_g), number(row.weighed_g)))
  .filter((value) => value !== null);
report('alle Mahlzeiten', portionErrors);

// 3. Energy, split by hidden fat --------------------------------------------
console.log('\n3. Energie (kcal gegen Sollwert)');
const withEnergy = rows
  .map((row) => ({
    row,
    error: relative(number(row.app_kcal), number(row.true_kcal)),
    hidden: (row.hidden_fat || '').toLowerCase().startsWith('y'),
  }))
  .filter((entry) => entry.error !== null);

report('alle Mahlzeiten', withEnergy.map((entry) => entry.error));
report('ohne verstecktes Fett', withEnergy.filter((entry) => !entry.hidden).map((entry) => entry.error));
report('mit Öl/Sauce/Dressing', withEnergy.filter((entry) => entry.hidden).map((entry) => entry.error));

const clean = percentiles(withEnergy.filter((entry) => !entry.hidden).map((entry) => entry.error));
const greasy = percentiles(withEnergy.filter((entry) => entry.hidden).map((entry) => entry.error));
if (clean && greasy) {
  const gap = greasy.mean - clean.mean;
  console.log(`\n  Aufschlag durch unsichtbares Fett: ${pct(gap)} im Mittel`);
  console.log('  Dieser Anteil ist aus einem Foto grundsätzlich nicht messbar.');
}

// 4. Macros -----------------------------------------------------------------
console.log('\n4. Makros');
for (const [label, appKey, trueKey] of [['Protein', 'app_protein', 'true_protein'], ['Fett', 'app_fat', 'true_fat']]) {
  report(label, rows.map((row) => relative(number(row[appKey]), number(row[trueKey]))).filter((value) => value !== null));
}

// 5. Worst offenders ---------------------------------------------------------
const worst = withEnergy
  .filter((entry) => entry.error !== null)
  .sort((a, b) => Math.abs(b.error) - Math.abs(a.error))
  .slice(0, 5);
if (worst.length) {
  console.log('\n5. Größte Abweichungen');
  for (const { row, error } of worst) {
    console.log(`  ${pct(error).padStart(8)}  ${(row.dish || row.id).slice(0, 40).padEnd(42)} ${row.matched}${row.notes ? ' · ' + row.notes : ''}`);
  }
}

console.log('\nLesehilfe: Bias ist die systematische Verschiebung — die lässt sich korrigieren.');
console.log('Der Median des Absolutfehlers ist die Streuung — die begrenzt, was überhaupt versprochen werden darf.\n');
