import { receiveCaptureLink } from '@/services/captureIntents';
/** Capture navigation survives hydration/consent redirects; it never performs an analysis. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  if (receiveCaptureLink(path)) return '/capture';
  // Unknown capture modes never reach the camera or other internal routes.
  if (/^kandro:/i.test(path) || /^\/capture(?:[/?#]|$)/i.test(path)) return '/';
  return path;
}
