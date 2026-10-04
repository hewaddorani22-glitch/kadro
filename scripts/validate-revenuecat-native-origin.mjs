import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Typecheck the exact shipping closure for a device target. A simulator build
// removes its StoreKit branch at preprocessing time and cannot prove this.
const source = fs.readFileSync(new URL('../modules/kandro-widgets/ios/KandroWidgetsModule.swift', import.meta.url), 'utf8');
const marker = 'AsyncFunction("experimentInstallOrigin") { () async -> String in';
const start = source.indexOf(marker);
const end = source.indexOf('    Function("invalidate")', start);
assert.ok(start >= 0 && end > start);
const closure = source.slice(start + marker.length, end).trimEnd();
assert.ok(closure.endsWith('}'));
const body = closure.slice(0, -1);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'kandro-storekit-typecheck-'));
try {
  const file = path.join(temporary, 'StoreKitClosure.swift');
  fs.writeFileSync(file, `import Foundation\nimport StoreKit\nfunc checkShippingOriginClosure() async -> String {${body}}\n`);
  const sdk = spawnSync('xcrun', ['--sdk', 'iphoneos', '--show-sdk-path'], { encoding: 'utf8' });
  assert.equal(sdk.status, 0, sdk.stderr);
  const result = spawnSync('xcrun', ['--sdk', 'iphoneos', 'swiftc', '-typecheck', '-target', 'arm64-apple-ios15.1', '-sdk', sdk.stdout.trim(),
    new URL('../modules/kandro-widgets/ios/ExperimentOriginPolicy.swift', import.meta.url).pathname, file], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  if (result.stderr) process.stderr.write(result.stderr);
  console.log('PASS exact StoreKit origin closure: compiler-only arm64 iOS15.1 device target, no DEBUG/simulator branch, no execution/network. Full Expo module/host build remains separate.');
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
