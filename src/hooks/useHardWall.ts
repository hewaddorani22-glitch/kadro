import { useEffect, useSyncExternalStore } from 'react';
import { FIRST_SCAN_FREE_ALLOWANCE, FREE_SCAN_ALLOWANCE } from '@/constants/product';
import { getHardWallSnapshot, hardWallActive, loadHardWall, subscribeHardWall } from '@/services/hardWall';

/** Install-side hard-wall facts, merged with the last server mode. */
export function useHardWall() {
  const state = useSyncExternalStore(subscribeHardWall, getHardWallSnapshot, getHardWallSnapshot);
  useEffect(() => { void loadHardWall(); }, []);
  return state;
}

/** Free AI analyses this install can see in total: 1 behind the hard wall, else 3. */
export function useFreeScanAllowance() {
  const state = useHardWall();
  const hardWall = hardWallActive(state);
  return { hardWall, allowance: hardWall ? FIRST_SCAN_FREE_ALLOWANCE : FREE_SCAN_ALLOWANCE };
}
