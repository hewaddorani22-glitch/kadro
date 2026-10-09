import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
// Composed from real release-app captures by app-store/compose/render.py.
// Upload order follows the filenames: the next-meal answer leads (09.10.2026).
const expected = ['01-adapt.png', '02-photo.png', '03-voice.png', '04-today.png', '05-portions.png', '06-plan.png'];
const frames = JSON.parse(fs.readFileSync(path.join(root, 'app-store', 'compose', 'frames.json'), 'utf8'));
const errors = [];
if (JSON.stringify(frames.map((frame) => `${frame.id}.png`)) !== JSON.stringify(expected)) {
  errors.push(`frames.json order ${frames.map((frame) => frame.id).join(', ')} does not match ${expected.join(', ')}`);
}
// Captions promise estimates, not exactness, and headline numbers must match the capture.
const captions = JSON.stringify(frames);
for (const banned of ['Fertig.', 'Done.', 'genau in deinen', 'fit exactly', 'realistisches Zieldatum', 'realistic target date']) {
  if (captions.includes(banned)) errors.push(`frames.json still claims "${banned}"`);
}
const adapt = frames.find((frame) => frame.id === '01-adapt');
if (adapt?.['de-DE'].headline[0] !== '782 kcal übrig.' || adapt?.['en-US'].headline[0] !== '585 kcal left.') {
  errors.push('01-adapt headline must state the kcal left shown in each locale capture (DE 782, EN 585)');
}

for (const locale of ['en-US', 'de-DE']) {
  const directory = path.join(root, 'app-store', 'screenshots', locale);
  const actual = fs.existsSync(directory) ? fs.readdirSync(directory).filter((name) => name.endsWith('.png')).sort() : [];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(`${locale}: expected ${expected.join(', ')}, got ${actual.join(', ') || 'nothing'}`);
    continue;
  }

  for (const name of expected) {
    const file = path.join(directory, name);
    const png = fs.readFileSync(file);
    if (png.subarray(1, 4).toString('ascii') !== 'PNG') {
      errors.push(`${locale}/${name}: not a PNG`);
      continue;
    }
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    const colorType = png[25];
    if (width !== 1320 || height !== 2868) {
      errors.push(`${locale}/${name}: ${width}×${height}, expected 1320×2868`);
    }
    if (colorType === 4 || colorType === 6) {
      errors.push(`${locale}/${name}: contains an alpha channel, which App Store Connect rejects`);
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Validated ${expected.length * 2} localized App Store screenshots at 1320×2868 with no alpha channel.`);
