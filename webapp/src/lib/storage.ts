import type { Lang } from '../types';
import { cityConfig } from '../config/city';

const LANGUAGE_KEY = `${cityConfig.slug}.language`;
const ONBOARDED_KEY = `${cityConfig.slug}.onboarded`;

export function getStoredLanguage(): Lang {
  const value = localStorage.getItem(LANGUAGE_KEY);
  return value && cityConfig.supportedLanguages.includes(value as Lang)
    ? value as Lang
    : cityConfig.defaultLanguage;
}

export function storeLanguage(lang: Lang) {
  localStorage.setItem(LANGUAGE_KEY, lang);
}

export function hasOnboarded() {
  return localStorage.getItem(ONBOARDED_KEY) === 'true';
}

export function storeOnboarded() {
  localStorage.setItem(ONBOARDED_KEY, 'true');
}
