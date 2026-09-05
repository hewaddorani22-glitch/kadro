#!/usr/bin/env node
/**
 * The scan screen's camera had one failure that looked like bad luck and was
 * not: switching FOTO -> BARCODE -> FOTO cleared the "camera ready" flag
 * without remounting the camera, so onCameraReady never fired again and the
 * shutter answered "not ready" for the rest of the visit. These checks keep
 * the lifetime of that flag tied to the camera's own lifetime.
 */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { StackRouter, StackActions } from '@react-navigation/routers';

const problems = [];
const scan = readFileSync(new URL('../src/app/(tabs)/scan.tsx', import.meta.url), 'utf8');

// A tab stays mounted. Every fresh visit without an explicit deep-link mode
// must therefore put the camera back in photo mode instead of preserving a
// covered search/description state from the previous visit.
if (!scan.includes('useFocusEffect(useCallback')) {
  problems.push('the mounted scan tab is not reset when it receives focus again');
}
if (!/requestedMode === 'search'[\s\S]+: 'photo'/.test(scan)) {
  problems.push('a normal meal-slot visit no longer defaults back to photo mode');
}
if (!/setShowDescription\(nextMode === 'description'\)/.test(scan) || !/setShowSearch\(nextMode === 'search'\)/.test(scan)) {
  problems.push('the focus reset can leave a stale full-screen sheet over the camera');
}

// The reset effect must depend on the camera's existence only.
const resetMatch = scan.match(/if \(!cameraActive\) setCameraReady\(false\);\s*\n\s*\}, \[([^\]]*)\]\);/);
if (!resetMatch) {
  problems.push('the camera-ready flag is no longer cleared only on teardown');
} else if (resetMatch[1].includes('mode')) {
  problems.push('clearing camera-ready on a mode change strands it: a mode change does not remount the camera');
}

// setCameraReady(true) must come from the camera itself.
if (!/onCameraReady=\{\(\) => setCameraReady\(true\)\}/.test(scan)) {
  problems.push('nothing sets the camera-ready flag back to true');
}

// The shutter must not refuse on a flag that may never arrive.
const capture = scan.slice(scan.indexOf('const capture = async'), scan.indexOf('const runDemo'));
if (/!cameraReady/.test(capture)) {
  problems.push('capture refuses on cameraReady; some devices never send onCameraReady');
}
if (!/takePictureAsync/.test(capture)) {
  problems.push('capture no longer takes a picture');
}

// A camera running behind a full-screen sheet holds the device for nothing.
const active = scan.slice(scan.indexOf('const cameraActive ='), scan.indexOf('useEffect', scan.indexOf('const cameraActive =')));
for (const mode of ["'description'", "'search'"]) {
  if (!active.includes(`mode !== ${mode}`)) {
    problems.push(`the camera keeps running behind the ${mode} sheet`);
  }
}
if (!active.includes("pathname.endsWith('/scan')")) {
  problems.push('the camera is not torn down when the scan screen is left');
}

// A handed-off barcode must be able to fire again on a fresh camera.
if (!/setBarcodeBusy\(false\);\s*\n\s*\}, \[cameraActive, mode\]\);/.test(scan)) {
  problems.push('the barcode lock is not released when the camera or mode changes');
}

if (problems.length) {
  console.error('Camera lifecycle check failed:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
// Execute the actual screen handler with a delayed native camera response.
// Closing must win over both a successful photo and a rejected camera promise.
const handler = scan.slice(scan.indexOf('const capture = async'), scan.indexOf('// The demo meal'));
for (const { rejectPhoto, background } of [
  { rejectPhoto: false, background: false }, { rejectPhoto: true, background: false },
  { rejectPhoto: false, background: true }, { rejectPhoto: true, background: true },
]) {
  let settle;
  let calls = 0;
  const events = [];
  const refs = { scanFocused: { current: true }, scanVisit: { current: 1 }, captureLock: { current: false } };
  const dependencies = {
    ...refs,
    AppState: { currentState: 'active' },
    hasScanAccess: () => true,
    setCapturing: () => {}, primaryHaptic: () => {},
    permission: { granted: true },
    cameraRef: { current: { takePictureAsync: () => {
      calls += 1;
      return new Promise((resolve, reject) => { settle = rejectPhoto ? reject : resolve; });
    } } },
    Alert: { alert: () => events.push('alert') }, t: { scan: {} },
    deleteTemporaryPhoto: (uri) => events.push(`delete:${uri}`),
    setCapturedPhoto: () => events.push('photo'), router: { push: () => events.push('navigate') },
  };
  const capturePhoto = new Function(...Object.keys(dependencies), `${handler}; return capture;`)(...Object.values(dependencies));
  const first = capturePhoto();
  await capturePhoto();
  assert.equal(calls, 1, 'two taps in the same frame must take only one photo');
  if (background) dependencies.AppState.currentState = 'background';
  else {
    refs.scanFocused.current = false;
    refs.scanVisit.current += 1;
  }
  settle(rejectPhoto ? new Error('camera unmounted') : { uri: 'file:cancelled.jpg' });
  await first;
  assert.deepEqual(events, rejectPhoto ? [] : ['delete:file:cancelled.jpg'], 'a closed scanner must never navigate or alert late');
}
assert.match(scan, /hitSlop=\{8\} onPress=\{close\}/);
assert.match(active, /isFocused && foreground/);
assert.match(scan, /AppState.addEventListener\('change'/);
assert.match(scan, /return \(\) => subscription.remove\(\)/);
assert.match(scan, /pictureSize=\{Platform.OS === 'ios' \? '1920x1080' : undefined\}/);
assert.match(scan, /scanFocused.current = false;[\s\S]*scanVisit.current \+= 1;/);
assert.equal((scan.match(/onDismiss=\{finishSheetDismiss\}/g) || []).length, 2);
const confirm = readFileSync(new URL('../src/app/confirm.tsx', import.meta.url), 'utf8');
const result = readFileSync(new URL('../src/app/result.tsx', import.meta.url), 'utf8');
assert.ok(confirm.includes("router.replace('/result')"));
assert.ok(result.includes("router.dismissTo('/(tabs)/today')"));
assert.ok(result.includes("router.dismissTo({ pathname: '/(tabs)/plan'"));
// Use the actual navigation reducer, not an invented array simulation.
const stack = StackRouter({ initialRouteName: '(tabs)' });
const options = { routeNames: ['(tabs)', 'analyzing', 'confirm', 'result'], routeParamList: {}, routeGetIdList: {} };
let navigation = stack.getInitialState(options);
for (let cycle = 0; cycle < 30; cycle++) {
  for (const action of [StackActions.push('analyzing'), StackActions.replace('confirm'), StackActions.replace('result'), StackActions.popTo('(tabs)', { screen: cycle % 2 ? 'plan' : 'today' })]) {
    navigation = stack.getStateForAction(navigation, action, options);
    assert.ok(navigation);
  }
  assert.equal(navigation.routes.length, 1, 'completed scans must not accumulate tab/correction screens');
}
console.log('Camera lifecycle: focus reset, duplicate-tap lock, cancelled capture success/error and sheet dismissal checks passed.');
