#!/usr/bin/env node
// The day-complete state is easy to regress: someone rearranges the Today card
// or the Plan results and the app starts recommending a fourth meal to a person
// who has already eaten their whole budget. These checks pin the guard down.
import { readFileSync } from 'node:fs';

const problems = [];
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const today = read('src/app/(tabs)/today.tsx');
const plan = read('src/app/(tabs)/plan.tsx');

for (const [label, source] of [['today.tsx', today], ['plan.tsx', plan]]) {
  if (!/const dayIsDone = remaining\.calories < \d+;/.test(source)) {
    problems.push(`${label}: no dayIsDone guard derived from remaining.calories`);
  }
}

// Today: the "show ideas" button must sit inside the not-done branch.
const ideasAt = today.indexOf('t.today.showIdeas');
const branchAt = today.indexOf('dayIsDone ?');
if (ideasAt < 0 || branchAt < 0 || ideasAt < branchAt) {
  problems.push('today.tsx: the meal-ideas button is not behind the dayIsDone branch');
}
if (!today.includes('t.today.dayComplete') || !today.includes('t.today.dayOver')) {
  problems.push('today.tsx: missing the finished-day copy');
}

// Plan: recommendMeals must not even run once the budget is spent.
if (!/selected && !dayIsDone \? recommendMeals\(/.test(plan)) {
  problems.push('plan.tsx: recommendMeals still runs when the day is done');
}
if (!plan.includes('t.plan.dayDoneTitle')) {
  problems.push('plan.tsx: missing the finished-day card');
}

for (const dict of ['src/i18n/de.ts', 'src/i18n/en.ts']) {
  const source = read(dict);
  for (const key of ['dayComplete:', 'dayCompleteText:', 'dayOver:', 'dayOverText:', 'logAnyway:', 'dayDoneTitle:', 'dayDoneText:', 'backToToday:']) {
    if (!source.includes(key)) problems.push(`${dict}: missing ${key}`);
  }
}

if (problems.length) {
  console.error('Day-complete check failed:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log('Day-complete state guarded in Today and Plan.');
