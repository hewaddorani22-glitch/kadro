import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');
const [screen, context, de, en] = await Promise.all([
  read('src/app/analyzing.tsx'),
  read('src/context/AppContext.tsx'),
  read('src/i18n/de.ts'),
  read('src/i18n/en.ts'),
]);

assert.match(context, /activeScanMode === 'live' \|\| activeScanMode === 'queued'/,
  'only a captured photo or queued photo retry may enter the local queue');
assert.match(screen, /analysisError === 'offline'[\s\S]*analysisStatus === 'queued'[\s\S]*errOfflineNotQueuedBody/,
  'offline copy must distinguish a real queued photo from an unsaved input');
assert.match(context, /failure\.kind === 'request-expired' && activeScanMode === 'queued'[\s\S]*removeQueuedAnalysis\(invocationScanId\)/,
  'an expired replay tombstone must remove the unrecoverable queued job');
assert.match(context, /failure\.kind === 'offline' \|\| failure\.kind === 'provider-error'/,
  'only transient failures may re-enter the photo queue');
assert.match(screen, /analysisError === 'request-expired'[\s\S]*changeInput/,
  'an expired analysis must offer a fresh input instead of another identical retry');

for (const [language, dictionary] of [['German', de], ['English', en]]) {
  assert.match(dictionary, /errOfflineBody: ['"][^'"]*(Foto|photo)[^'"]*(gespeichert|saved)/i,
    `${language} queued-photo copy must say that the photo was saved`);
  assert.match(dictionary, /errOfflineNotQueuedBody: ['"][^'"]*(nicht|weder|not)[^'"]*(gespeichert|saved)/i,
    `${language} non-queued copy must disclose that the input was not saved`);
}

console.log('Offline copy checks passed: only queued photos are described as saved locally.');
