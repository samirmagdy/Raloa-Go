import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { Theme } from '../utils/theme';
import { Locale } from '../types';
import { Tooltip } from './Tooltip';

interface ThemeToggleProps {
  theme: Theme;
  onToggleTheme: () => void;
  variant?: 'header' | 'mobile';
  className?: string;
  locale?: Locale;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  theme,
  onToggleTheme,
  variant = 'header',
  className = '',
  locale = 'en'
}) => {
  const isDark = theme === 'dark';
  const isRtl = locale === 'ar';

  const label = isDark
    ? isRtl
      ? 'التبديل إلى الوضع الفاتح'
      : 'Switch to light mode'
    : isRtl
      ? 'التبديل إلى الوضع الداكن'
      : 'Switch to dark mode';

  // Mobile segmented toggle
  if (variant === 'mobile') {
    return (
      <div className={`w-full ${className}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            {isDark ? (
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-amber-500" />
            )}
            <span>{isRtl ? 'المظهر' : 'Theme'}</span>
          </span>
        </div>

        <div
          role="radiogroup"
          aria-label={isRtl ? 'اختر المظهر' : 'Select theme'}
          className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80"
        >
          <button
            type="button"
            role="radio"
            aria-checked={!isDark}
            onClick={() => {
              if (isDark) onToggleTheme();
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[13px] font-semibold transition-all duration-150 cursor-pointer ${
              !isDark
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sun className="w-4 h-4 text-amber-500" />
            <span>{isRtl ? 'فاتح' : 'Light'}</span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={isDark}
            onClick={() => {
              if (!isDark) onToggleTheme();
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[13px] font-semibold transition-all duration-150 cursor-pointer ${
              isDark
                ? 'bg-slate-900 text-white shadow-xs border border-slate-700 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Moon className="w-4 h-4 text-indigo-400" />
            <span>{isRtl ? 'داكن' : 'Dark'}</span>
          </button>
        </div>
      </div>
    );
  }

  // Header icon button
  const tooltipTitle = isDark
    ? isRtl
      ? 'الوضع الفاتح'
      : 'Light Mode'
    : isRtl
      ? 'الوضع الداكن'
      : 'Dark Mode';

  const tooltipDesc = isDark
    ? isRtl
      ? 'التبديل إلى مظهر الإضاءة النهاري عالي التباين'
      : 'Switch to crisp daylight light appearance'
    : isRtl
      ? 'التبديل إلى مظهر الإضاءة الليلي المريح للعين'
      : 'Switch to comfortable eye-safe dark theme';

  return (
    <Tooltip
      content={tooltipTitle}
      description={tooltipDesc}
      shortcut="T"
      position="bottom"
    >
      <button
        type="button"
        id="theme-toggle-button"
        onClick={onToggleTheme}
        aria-label={label}
        className={`group relative p-2 rounded-full border transition-all duration-200 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 ${
          isDark
            ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-amber-400 hover:text-amber-300 shadow-xs'
            : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-600 hover:text-indigo-600 shadow-2xs hover:border-slate-300'
        } ${className}`}
      >
        <div className="relative w-4 h-4 flex items-center justify-center">
          {isDark ? (
            <Sun className="w-4 h-4 transition-transform duration-300 rotate-0 hover:rotate-45" />
          ) : (
            <Moon className="w-4 h-4 transition-transform duration-300 -rotate-12 hover:rotate-0" />
          )}
        </div>
      </button>
    </Tooltip>
  );
};
