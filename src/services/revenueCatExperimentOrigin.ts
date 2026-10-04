import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import type { ExperimentInstallOrigin } from '@/services/revenueCatExperimentPolicy';

type Bridge = { experimentInstallOrigin?: () => Promise<string> };
const bridge = requireOptionalNativeModule<Bridge>('KandroWidgets');

/** Called only after the separate consent; StoreKit may contact Apple. No receipt crosses the bridge. */
export async function readRevenueCatExperimentOrigin(): Promise<ExperimentInstallOrigin> {
  if (__DEV__ || Platform.OS !== 'ios') return 'test';
  if (!bridge?.experimentInstallOrigin) return 'unknown';
  try {
    const result = await bridge.experimentInstallOrigin();
    return result === 'production' || result === 'test' ? result : 'unknown';
  } catch { return 'unknown'; }
}
