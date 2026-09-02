import { useRouter, useSegments } from 'expo-router';
import { PropsWithChildren, useEffect } from 'react';

import { useApp } from '@/context/AppContext';

const publicBeforeConsent = new Set(['index', 'onboarding', 'data-consent', 'privacy', 'terms', 'sources', 'account-deletion']);

export function AppRouteGuard({ children }: PropsWithChildren) {
  const router = useRouter();
  const segments = useSegments();
  const { hydrationReady, profile, wellnessConsentGranted } = useApp();

  useEffect(() => {
    if (!hydrationReady) return;
    const rootSegment = segments[0] ?? 'index';
    if (!wellnessConsentGranted && !publicBeforeConsent.has(rootSegment)) {
      router.replace((profile.completedAt ? '/data-consent' : '/onboarding') as never);
      return;
    }
    if (wellnessConsentGranted && !profile.completedAt && !publicBeforeConsent.has(rootSegment)) {
      router.replace('/onboarding');
    }
  }, [hydrationReady, profile.completedAt, router, segments, wellnessConsentGranted]);

  return children;
}
