export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'raloa_theme';

/**
 * Retrieve initial theme preference from localStorage or system media query.
 */
export function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';

  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // Fallback if localStorage or matchMedia is restricted
  }

  return 'light';
}

/**
 * Apply theme to document root element and persist in localStorage.
 */
export function applyTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;

  try {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Graceful error handling for storage limits or strict private mode
  }
}
