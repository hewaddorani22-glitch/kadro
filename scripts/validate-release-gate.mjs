import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

// Release gate (owner decision 06.10.2026): no App Review submission may be
// built without these commits and fixes. See "Release gate" in AGENTS.md.
// Fails `npm run verify` if a branch drops or reverts any of them.
const requiredCommits = {
  '557c09f': 'real App Store screenshots, target date follows pace, no cloud notice in local-only mode, Add label',
  b31aea5: 'dish search with servings, weight labels without ,0, US English, brand mark on launch',
  b5de12a: 'microphone after a fresh install, localized decimal mark, final store screenshots',
  d5d0fc8: 'microphone stops instantly',
};
const markers = [
  ['src/services/foodSuggest.ts', 'RAW_DISH_ALIASES', 'everyday dishes in search'],
  ['src/services/foodSuggest.ts', 'DISH_CODES.has(entry[0])', 'dishes stay with the analysis when described'],
  ['src/app/onboarding.tsx', 'dateFollowsPace', 'target date follows the pace'],
  ['src/components/MealSyncStatus.tsx', "syncMode === 'local'", 'no cloud notice without cloud'],
  ['src/components/PortionSheet.tsx', 'target.adding', '"Add" for new entries'],
  ['src/app/index.tsx', 'KandroMark', 'brand mark instead of a spinner on launch'],
  ['src/utils/units.ts', 'trim = false', 'weight labels without a trailing ,0'],
  ['src/i18n/en.ts', "describeSubmit: 'Analyze'", 'US spelling'],
  ['src/components/VoiceInputButton.tsx', 'function recognitionAvailable', 'microphone shows after a fresh install'],
  ['src/components/VoiceInputButton.tsx', 'stopTimer.current = setTimeout', 'microphone stops instantly'],
  ['src/app/onboarding.tsx', 't.portion.decimalMark', 'localized decimal mark in the target weight'],
  ['app-store/screenshots/de-DE/02-photo.png', null, 'new German store screenshots'],
  ['app-store/screenshots/en-US/02-photo.png', null, 'new English store screenshots'],
];

const errors = [];
let shallow = false;
for (const [commit, what] of Object.entries(requiredCommits)) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', commit, 'HEAD'], { stdio: 'ignore' });
  } catch (error) {
    // CI or EAS may run without git history; the markers below still guard the content.
    if (error.status === 128) { shallow = true; continue; }
    errors.push(`missing commit ${commit} (${what})`);
  }
}
for (const [file, marker, what] of markers) {
  if (!fs.existsSync(file)) { errors.push(`${file} missing (${what})`); continue; }
  if (marker && !fs.readFileSync(file, 'utf8').includes(marker)) errors.push(`${file} no longer contains ${marker} (${what})`);
}

if (errors.length) {
  console.error('Release gate failed. Do not build or submit for App Review:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log(`Release gate: required fixes present${shallow ? ' (git history unavailable, content checked)' : ' and commits included'}.`);
