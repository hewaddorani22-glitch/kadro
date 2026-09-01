import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationPath = resolve(projectRoot, 'supabase/migrations/20260831111459_day3_core_schema.sql');
const configPath = resolve(projectRoot, 'supabase/config.toml');
const accountLinkingPath = resolve(projectRoot, 'src/services/accountLinking.ts');
const emailTemplatePath = resolve(projectRoot, 'supabase/templates/email_change.html');
const accountDeletionPath = resolve(projectRoot, 'supabase/functions/delete-account/index.ts');
const [migration, config, accountLinking, emailTemplate, accountDeletion] = await Promise.all([
  readFile(migrationPath, 'utf8'),
  readFile(configPath, 'utf8'),
  readFile(accountLinkingPath, 'utf8'),
  readFile(emailTemplatePath, 'utf8'),
  readFile(accountDeletionPath, 'utf8'),
]);

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
if (!config.includes('enable_manual_linking = true')) failures.push('local manual account linking is not enabled');
if (!config.includes('enable_confirmations = true')) failures.push('local email confirmation is not enabled');
if (!config.includes('minimum_password_length = 8')) failures.push('local password minimum is not eight characters');
if (!emailTemplate.includes('{{ .Token }}') || !emailTemplate.includes('{{ .ConfirmationURL }}')) {
  failures.push('email-change template must support both OTP and confirmation-link flows');
}

for (const invariant of [
  'client.auth.updateUser({ email: normalizedEmail })',
  "type: 'email_change'",
  'assertSameUser(user.id',
  'client.auth.signInWithPassword',
]) {
  if (!accountLinking.includes(invariant)) failures.push(`account linking invariant missing: ${invariant}`);
}
if (accountLinking.includes('signInWithOtp')) failures.push('anonymous account upgrade must not create or switch to a separate OTP user');

for (const invariant of [
  "withSupabase({ auth: 'user' }",
  'context.supabase.auth.getUser()',
  'context.supabaseAdmin.auth.admin.deleteUser(data.user.id)',
  "request.method !== 'DELETE'",
]) {
  if (!accountDeletion.includes(invariant)) failures.push(`account deletion invariant missing: ${invariant}`);
}
if (!config.includes('[functions.delete-account]') || !config.includes('verify_jwt = true')) {
  failures.push('delete-account function must keep platform JWT verification enabled');
}

if (failures.length) {
  throw new Error(`Supabase schema validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(`Validated ${tables.length} RLS-protected Kandro tables and ID-preserving account linking.`);
