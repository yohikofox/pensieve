import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import fr from './locales/fr';
import en from './locales/en';

// Get device locale, default to French
const deviceLanguage = Localization.getLocales()[0]?.languageCode ?? 'fr';
const supportedLanguages = ['fr', 'en'];
const defaultLanguage = supportedLanguages.includes(deviceLanguage) ? deviceLanguage : 'fr';

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: defaultLanguage,
  fallbackLng: 'fr',
  interpolation: {
    escapeValue: false, // React already escapes values
  },
  react: {
    useSuspense: false, // Avoid suspense issues in React Native
  },
});

export default i18n;

// Export type-safe translation hook
export { useTranslation } from 'react-i18next';

// Export language utilities
export const getCurrentLanguage = () => i18n.language;
export const changeLanguage = (lang: 'fr' | 'en') => i18n.changeLanguage(lang);
export const getSupportedLanguages = () => supportedLanguages;
