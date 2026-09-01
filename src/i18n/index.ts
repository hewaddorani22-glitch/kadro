import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';

import { de } from '@/i18n/de';
import { en } from '@/i18n/en';

export type Language = 'de' | 'en';
export type Dictionary = typeof de;

const LANGUAGE_KEY = '@kandro/language:v1';

const dictionaries: Record<Language, Dictionary> = { de, en };

/**
 * English is the default and German is used when the device asks for it.
 *
 * The reach comes from English content, so most installs will not be German —
 * but German users still get the Bundeslebensmittelschlüssel references, which
 * only exist for their market. Defaulting the other way round would hand every
 * international install an app they cannot read.
 */
export function deviceLanguage(): Language {
  const tag = getLocales()[0]?.languageCode?.toLowerCase();
  return tag === 'de' ? 'de' : 'en';
}

export async function loadLanguage(): Promise<Language> {
  const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
  if (stored === 'de' || stored === 'en') return stored;
  return deviceLanguage();
}

export async function saveLanguage(language: Language) {
  await AsyncStorage.setItem(LANGUAGE_KEY, language);
}

export function dictionaryFor(language: Language): Dictionary {
  return dictionaries[language] ?? en;
}

/** BCP 47 tag for Intl formatting and for what we ask the analysis model for. */
export function localeTag(language: Language) {
  return language === 'de' ? 'de-DE' : 'en-GB';
}

export { de, en };
