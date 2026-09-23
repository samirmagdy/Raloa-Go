import React from 'react';
import { motion } from 'motion/react';
import { Home, ArrowLeft, ArrowRight, Compass, AlertCircle, HelpCircle } from 'lucide-react';
import { Locale } from '../types';
import { Theme } from '../utils/theme';
import { RaloaLogo } from './brand/RaloaLogo';
import { ThemeToggle } from './ThemeToggle';
import { LanguageDropdown } from './LanguageDropdown';

interface NotFoundProps {
  locale: Locale;
  theme: Theme;
  onToggleTheme: () => void;
  onSelectLocale: (locale: Locale) => void;
  onReturnHome: () => void;
  onNavigateToSection?: (sectionId: string) => void;
  attemptedPath?: string;
}

export const NotFound: React.FC<NotFoundProps> = ({
  locale,
  theme,
  onToggleTheme,
  onSelectLocale,
  onReturnHome,
  onNavigateToSection,
  attemptedPath = '/page-not-found'
}) => {
  const isRtl = locale === 'ar';

  const t = {
    badge: isRtl ? 'خطأ 404 · صفحة غير موجودة' : '404 Error · Page Not Found',
    title: isRtl ? 'عذراً، هذه الصفحة غير موجودة' : 'Lost in the digital canvas?',
    description: isRtl
      ? 'يبدو أن الرابط الذي اتبعته قد تغير، أو أن الصفحة لم تعد متاحة. لا تقلق، يمكنك العودة فوراً إلى الصفحة الرئيسية واستكشاف أدوات ومزايا RALOA.'
      : 'The link you followed may be broken, or the page may have been moved. Let us help you find your way back to your creative workflow.',
    returnHome: isRtl ? 'العودة إلى الصفحة الرئيسية' : 'Return Home',
    exploreTemplates: isRtl ? 'استعراض القوالب' : 'Explore Templates',
    viewPricing: isRtl ? 'جدول الأسعار' : 'View Pricing',
    helpCenter: isRtl ? 'مركز المساعدة' : 'Help & Support',
    brokenPathLabel: isRtl ? 'المسار المطلوب:' : 'Requested URL:',
    popularLinks: isRtl ? 'أقسام مقترحة:' : 'Popular Destinations:'
  };

  return (
    <div
      id="not-found-page"
      className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors duration-200 relative overflow-hidden"
    >
      {/* Background Decorative Ambient Gradients */}
      <div
        aria-hidden="true"
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] sm:w-[800px] sm:h-[800px] bg-gradient-to-tr from-indigo-500/10 via-purple-500/10 to-cyan-500/5 dark:from-indigo-600/15 dark:via-purple-600/15 dark:to-cyan-600/10 rounded-full blur-3xl pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute -top-24 -right-24 w-96 h-96 bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-3xl pointer-events-none"
      />

      {/* Top Minimal Navigation Bar */}
      <header className="relative z-10 w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onReturnHome}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl"
          aria-label={isRtl ? 'الرئيسية RALOA' : 'RALOA Home'}
        >
          <RaloaLogo isRtl={isRtl} size="md" />
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle
            theme={theme}
            onToggleTheme={onToggleTheme}
            variant="header"
            locale={locale}
          />
          <LanguageDropdown
            currentLocale={locale}
            onSelectLocale={onSelectLocale}
            variant="header"
          />
        </div>
      </header>

      {/* Main Content Area */}
      <main
        role="alert"
        aria-labelledby="not-found-heading"
        className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-3xl mx-auto text-center"
      >
        {/* Simple Branded Vector Illustration */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-8 select-none flex items-center justify-center"
        >
          {/* Outer glow ring */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 blur-2xl transform scale-110" />

          {/* SVG Illustration Container */}
          <svg
            className="w-64 h-48 sm:w-80 sm:h-56 overflow-visible"
            viewBox="0 0 320 220"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Illustration showing a disconnected digital node and 404 badge"
          >
            {/* Background geometric grid accents */}
            <path
              d="M30 180H290M60 150H260M90 120H230"
              stroke="currentColor"
              strokeOpacity="0.08"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />

            {/* Left '4' Isometric Card */}
            <g className="transition-transform duration-300 hover:-translate-y-1">
              <rect
                x="35"
                y="55"
                width="72"
                height="100"
                rx="18"
                className="fill-white dark:fill-slate-900 stroke-slate-200/90 dark:stroke-slate-800"
                strokeWidth="1.5"
              />
              <rect
                x="45"
                y="65"
                width="52"
                height="80"
                rx="12"
                className="fill-indigo-50/50 dark:fill-indigo-950/30"
              />
              {/* Digit 4 */}
              <text
                x="71"
                y="125"
                fontSize="52"
                fontWeight="900"
                fontFamily="system-ui, -apple-system, sans-serif"
                textAnchor="middle"
                className="fill-indigo-600 dark:fill-indigo-400"
              >
                4
              </text>
            </g>

            {/* Center '0' Orbital Island Portal */}
            <g className="transition-transform duration-300 hover:scale-105">
              {/* Portal outer ring */}
              <circle
                cx="160"
                cy="105"
                r="46"
                className="stroke-indigo-400/40 dark:stroke-indigo-500/40"
                strokeWidth="2"
                strokeDasharray="6 6"
              />
              {/* Core card */}
              <circle
                cx="160"
                cy="105"
                r="38"
                className="fill-white dark:fill-slate-900 stroke-slate-200/90 dark:stroke-slate-800 shadow-xl"
                strokeWidth="1.5"
              />
              <circle
                cx="160"
                cy="105"
                r="28"
                className="fill-gradient-to-tr fill-purple-50 dark:fill-purple-950/40"
              />
              {/* Floating disconnected link / compass symbol */}
              <circle
                cx="160"
                cy="105"
                r="8"
                className="fill-indigo-600 dark:fill-indigo-400"
              />
              {/* Orbiting satellite dot 1 */}
              <circle
                cx="188"
                cy="85"
                r="3.5"
                className="fill-cyan-400"
              />
              {/* Orbiting satellite dot 2 */}
              <circle
                cx="132"
                cy="125"
                r="2.5"
                className="fill-purple-400"
              />
              {/* Digit 0 overlay subtle */}
              <text
                x="160"
                y="125"
                fontSize="50"
                fontWeight="900"
                fontFamily="system-ui, -apple-system, sans-serif"
                textAnchor="middle"
                className="fill-slate-900/10 dark:fill-white/10"
              >
                0
              </text>
            </g>

            {/* Right '4' Isometric Card */}
            <g className="transition-transform duration-300 hover:-translate-y-1">
              <rect
                x="213"
                y="55"
                width="72"
                height="100"
                rx="18"
                className="fill-white dark:fill-slate-900 stroke-slate-200/90 dark:stroke-slate-800"
                strokeWidth="1.5"
              />
              <rect
                x="223"
                y="65"
                width="52"
                height="80"
                rx="12"
                className="fill-purple-50/50 dark:fill-purple-950/30"
              />
              {/* Digit 4 */}
              <text
                x="249"
                y="125"
                fontSize="52"
                fontWeight="900"
                fontFamily="system-ui, -apple-system, sans-serif"
                textAnchor="middle"
                className="fill-purple-600 dark:fill-purple-400"
              >
                4
              </text>
            </g>

            {/* Floating vector accent 1 */}
            <path
              d="M110 35L112 42L119 44L112 46L110 53L108 46L101 44L108 42L110 35Z"
              className="fill-amber-400"
            />
            {/* Floating vector accent 2 */}
            <path
              d="M210 30L211.5 35L216.5 36.5L211.5 38L210 43L208.5 38L203.5 36.5L208.5 35L210 30Z"
              className="fill-indigo-400"
            />
          </svg>
        </motion.div>

        {/* Status Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/60 mb-4 shadow-2xs"
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{t.badge}</span>
        </motion.div>

        {/* Primary Heading */}
        <motion.h1
          id="not-found-heading"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-3"
        >
          {t.title}
        </motion.h1>

        {/* Narrative Description */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl mb-6 leading-relaxed"
        >
          {t.description}
        </motion.p>

        {/* Attempted Path Indicator */}
        {attemptedPath && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="flex items-center justify-center gap-2 text-xs font-mono px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 mb-8 max-w-md w-full overflow-hidden text-ellipsis whitespace-nowrap"
          >
            <span className="text-slate-400 dark:text-slate-500 font-sans">{t.brokenPathLabel}</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold truncate">{attemptedPath}</span>
          </motion.div>
        )}

        {/* Action Buttons: Primary 'Return Home' CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 w-full"
        >
          <button
            id="return-home-button"
            type="button"
            onClick={onReturnHome}
            className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-sm sm:text-base font-bold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {isRtl ? (
              <ArrowRight className="w-4 h-4 rtl:rotate-0" />
            ) : (
              <Home className="w-4 h-4" />
            )}
            <span>{t.returnHome}</span>
            {!isRtl && <ArrowRight className="w-4 h-4" />}
          </button>

          {onNavigateToSection && (
            <button
              type="button"
              onClick={() => onNavigateToSection('templates')}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-200 text-sm sm:text-base font-semibold border border-slate-200 dark:border-slate-800 transition-colors shadow-2xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Compass className="w-4 h-4 text-indigo-500" />
              <span>{t.exploreTemplates}</span>
            </button>
          )}
        </motion.div>

        {/* Quick Recommended Destinations */}
        {onNavigateToSection && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-10 pt-6 border-t border-slate-200/80 dark:border-slate-800/80 w-full flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-xs text-slate-500 dark:text-slate-400"
          >
            <span className="font-medium text-slate-600 dark:text-slate-400">{t.popularLinks}</span>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => onNavigateToSection('features')}
                className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-colors cursor-pointer"
              >
                {isRtl ? 'المميزات' : 'Features'}
              </button>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <button
                type="button"
                onClick={() => onNavigateToSection('pricing')}
                className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-colors cursor-pointer"
              >
                {t.viewPricing}
              </button>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <button
                type="button"
                onClick={() => onNavigateToSection('faq')}
                className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-colors cursor-pointer"
              >
                {t.helpCenter}
              </button>
            </div>
          </motion.div>
        )}
      </main>

      {/* Minimalist Sub-footer */}
      <footer className="relative z-10 w-full py-6 text-center text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-900">
        <p>© {new Date().getFullYear()} RALOA Inc. {isRtl ? 'جميع الحقوق محفوظة' : 'All rights reserved.'}</p>
      </footer>
    </div>
  );
};
