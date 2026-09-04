#!/usr/bin/env node
/**
 * A plan someone cannot change is a plan they abandon: goals finish, weight
 * moves, activity changes. Editing re-runs the onboarding questions rather
 * than duplicating them, so the risks are that a field stops being prefilled
 * (silently resetting it to the first-run default), that consent gets asked
 * again, or that the entry point disappears from the profile.
 */
import { readFileSync } from 'node:fs';

const problems = [];
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const onboarding = read('src/app/onboarding.tsx');
const profile = read('src/app/(tabs)/profile.tsx');
const context = read('src/context/AppContext.tsx');

if (!/const editing = params\.edit === '1' && !!profile\.completedAt;/.test(onboarding)) {
  problems.push('onboarding: edit mode is not gated on a completed profile');
}

// Every stored field must come back prefilled; a missed one silently resets.
const prefilled = [
  ['goal', 'profile.goal'],
  ['displayName', 'profile.displayName'],
  ['sex', 'profile.sex'],
  ['unitSystem', 'profile.unitSystem'],
  ['age', 'profile.age'],
  ['height', 'profile.heightCm'],
  ['weight', 'profile.weightKg'],
  ['activity', 'profile.activityLevel'],
  ['weeklyRate', 'profile.weeklyRateKg'],
  ['preferences', 'profile.preferences'],
];
for (const [state, source] of prefilled) {
  const pattern = new RegExp(`useState[^\\n]*editing \\? ${source.replace('.', '\\.')} :`);
  if (!pattern.test(onboarding)) {
    problems.push(`onboarding: ${state} is not prefilled from ${source} when editing`);
  }
}

if (!/completedAt: editing \? profile\.completedAt : null/.test(onboarding)) {
  problems.push('onboarding: editing would overwrite completedAt and look like a fresh install');
}
if (!/EDIT_STEPS = STEPS\.filter\(\(id\) => id !== 'building'\)/.test(onboarding)) {
  problems.push("onboarding: edit mode still plays the first-run 'building' beat");
}
// Adult editing must not re-open consent. Moving a profile below 16 is the
// exception: server-approved guardian permission has to exist before saving.
const saveBlock = onboarding.slice(onboarding.indexOf('const saveEdits'), onboarding.indexOf('const showFooterButton'));
if (!saveBlock.includes('completeOnboarding(draftProfile)')) {
  problems.push('onboarding: saving edits does not go through completeOnboarding');
}
if (!/draftProfile\.age < 16 && !await getGuardianConsentStatus/.test(saveBlock)) {
  problems.push('onboarding: editing an age to 14–15 bypasses guardian approval');
}
if (!/else \{\s*await saveEdits\(\);/.test(saveBlock)) {
  problems.push('onboarding: an adult edit no longer saves directly');
}

if (!profile.includes("router.push('/onboarding?edit=1' as never)")) {
  problems.push('profile: no way in to the plan editor');
}
if (!profile.includes('t.profile.changePlan')) {
  problems.push('profile: the plan editor row has no label');
}

// completeOnboarding is the single place that recalculates and syncs.
if (!/const nextTargets = calculateDailyTargets\(completedProfile\);/.test(context)) {
  problems.push('AppContext: completeOnboarding no longer recalculates targets, so an edit would not move them');
}

if (problems.length) {
  console.error('Plan-editing check failed:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log('Plan editing reuses onboarding, stays prefilled, and only re-checks guardian approval for ages 14–15.');
