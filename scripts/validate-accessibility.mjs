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

async function walk(dir, extensions = ['.tsx']) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await walk(full, extensions));
    else if (extensions.some((extension) => entry.name.endsWith(extension))) found.push(full);
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

    // A radio needs a checked state. `selected` may render the visual state on
    // native, but React Native Web does not expose it as aria-checked, leaving
    // assistive technology unable to tell which mutually exclusive option won.
    if (/accessibilityRole=["']radio["']/.test(element.text)) {
      if (!/accessibilityState=\{\{[\s\S]*?checked\s*:/.test(element.text)) {
        failures.push(`${label}:${element.line} a radio has no checked accessibilityState`);
      }
      if (!/aria-checked=/.test(element.text)) {
        failures.push(`${label}:${element.line} a radio has no aria-checked web state`);
      }
      if (/accessibilityState=\{\{[\s\S]*?selected\s*:/.test(element.text)) {
        failures.push(`${label}:${element.line} a radio uses selected instead of checked`);
      }
    }
  }
}

// Typography floor: nothing rendered in the app is smaller than 12 pt.
// Captions at 9-11 pt were unreadable over the camera and on the paywall.
const FONT_FLOOR = 12;
const themeSource = await readFile(resolve(projectRoot, 'src/constants/theme.ts'), 'utf8');
const typeScale = Object.fromEntries([...themeSource.match(/export const typeScale = \{([^}]*)\}/)[1].matchAll(/(\w+): (\d+(?:\.\d+)?)/g)]
  .map(([, name, value]) => [name, Number(value)]));
for (const [name, size] of Object.entries(typeScale)) {
  if (size < FONT_FLOOR) failures.push(`typeScale.${name} is ${size} pt, below the ${FONT_FLOOR} pt floor`);
}
const sourceFiles = await walk(resolve(projectRoot, 'src'), ['.ts', '.tsx']);
for (const file of sourceFiles) {
  const source = await readFile(file, 'utf8');
  const label = relative(projectRoot, file);
  for (const match of source.matchAll(/fontSize\s*(?::|=)\s*\{?\s*["']?(\d+(?:\.\d+)?|typeScale\.\w+)/g)) {
    const raw = match[1];
    const size = raw.startsWith('typeScale.') ? typeScale[raw.slice('typeScale.'.length)] : Number(raw);
    if (!(size >= FONT_FLOOR)) {
      failures.push(`${label}:${source.slice(0, match.index).split('\n').length} fontSize ${raw} is below the ${FONT_FLOOR} pt floor`);
    }
  }
  // The light amber is 2.5:1 on white: fine for fills and borders, not for
  // words or meaningful icons. Those use attentionText. Macro colours are for
  // bars and dots only; their labels stay ink or muted.
  for (const match of source.matchAll(/(?<![A-Za-z])color\s*(?::|=)\s*\{?\s*colors\.(attention|macroCarbs|macroProtein|macroFat)\b(?!Text|Soft)/g)) {
    failures.push(`${label}:${source.slice(0, match.index).split('\n').length} colors.${match[1]} is used as a text/icon colour; use attentionText, text or muted`);
  }
}

if (failures.length) {
  throw new Error(`Accessibility validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(`Validated ${files.length} screens: controls announce labels, every radio exposes its checked state, no text is below ${FONT_FLOOR} pt and amber text meets contrast.`);
