import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const expected = ['01-next.png', '02-scan.png', '03-adapt.png', '04-log.png', '05-recipe.png'];
const errors = [];

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

console.log('Validated 10 localized App Store screenshots at 1320×2868 with no alpha channel.');
