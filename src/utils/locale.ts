import { Locale } from '../types';

export const LOCALE_STORAGE_KEY = 'raloa_user_locale';

export interface LanguageOption {
  code: Locale;
  label: string;
  nativeLabel: string;
  badge: string;
  direction: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  {
    code: 'en',
    label: 'English',
    nativeLabel: 'English',
    badge: 'EN',
    direction: 'ltr'
  },
  {
    code: 'ar',
    label: 'Arabic',
    nativeLabel: 'العربية',
    badge: 'AR',
    direction: 'rtl'
  }
];

/**
 * Retrieve persisted user language preference from localStorage,
 * falling back to browser language or default 'en'.
 */
export function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'en';

  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved === 'en' || saved === 'ar') {
      return saved;
    }

    // Check system/browser language preference
    const browserLang = navigator.language?.toLowerCase() || '';
    if (browserLang.startsWith('ar')) {
      return 'ar';
    }
  } catch {
    // Graceful fallback if localStorage is disabled or restricted
  }

  return 'en';
}

/**
 * Persist user language choice in localStorage.
 */
export function persistLocale(locale: Locale): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Gracefully handle storage quotas or restricted security modes
  }
}
