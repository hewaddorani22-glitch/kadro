import { legalProvider } from '@/constants/legal';

import type { LegalCopySet } from './legal.de';

/** Appends the country unless the configured address already names it. */
function withCountry(address: string, country: string) {
  return /deutschland|germany/i.test(address) ? address : `${address}, ${country}`;
}

function provider() {
  if (!legalProvider.name) {
    return 'Kandro is operated by the provider of the app.';
  }
  const parts = [legalProvider.name];
  if (legalProvider.address) parts.push(withCountry(legalProvider.address, 'Germany'));
  return `The controller responsible for processing is ${parts.join(', ')}.`;
}

function contact() {
  return legalProvider.email
    ? `You can reach us for privacy requests and support at ${legalProvider.email}.`
    : 'You can reach support and privacy requests through the support address listed on the App Store.';
}

export const legalEn: LegalCopySet = {
  version: '1.0 · Last updated 1 September 2026',
  privacy: {
    title: 'Privacy notice',
    intro: 'This notice explains in plain language which data Kandro processes, why, and how you can delete it again at any time.',
    sections: [
      {
        title: '1. Controller and contact',
        paragraphs: [
          provider(),
          contact(),
        ],
      },
      {
        title: '2. What data is processed',
        paragraphs: [
          'On your device, Kandro processes your profile, your targets, weight entries, confirmed meals and at most three failed, compressed photo scans kept for a retry you trigger yourself.',
          'When the cloud is active, Supabase stores in the EU a random account ID, your profile, your current targets, confirmed meals, ingredients, recommendations and feedback. Weight entries stay on your device; an email address is only stored if you deliberately secure your guest account.',
          'PostHog only receives anonymous feature events and sanitised errors, and only if you switch them on. Photos, email addresses, foods, calories, macros and Supabase IDs are not sent to PostHog.',
        ],
      },
      {
        title: '3. Photo analysis and recipients',
        paragraphs: [
          'A photo is downscaled on your device. The original is discarded afterwards. The working copy, or a meal description you deliberately typed, goes only to the configured Kandro analysis gateway and from there to OpenRouter or OpenAI for food and portion recognition. USDA FoodData Central is then queried with text search terms only. For a barcode, the number is looked up at Open Food Facts through the Kandro analysis gateway.',
          'Confirmed meals contain no photo. The local failure queue is capped at three scans and is cleared once an analysis succeeds.',
        ],
      },
      {
        title: '4. Purpose, legal basis and retention',
        paragraphs: [
          'Nutrition and goal data are health data within the meaning of Art. 9 GDPR. The legal basis is your explicit consent under Art. 9(2)(a) GDPR, which you give during onboarding and can withdraw at any time with effect for the future. It is stored with a timestamp and notice version on your device and, when the cloud is active, in your protected profile.',
          'Local data remains until you delete the app data or your account. Confirmed meals are stored locally for your history; for the cloud history the app currently loads at most 90 days. Cloud data remains until the account is deleted. Technically necessary backups may expire according to the retention periods of the respective processor.',
        ],
      },
      {
        title: '5. Your rights',
        paragraphs: [
          'You can request access, rectification, erasure, restriction and – where applicable – data portability, and you can withdraw consent with effect for the future. Anonymous usage analytics can be switched off at any time under “You”.',
          'Under “You → Delete account and data” you can delete your Supabase account, the associated cloud data and your local history. An Apple subscription must additionally be cancelled in your Apple subscription settings.',
          'You have the right to lodge a complaint with a supervisory authority; for North Rhine-Westphalia this is the State Commissioner for Data Protection and Freedom of Information NRW.',
        ],
      },
      {
        title: '6. Processors and transfers',
        paragraphs: [
          'We use Supabase (database and account, EU region), OpenRouter or OpenAI (image and text analysis), USDA FoodData Central and Open Food Facts (nutrition matching), RevenueCat (subscription management) and optionally PostHog (anonymous usage analytics, EU).',
          'For the analysis, data may be transferred to the United States. Analysis requests are configured so that content is not used for training. Photos are processed solely for the duration of the analysis and are not stored permanently.',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of use',
    intro: 'These terms describe what Kandro does and what it does not do. The app deliberately stays within general wellness support and transparent estimates.',
    sections: [
      {
        title: '1. What the app does',
        paragraphs: [
          'Kandro is a general wellness and planning tool. The app structures foods you photograph or describe, or packaged products via barcode, estimates their nutrition values, calculates a daily frame and suggests suitable next meals from a reviewed library.',
          'All values are estimates. You can correct detected ingredients and portion sizes before saving.',
        ],
      },
      {
        title: '2. Not a medical service',
        paragraphs: [
          'Kandro does not diagnose, does not treat any condition and does not replace medical or dietetic advice. Do not make medical decisions on the basis of the app alone.',
          'If you have health complaints, are pregnant, have an eating disorder or a metabolic condition, or follow a medically prescribed diet, please seek qualified advice before you change your targets.',
        ],
      },
      {
        title: '3. Acceptable use',
        paragraphs: [
          'You are responsible for checking your entries and the estimated values. Do not use Kandro for emergencies, medication dosing or clinical decisions.',
          'Automated attacks, circumventing technical protection measures and using other people’s accounts are not permitted.',
        ],
      },
      {
        title: '4. Subscriptions',
        paragraphs: [
          'Price, duration, trial period and renewal are shown before the purchase. Subscriptions renew automatically for the selected period until you cancel them. Payment is charged to your Apple ID; you can cancel at any time up to 24 hours before the period ends in your Apple ID settings.',
          'Deleting your Kandro account does not automatically end an Apple subscription. Purchases can be restored from the paywall.',
        ],
      },
      {
        title: '5. Availability and changes',
        paragraphs: [
          'Analysis providers and nutrition databases can be temporarily unavailable. On network errors, Kandro keeps at most three compressed scans locally for a manual retry.',
          'Material changes to the service, to privacy or to prices are shown transparently before they take effect.',
        ],
      },
      {
        title: '6. Provider and governing law',
        paragraphs: [
          `${provider()} ${contact()}`,
          'German law applies, without prejudice to the mandatory consumer protection rules of your country of residence. For subscriptions purchased through the App Store, Apple’s terms apply in addition.',
        ],
      },
    ],
  },
  sources: {
    title: 'Data sources',
    intro: 'Kandro does not invent nutrition values. Every number comes from a named source, and for every logged ingredient you can see which one.',
    sections: [
      {
        title: 'German dishes · Bundeslebensmittelschlüssel',
        paragraphs: [
          'For typical German dishes, Kandro uses reviewed nutrition values from the Bundeslebensmittelschlüssel. The model identifies the dish and the portion; the nutrition values themselves come from this database and are not estimated.',
          'Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 – Deutsche Nährstoffdatenbank. Karlsruhe. DOI: 10.25826/Data20251217-134202-0',
          'Licence: Creative Commons Attribution 4.0 International (CC BY 4.0). The data was selected for use in Kandro and converted to portion sizes; the Max Rubner-Institut has neither reviewed nor endorsed Kandro.',
        ],
      },
      {
        title: 'Individual ingredients · USDA FoodData Central',
        paragraphs: [
          'Ingredients outside the German dish reference are matched against USDA FoodData Central of the U.S. Department of Agriculture. This data is available in the public domain.',
          'Matching a food name to a USDA entry is an estimate. That is why every ingredient shows where its value came from, and uncertain matches are flagged for review.',
        ],
      },
      {
        title: 'Packaged products · Open Food Facts',
        paragraphs: [
          'Barcodes are looked up at Open Food Facts. The product database is published under the Open Database License (ODbL) and is maintained by volunteers.',
          'Nutrition values for packaged products therefore come from the manufacturer’s declaration and can be incomplete or out of date. When in doubt, check the value on the packaging.',
        ],
      },
      {
        title: 'Imagery',
        paragraphs: [
          'The example meal photo is by Markus Winkler and is used under the Unsplash licence. It only appears until you have taken a photo of your own.',
        ],
      },
      {
        title: 'What this means for your numbers',
        paragraphs: [
          'Every value in Kandro is an estimate. Even reviewed reference values assume a standard preparation – oil, sauce and portion size vary considerably in practice. That is why you can correct every ingredient and every portion before saving.',
        ],
      },
    ],
  },
};
