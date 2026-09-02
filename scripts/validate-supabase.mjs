import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationPath = resolve(projectRoot, 'supabase/migrations/20260831111459_day3_core_schema.sql');
const configPath = resolve(projectRoot, 'supabase/config.toml');
const accountLinkingPath = resolve(projectRoot, 'src/services/accountLinking.ts');
const emailTemplatePath = resolve(projectRoot, 'supabase/templates/email_change.html');
const accountDeletionPath = resolve(projectRoot, 'supabase/functions/delete-account/index.ts');
const gatewayPath = resolve(projectRoot, 'supabase/functions/nutrition/index.ts');
const quotaMigrationPath = resolve(projectRoot, 'supabase/migrations/20260901120000_add_analysis_quota.sql');
const cacheMigrationPath = resolve(projectRoot, 'supabase/migrations/20260901140000_add_usda_food_cache.sql');
const accuracyMigrationPath = resolve(projectRoot, 'supabase/migrations/20260901150000_harden_nutrition_accuracy.sql');
const mealAnalysisPath = resolve(projectRoot, 'src/services/mealAnalysis.ts');
const legalCopyPaths = ['src/i18n/legal.de.ts', 'src/i18n/legal.en.ts'].map((p) => resolve(projectRoot, p));
const [migration, config, accountLinking, emailTemplate, accountDeletion, gateway, quotaMigration, cacheMigration, accuracyMigration, mealAnalysis, ...legalCopy] = await Promise.all([
  readFile(migrationPath, 'utf8'),
  readFile(configPath, 'utf8'),
  readFile(accountLinkingPath, 'utf8'),
  readFile(emailTemplatePath, 'utf8'),
  readFile(accountDeletionPath, 'utf8'),
  readFile(gatewayPath, 'utf8'),
  readFile(quotaMigrationPath, 'utf8'),
  readFile(cacheMigrationPath, 'utf8'),
  readFile(accuracyMigrationPath, 'utf8'),
  readFile(mealAnalysisPath, 'utf8'),
  ...legalCopyPaths.map((path) => readFile(path, 'utf8')),
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

// The hosted analysis gateway is the only place the paid provider keys exist.
// These invariants keep it from silently becoming an open, unmetered endpoint.
if (!config.includes('[functions.nutrition]') || !/\[functions\.nutrition\]\s*\nverify_jwt = true/.test(config)) {
  failures.push('nutrition gateway must keep platform JWT verification enabled');
}
for (const invariant of [
  "withSupabase({ auth: 'user' }",
  'context.supabase.auth.getUser()',
  "context.supabase.rpc('consume_analysis_quota')",
  'daily_limit_reached',
  'MAX_IMAGE_BASE64',
]) {
  if (!gateway.includes(invariant)) failures.push(`analysis gateway invariant missing: ${invariant}`);
}
if (/EXPO_PUBLIC_/.test(gateway)) failures.push('analysis gateway must not read client-visible configuration');
if (!quotaMigration.includes('alter table public.analysis_usage enable row level security')) {
  failures.push('analysis_usage must enable row level security');
}
if (!quotaMigration.includes('revoke all on table public.analysis_usage from anon, authenticated')) {
  failures.push('analysis_usage must stay unreadable for client roles');
}
if (!quotaMigration.includes('security definer')) failures.push('quota counter must run as a definer function');
if (/create function public\.consume_analysis_quota\([^)]+\)/.test(quotaMigration)) {
  failures.push('the daily limit must not be a client-supplied argument');
}
// The USDA cache is shared across all users, so it must stay unreachable from
// any client: a poisoned entry would hand everyone wrong nutrition values.
if (!cacheMigration.includes('alter table public.usda_food_cache enable row level security')) {
  failures.push('usda_food_cache must enable row level security');
}
if (!cacheMigration.includes('revoke all on table public.usda_food_cache from anon, authenticated')) {
  failures.push('usda_food_cache must stay unwritable for client roles');
}
if (/create policy .*usda_food_cache/.test(cacheMigration)) {
  failures.push('usda_food_cache must not expose a client policy');
}
if (!gateway.includes('context.supabaseAdmin') || !gateway.includes('usda_food_cache')) {
  failures.push('the gateway must reach the USDA cache through the service role only');
}
// A zero-calorie product is not a product without data. Diet drinks and
// sparkling water are among the most scanned items and were being rejected.
if (!gateway.includes('missing_nutrition') || !gateway.includes('NUTRIMENT_KEYS')) {
  failures.push('the barcode lookup must distinguish absent nutrition from genuine zeroes');
}
if (/some\(\(value\) => value > 0\)/.test(mealAnalysis)) {
  failures.push('the client must not reject a product for having zero calories');
}
if (!gateway.includes('normalizeSearchTerm')) {
  failures.push('USDA cache keys must be normalized or the cache will miss constantly');
}
if (!gateway.includes('usdaCacheKey') || !gateway.includes('match.cacheable')) {
  failures.push('USDA cache must be versioned and reject ambiguous shared entries');
}
if (!gateway.includes("resolveBlsFacts") || !accuracyMigration.includes("'bls'")) {
  failures.push('BLS references must retain their provider in the gateway and database');
}
if (!gateway.includes("'openai/gpt-4.1-mini'") || !gateway.includes("'gpt-4.1-mini'")) {
  failures.push('the cost-controlled vision default must stay GPT-4.1-mini');
}

if (!mealAnalysis.includes('functionsBaseUrl') || !mealAnalysis.includes('Authorization: `Bearer ${accessToken}`')) {
  failures.push('the app must reach the gateway through an authenticated edge function call');
}

// BLS 4.0 is CC BY 4.0 and Open Food Facts is ODbL: both require the credit to
// be visible in the shipped product, not just in a repository file.
// Both licences bind us in every language the app ships, so check each
// dictionary rather than a single screen.
for (const [index, copy] of legalCopy.entries()) {
  const language = index === 0 ? 'German' : 'English';
  for (const credit of ['Max Rubner-Institut', 'Open Food Facts', 'USDA FoodData Central', '10.25826/Data20251217-134202-0', 'Open Database License (ODbL)']) {
    if (!copy.includes(credit)) failures.push(`user-visible ${language} attribution missing: ${credit}`);
  }
  if (!/Creative Commons (Namensnennung|Attribution) 4\.0 International \(CC BY 4\.0\)/.test(copy)) {
    failures.push(`the ${language} sources text must name the CC BY 4.0 licence in full`);
  }
}

if (failures.length) {
  throw new Error(`Supabase schema validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(`Validated ${tables.length} RLS-protected Kandro tables, ID-preserving account linking, and the metered, cached analysis gateway.`);
