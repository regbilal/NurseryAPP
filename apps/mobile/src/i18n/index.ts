import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { I18nManager } from 'react-native';
import { setRequestLang } from '../api';
import en from './en.json';
import fr from './fr.json';
import ar from './ar.json';

const device = Localization.getLocales()[0]?.languageCode ?? 'en';
const start = ['ar', 'fr', 'en'].includes(device) ? device : 'en';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr }, ar: { translation: ar } },
  lng: start,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});
setRequestLang(start);

export async function setAppLanguage(lang: string) {
  setRequestLang(lang);
  await i18n.changeLanguage(lang);
  const rtl = lang === 'ar';
  if (I18nManager.isRTL !== rtl) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
  }
}

export default i18n;
