/**
 * Every control a screen reader can reach has to say what it is.
 *
 * The two settings switches carried no label at all: VoiceOver announced
 * "switch, off" and nothing else, because the row's text sits in a sibling
 * view and is not read as part of the control. App Review checks this.
 */
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function walk(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await walk(full));
    else if (entry.name.endsWith('.tsx')) found.push(full);
  }
  return found;
}

const files = [
  ...await walk(resolve(projectRoot, 'src/app')),
  ...await walk(resolve(projectRoot, 'src/components')),
];

const failures = [];

/** Returns each JSX element of the given name, with its attributes. */
function elements(source, name) {
  const found = [];
  const opening = new RegExp(`<${name}(\\s|>|/)`, 'g');
  for (const match of source.matchAll(opening)) {
    let depth = 0;
    let index = match.index;
    for (; index < source.length; index += 1) {
      const char = source[index];
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      else if (char === '>' && depth === 0) break;
    }
    found.push({ text: source.slice(match.index, index + 1), line: source.slice(0, match.index).split('\n').length });
  }
  return found;
}

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const label = relative(projectRoot, file);

  // A switch is invisible to a screen reader without its own label.
  for (const element of elements(source, 'Switch')) {
    if (!/accessibilityLabel=/.test(element.text)) {
      failures.push(`${label}:${element.line} a Switch has no accessibilityLabel`);
    }
  }

  // A text field must announce what it collects.
  for (const element of elements(source, 'TextInput')) {
    if (!/accessibilityLabel=/.test(element.text)) {
      failures.push(`${label}:${element.line} a TextInput has no accessibilityLabel`);
    }
  }

  // An icon-only button says nothing on its own.
  for (const element of elements(source, 'Pressable')) {
    const iconOnly = /<Ionicons/.test(element.text);
    if (iconOnly && !/accessibilityLabel=/.test(element.text)) {
      failures.push(`${label}:${element.line} an icon-only Pressable has no accessibilityLabel`);
    }
  }
}

if (failures.length) {
  throw new Error(`Accessibility validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(`Validated ${files.length} screens: every switch, text field and icon-only button announces itself.`);
