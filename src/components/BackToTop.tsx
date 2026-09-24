import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Locale } from '../types';
import { Tooltip } from './Tooltip';

interface BackToTopProps {
  locale: Locale;
}

export const BackToTop: React.FC<BackToTopProps> = ({ locale }) => {
  const [isVisible, setIsVisible] = useState(false);
  const isRtl = locale === 'ar';
  const label = isRtl ? 'العودة إلى الأعلى' : 'Back to top';

  useEffect(() => {
    const heroElement = document.getElementById('hero');
    if (!heroElement || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(!entry.isIntersecting),
      { threshold: 0.05 }
    );
    observer.observe(heroElement);
    return () => observer.disconnect();
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 16 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-6 end-6 sm:bottom-8 sm:end-8 z-40 print:hidden"
        >
          <Tooltip
            content={label}
            description={isRtl ? 'الانتقال السريع إلى بداية الصفحة' : 'Scroll back up to the top of the page'}
            shortcut="H"
            position="top"
            align="end"
          >
            <button
              id="back-to-top-button"
              type="button"
              onClick={scrollToTop}
              aria-label={label}
              className="group relative flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-[0_8px_24px_rgba(15,23,42,0.12)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.5)] hover:shadow-[0_12px_32px_rgba(99,102,241,0.22)] hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 cursor-pointer"
            >
              {/* Up arrow icon with upward nudge on hover */}
              <ArrowUp className="w-5 h-5 sm:w-5.5 sm:h-5.5 transition-transform duration-200 group-hover:-translate-y-0.5 shrink-0" />
            </button>
          </Tooltip>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
