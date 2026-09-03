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
  version: '1.1 · Last updated 2 September 2026',
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
          'A photo is downscaled on your device. The original is discarded afterwards. The working copy, or a meal description you deliberately typed, is transferred to OpenRouter in the United States and from there exclusively to Microsoft Azure, where the OpenAI GPT-4.1 mini model identifies foods and portions. USDA FoodData Central is then queried with text search terms only. For a barcode, the number is looked up at Open Food Facts through the Kandro analysis gateway.',
          'Confirmed meals contain no photo. The local failure queue is capped at three scans and is cleared once an analysis succeeds.',
        ],
      },
      {
        title: '4. Purpose, legal basis and retention',
        paragraphs: [
          'Nutrition and goal data are health data within the meaning of Art. 9 GDPR. The legal basis is your explicit consent under Art. 9(2)(a) GDPR, which you give during onboarding and can withdraw at any time under “You → Analysis & data use” with effect for the future. After withdrawal, Kandro sends no analysis, body or nutrition data to the named recipients. Consent is stored with a timestamp and notice version on your device and, when the cloud is active, in your protected profile.',
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
          'We use Supabase (database and account, EU region), OpenRouter in the United States and Microsoft Azure with the OpenAI GPT-4.1 mini model (image and text analysis), USDA FoodData Central and Open Food Facts (nutrition matching), RevenueCat (subscription management) and optionally PostHog (anonymous usage analytics, EU).',
          'The AI data path is restricted to OpenRouter and ZDR-capable Microsoft Azure endpoints without fallback. Requests are configured with “store: false”, data collection denied and Zero Data Retention: content is not used for training and is not stored permanently by the AI provider. Photos are processed solely for the duration of the analysis. OpenRouter and USDA FoodData Central process data in the United States; USDA receives normalized food terms only, not photos, account IDs or body data.',
        ],
      },
      {
        title: '7. Waiting list on getkandro.com',
        paragraphs: [
          'Anyone signing up on the website to be told about the launch gives an email address. We store it together with the chosen language, the time of sign-up and the time of confirmation. The legal basis is your consent, Art. 6(1)(a) GDPR.',
          'Sign-up is double opt-in: after submitting you receive a confirmation mail, and only the click in it adds you. Without that click we do not use the address. To keep automated bulk sign-ups out we also store a salted hash of the IP address, not the address itself.',
          'The address is used only for the launch notice and messages directly related to it, not for an ongoing newsletter. Every mail carries an unsubscribe link; we delete the entry once you unsubscribe, and at the latest six months after launch. Sending is done through Resend; the entries are stored at Supabase in the EU.',
          'The Discord server is an offering of Discord. Joining it is something you do towards Discord; we receive no data from you in the process and have no influence over how Discord handles it.',
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
          'Kandro is a general wellness and planning tool for adults aged 18 and over. The app structures foods you photograph or describe, or packaged products via barcode, estimates their nutrition values, calculates a daily frame and suggests suitable next meals from a curated catalogue of typical reference values.',
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
    intro: 'Logged ingredients show their nutrition source. Kandro visibly separates database values, AI-assisted matching and its own typical planning references.',
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
        title: 'Kandro recommendation catalogue',
        paragraphs: [
          'The three next-meal options come from a catalogue curated by Kandro. Its calories and macros are typical, plausible planning references for the described standard portion, not measurements of an individual preparation. The app labels them “Kandro catalog · typical reference value”.',
          'The catalogue is ranked deterministically against your remaining daily frame, context and preferences. AI does not invent recommendation cards.',
        ],
      },
      {
        title: 'How a photo estimate is produced',
        paragraphs: [
          'GPT-4.1 mini identifies foods and estimates visible gram amounts. Kandro does not take nutrition values from the model; it matches the detected terms against BLS or USDA references. Uncertain matches, hidden calories and broad portion ranges are flagged.',
          'Before saving, Kandro shows every ingredient, gram amount and source for confirmation. You can change amounts or exclude ingredients. This review is part of every photo and text analysis.',
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
