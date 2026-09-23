import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Locale } from '../types';
import { SUPPORTED_LANGUAGES } from '../utils/locale';
import { Tooltip } from './Tooltip';

interface LanguageDropdownProps {
  currentLocale: Locale;
  onSelectLocale: (locale: Locale) => void;
  className?: string;
  variant?: 'header' | 'mobile';
}

export const LanguageDropdown: React.FC<LanguageDropdownProps> = ({
  currentLocale,
  onSelectLocale,
  className = '',
  variant = 'header'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const activeLanguage = SUPPORTED_LANGUAGES.find((lang) => lang.code === currentLocale) || SUPPORTED_LANGUAGES[0];
  const isRtl = currentLocale === 'ar';

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (code: Locale) => {
    onSelectLocale(code);
    setIsOpen(false);
  };

  // Mobile drawer variant: A clean, segmented pill picker
  if (variant === 'mobile') {
    return (
      <div className={`w-full ${className}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold tracking-wider uppercase text-slate-500 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>{isRtl ? 'اللغة' : 'Language'}</span>
          </span>
        </div>
        <div
          role="radiogroup"
          aria-label={isRtl ? 'اختر اللغة' : 'Select language'}
          className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700"
        >
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = lang.code === currentLocale;
            return (
              <button
                key={lang.code}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onSelectLocale(lang.code)}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[13px] font-semibold transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-slate-200/60 dark:border-slate-700 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <span className="text-[11px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">
                  {lang.badge}
                </span>
                <span>{lang.nativeLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Header Dropdown variant
  return (
    <div ref={containerRef} className={`relative inline-block text-start ${className}`}>
      {/* Trigger Button */}
      <Tooltip
        content={isRtl ? 'تغيير لغة العرض' : 'Change Language'}
        description={isRtl ? 'التبديل بين العربية والإنجليزية' : 'Switch interface between English & Arabic'}
        shortcut="L"
        position="bottom"
        disabled={isOpen}
      >
        <button
          ref={triggerRef}
          type="button"
          id="language-switcher-trigger"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={isRtl ? 'تغيير اللغة' : 'Change language'}
          className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-200 text-[13px] font-semibold cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 ${
            isOpen
              ? 'bg-slate-100/90 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shadow-2xs hover:border-slate-300 dark:hover:border-slate-600'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors shrink-0" />
          <span className="leading-none">{activeLanguage.nativeLabel}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-transform duration-200 shrink-0 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      </Tooltip>

      {/* Animated Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full mt-2 end-0 z-50 min-w-[210px] w-56 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-[0_16px_40px_rgba(15,23,42,0.14)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.5)] p-1.5 focus:outline-none"
            role="listbox"
            aria-labelledby="language-switcher-trigger"
          >
            {/* Header label inside dropdown */}
            <div className="px-3 py-1.5 flex items-center justify-between text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800 mb-1">
              <span>{isRtl ? 'اختر اللغة' : 'Select Language'}</span>
              <span className="text-[10px] text-slate-400/80 dark:text-slate-500 font-normal">
                {isRtl ? 'تفضيل محفوظ' : 'Auto-saved'}
              </span>
            </div>

            {/* Language Options */}
            <div className="space-y-0.5">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = lang.code === currentLocale;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(lang.code)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-start transition-colors duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {lang.badge}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[13px] leading-snug">{lang.nativeLabel}</span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 leading-none">
                          {lang.code === 'ar' ? 'العربية · RTL' : 'English · LTR'}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 ms-2" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
