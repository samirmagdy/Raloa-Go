import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RaloaMark } from './brand/RaloaLogo';
import { Locale } from '../types';
import { Theme } from '../utils/theme';

interface LoadingOverlayProps {
  isLoading: boolean;
  locale?: Locale;
  theme?: Theme;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  locale = 'en',
  theme = 'light'
}) => {
  const isDark = theme === 'dark';
  const isRtl = locale === 'ar';

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          id="global-loading-overlay"
          role="status"
          aria-live="polite"
          aria-label={isRtl ? 'جاري تحميل التطبيق' : 'Loading application'}
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: 1.02,
            transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
          }}
          className="fixed inset-0 z-[100] flex flex-col justify-between bg-white dark:bg-slate-950 text-[#0F172A] dark:text-white transition-colors duration-200 overflow-hidden select-none pointer-events-auto"
        >
          {/* Ambient luminous radial glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-indigo-500/15 via-purple-500/10 to-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

          {/* Skeleton Top Header Bar */}
          <div className="w-full max-w-[1200px] mx-auto px-6 h-[72px] flex items-center justify-between opacity-60">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="w-24 h-4 rounded-md bg-slate-200 dark:bg-slate-800 animate-pulse" />
            </div>
            <div className="hidden md:flex items-center gap-6">
              <div className="w-16 h-3 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="w-16 h-3 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="w-16 h-3 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="w-24 h-9 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
            </div>
          </div>

          {/* Center Branded Pulse Experience */}
          <div className="relative z-10 flex flex-col items-center justify-center px-4 my-auto">
            {/* Glowing Brand Mark with layered pulse */}
            <div className="relative flex items-center justify-center mb-6">
              {/* Pulsing Aura Ring */}
              <motion.div
                animate={{
                  scale: [1, 1.25, 1],
                  opacity: [0.35, 0.7, 0.35]
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
                className="absolute w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-500/30 to-purple-500/20 blur-md pointer-events-none"
              />

              {/* Central Raloa Monogram Mark */}
              <motion.div
                animate={{
                  scale: [0.97, 1.03, 0.97]
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
                className="relative z-10 drop-shadow-[0_8px_24px_rgba(99,102,241,0.25)]"
              >
                <RaloaMark size={58} theme={isDark ? 'primary' : 'primary'} />
              </motion.div>
            </div>

            {/* Branded Wordmark & Skeleton Title */}
            <div className="text-center space-y-2">
              <span className="text-[20px] font-black tracking-[-0.03em] bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-white dark:via-indigo-200 dark:to-white bg-clip-text text-transparent">
                RALOA
              </span>

              {/* Shimmer Progress Track */}
              <div className="w-48 sm:w-56 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mx-auto mt-4">
                <motion.div
                  animate={{
                    x: ['-100%', '100%']
                  }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                  className="w-1/2 h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 rounded-full"
                />
              </div>

              {/* Localized Status Hint */}
              <p className="text-[12px] font-medium text-slate-400 dark:text-slate-500 pt-2 tracking-wide">
                {isRtl ? 'جاري تجهيز تجربة المنصة...' : 'Setting up creator experience...'}
              </p>
            </div>

            {/* Skeleton Mini Wireframe Preview Cards */}
            <div className="mt-8 flex items-center justify-center gap-3 opacity-40">
              <div className="w-12 h-2 rounded-full bg-slate-300 dark:bg-slate-700 animate-pulse" />
              <div className="w-20 h-2 rounded-full bg-slate-300 dark:bg-slate-700 animate-pulse" />
              <div className="w-12 h-2 rounded-full bg-slate-300 dark:bg-slate-700 animate-pulse" />
            </div>
          </div>

          {/* Bottom subtle copyright / attribution note */}
          <div className="w-full pb-6 text-center text-[11px] text-slate-300 dark:text-slate-700 select-none">
            RALOA · All-In-One Creator Platform
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
