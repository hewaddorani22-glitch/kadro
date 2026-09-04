#!/usr/bin/env node
/**
 * The screenshots on the landing page looked stretched, and the cause was not
 * CSS: the device inside them was 540 wide and 800 tall, a shape no phone has.
 * A picture of a phone that is not phone-shaped reads as a broken image even
 * when nothing is scaling it.
 *
 * The declared width and height matter separately: the browser reserves that
 * box before the file arrives, so a wrong ratio there is the page jumping on
 * load.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

/** Intrinsic size of a WebP, read from the container header. */
function webpSize(path) {
  const buffer = readFileSync(path);
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF', `${path} is not a RIFF file`);
  assert.equal(buffer.toString('ascii', 8, 12), 'WEBP', `${path} is not a WebP`);
  const format = buffer.toString('ascii', 12, 16);
  if (format === 'VP8X') {
    return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
  }
  if (format === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  // Lossy VP8: the frame header carries the dimensions in 14 bits each.
  return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
}

const pages = ['site/index.html', 'site/en/index.html'];
let checked = 0;

for (const page of pages) {
  const html = readFileSync(resolve(projectRoot, page), 'utf8');
  for (const match of html.matchAll(/src="([^"]*assets\/[a-z-]+\.webp)" width="(\d+)" height="(\d+)"/g)) {
    const [, src, declaredWidth, declaredHeight] = match;
    const file = resolve(projectRoot, 'site', src.replace(/^(\.\.\/)+/, ''));
    const real = webpSize(file);
    checked += 1;

    if (real.width !== Number(declaredWidth) || real.height !== Number(declaredHeight)) {
      problems.push(`${page}: ${src} is ${real.width}x${real.height} but declares ${declaredWidth}x${declaredHeight}`);
    }

    // A phone is roughly 9:19.5. Anything squarer than 3:5 is not a phone
    // however carefully it is drawn.
    const ratio = real.width / real.height;
    if (ratio > 0.6) {
      problems.push(`${page}: ${src} is ${ratio.toFixed(2)} wide-to-tall, which is not a phone shape`);
    }
    if (ratio < 0.38) {
      problems.push(`${page}: ${src} is ${ratio.toFixed(2)} wide-to-tall, narrower than any phone`);
    }
  }
}

if (checked < 8) problems.push(`only ${checked} images were checked across both languages`);

// Both languages must show the same pictures, or one of them is stale.
const [german, english] = pages.map((page) => [...readFileSync(resolve(projectRoot, page), 'utf8')
  .matchAll(/assets\/([a-z-]+\.webp)" width="(\d+)" height="(\d+)"/g)]
  .map((match) => match.slice(1).join(' ')).join('|'));
if (german !== english) {
  problems.push('the two languages reference the images at different sizes');
}

if (problems.length) {
  console.error('Site image check failed:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`Validated ${checked} landing-page screenshots: real size matches the declared box, and every device is phone-shaped.`);
