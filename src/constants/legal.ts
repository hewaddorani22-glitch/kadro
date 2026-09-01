/**
 * Provider identity shown in the in-app legal notices.
 *
 * These are legally required, not cosmetic: GDPR Art. 13 obliges us to name the
 * controller and a contact, and App Review reads the same screens. The app used
 * to ship placeholder text saying the details "must still be added before
 * publication", which tells a reviewer the app is unfinished.
 *
 * scripts/validate-release.mjs fails the release build while any of these are
 * empty, so a build can no longer reach TestFlight with placeholders.
 */
export const legalProvider = {
  name: process.env.EXPO_PUBLIC_LEGAL_PROVIDER_NAME?.trim() ?? '',
  address: process.env.EXPO_PUBLIC_LEGAL_PROVIDER_ADDRESS?.trim() ?? '',
  email: process.env.EXPO_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() ?? '',
  privacyUrl: process.env.EXPO_PUBLIC_LEGAL_PRIVACY_URL?.trim() ?? '',
  termsUrl: process.env.EXPO_PUBLIC_LEGAL_TERMS_URL?.trim() ?? '',
  supportUrl: process.env.EXPO_PUBLIC_LEGAL_SUPPORT_URL?.trim() ?? '',
} as const;

export const legalVersion = '1.0 · Stand 1. September 2026';

export function providerSentence() {
  if (!legalProvider.name) {
    return 'Verantwortlich für Kandro ist der Anbieter der App.';
  }
  const parts = [legalProvider.name];
  if (legalProvider.address) parts.push(legalProvider.address);
  return `Verantwortlich für die Verarbeitung ist ${parts.join(', ')}.`;
}

export function contactSentence() {
  return legalProvider.email
    ? `Datenschutzanfragen und Support erreichst du unter ${legalProvider.email}.`
    : 'Support und Datenschutzanfragen erreichst du über die im App Store hinterlegte Support-Adresse.';
}
