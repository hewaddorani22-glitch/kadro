import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateAnalysisInput } from '../supabase/functions/_shared/nutrition.mjs';

const jpeg=readFileSync(new URL('../assets/meal-bowl.jpg',import.meta.url)).toString('base64');
assert.equal(validateAnalysisInput({mimeType:'image/jpeg',imageBase64:jpeg}),true,'real bundled JPEG');
const invalid=[
  ['plain text','x'.repeat(100)], ['invalid alphabet','!'.repeat(100)],
  ['base64 text',Buffer.from('not an image '.repeat(20)).toString('base64')],
  ['truncated JPEG',jpeg.slice(0,-12)], ['missing SOI','AAAA'+jpeg.slice(4)],
  ['extra content',jpeg+Buffer.from('junk').toString('base64')],
  ['whitespace',' '+jpeg], ['data URL','data:image/jpeg;base64,'+jpeg],
  ['PNG under JPEG MIME',readFileSync(new URL('../assets/favicon.png',import.meta.url)).toString('base64')],
  ['empty',''],
];
for(const [name,imageBase64] of invalid) assert.equal(validateAnalysisInput({mimeType:'image/jpeg',imageBase64}),false,name);
for(const mimeType of ['image/heic','image/png','image/gif','text/plain',null]) assert.equal(validateAnalysisInput({mimeType,imageBase64:jpeg}),false,String(mimeType));
console.log('PASS: bundled JPEG accepted; 10 malformed/mislabeled payloads and 5 unsupported MIME declarations rejected. Structural validation; not full JPEG decoding or a physical camera test.');
