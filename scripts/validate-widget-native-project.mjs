import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const xcode = require('xcode');
const plist = require('@expo/plist').default;
const ios = process.argv[2];
assert.ok(ios, 'Pass the ios directory of a freshly generated private CNG copy');
const project = xcode.project(path.join(ios, 'Kandro.xcodeproj/project.pbxproj'));
project.parseSync();
const objects = project.hash.project.objects;
const unquote = value => String(value ?? '').replace(/^"|"$/g, '');
const entries = section => Object.entries(section).filter(([id]) => !id.endsWith('_comment'));
const privacyRefs = [];

for (const name of ['Kandro', 'KandroWidgets']) {
  const matches = entries(objects.PBXNativeTarget).filter(([, target]) => unquote(target.name) === name);
  assert.equal(matches.length, 1, `${name}: exactly one target`);
  const [targetId] = matches[0];
  const group = entries(objects.PBXGroup).find(([, value]) => unquote(value.name ?? value.path) === name);
  assert.ok(group, `${name}: source group exists`);
  const ownPrivacy = group[1].children.filter(child => unquote(objects.PBXFileReference[child.value]?.path).endsWith('PrivacyInfo.xcprivacy'));
  assert.equal(ownPrivacy.length, 1, `${name}: exactly one own privacy file reference`);
  const privacyPath = path.resolve(ios, unquote(group[1].path), unquote(objects.PBXFileReference[ownPrivacy[0].value].path));
  assert.equal(privacyPath, path.resolve(ios, name, 'PrivacyInfo.xcprivacy'), `${name}: reference resolves to its own file`);
  const phase = project.pbxResourcesBuildPhaseObj(targetId);
  const resources = phase.files.map(file => objects.PBXBuildFile[file.value].fileRef);
  const manifests = resources.filter(ref => unquote(objects.PBXFileReference[ref]?.path).endsWith('PrivacyInfo.xcprivacy'));
  assert.deepEqual(manifests, [ownPrivacy[0].value], `${name}: resource phase must use its own manifest`);
  privacyRefs.push(ownPrivacy[0].value);
  const manifest = plist.parse(fs.readFileSync(path.join(ios, name, 'PrivacyInfo.xcprivacy'), 'utf8'));
  assert.equal(manifest.NSPrivacyTracking, false);
  if (name === 'KandroWidgets') assert.deepEqual(manifest.NSPrivacyAccessedAPITypes, []);
  if (name === 'Kandro' && process.argv.includes('--aggregated')) {
    const types = new Set(manifest.NSPrivacyAccessedAPITypes.map(api => api.NSPrivacyAccessedAPIType));
    for (const type of ['FileTimestamp', 'UserDefaults', 'SystemBootTime', 'DiskSpace']) {
      assert.ok(types.has(`NSPrivacyAccessedAPICategory${type}`), `Host aggregated API category: ${type}`);
    }
  }
}
assert.notEqual(...privacyRefs, 'Host and widget need independent privacy references');
console.log('PASS: real generated host/widget resources use separate privacy manifests without duplicate targets/references');
