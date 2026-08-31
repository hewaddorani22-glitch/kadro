import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationPath = resolve(projectRoot, 'supabase/migrations/20260831111459_day3_core_schema.sql');
const configPath = resolve(projectRoot, 'supabase/config.toml');
const [migration, config] = await Promise.all([readFile(migrationPath, 'utf8'), readFile(configPath, 'utf8')]);

const tables = [
  'profiles',
  'daily_targets',
  'meals',
  'meal_items',
  'recommendations',
  'recommendation_feedback',
];

const failures = [];
for (const table of tables) {
  if (!migration.includes(`create table public.${table}`)) failures.push(`missing table: ${table}`);
  if (!migration.includes(`alter table public.${table} enable row level security`)) failures.push(`RLS not enabled: ${table}`);
  if (!migration.includes(`create policy ${table}_select_own on public.${table}`)) failures.push(`missing owner select policy: ${table}`);
  if (!migration.includes(`create policy ${table}_insert_own on public.${table}`)) failures.push(`missing owner insert policy: ${table}`);
}

if (!migration.includes('revoke all on table public.profiles')) failures.push('table privileges are not explicitly revoked');
if (!migration.includes('alter default privileges in schema public revoke all on tables from anon, authenticated')) {
  failures.push('future public tables do not default to revoked client privileges');
}
if (!migration.includes('cardinality(suggestion_ids) = 3')) failures.push('recommendations must contain exactly three IDs');
if (/grant\s+.+\s+to\s+(anon|public)\b/i.test(migration)) failures.push('migration grants exposed data to anon/public');
if (/service_role|secret key/i.test(migration)) failures.push('migration unexpectedly references privileged client credentials');
if (!config.includes('enable_anonymous_sign_ins = true')) failures.push('local anonymous sign-in is not enabled');

if (failures.length) {
  throw new Error(`Supabase schema validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(`Validated ${tables.length} RLS-protected Kadro tables.`);
