import { useRouter, useSegments } from 'expo-router';
import { PropsWithChildren, useEffect } from 'react';

import { useApp } from '@/context/AppContext';

const publicBeforeConsent = new Set(['index', 'onboarding', 'privacy', 'terms']);

export function AppRouteGuard({ children }: PropsWithChildren) {
  const router = useRouter();
  const segments = useSegments();
  const { hydrationReady, profile } = useApp();

  useEffect(() => {
    if (!hydrationReady || profile.completedAt) return;
    const rootSegment = segments[0] ?? 'index';
    if (!publicBeforeConsent.has(rootSegment)) router.replace('/onboarding');
  }, [hydrationReady, profile.completedAt, router, segments]);

  return children;
}
