import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Locale } from '../types';

interface ScrollSpyDotsProps {
  locale: Locale;
}

interface SectionItem {
  id: string;
  labelEn: string;
  labelAr: string;
}

const SECTIONS: SectionItem[] = [
  { id: 'hero', labelEn: 'Overview', labelAr: 'البداية' },
  { id: 'benefits', labelEn: 'Benefits', labelAr: 'المزايا' },
  { id: 'templates', labelEn: 'Templates', labelAr: 'القوالب' },
  { id: 'how-it-works', labelEn: 'How It Works', labelAr: 'كيف يعمل' },
  { id: 'features', labelEn: 'Features', labelAr: 'المميزات' },
  { id: 'testimonials', labelEn: 'Stories', labelAr: 'قصص النجاح' },
  { id: 'pricing', labelEn: 'Pricing', labelAr: 'الأسعار' },
  { id: 'faq', labelEn: 'FAQ', labelAr: 'الأسئلة' },
  { id: 'newsletter', labelEn: 'Newsletter', labelAr: 'النشرة' }
];

export const ScrollSpyDots: React.FC<ScrollSpyDotsProps> = ({ locale }) => {
  const [activeSection, setActiveSection] = useState<string>('hero');
  const isRtl = locale === 'ar';

  const intersectionRatiosRef = useRef<Map<string, number>>(new Map());

  const handleScrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;

    const headerOffset = 76;
    const elementPosition = el.getBoundingClientRect().top;
    const offsetPosition = elementPosition + document.documentElement.scrollTop - headerOffset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
  }, []);

  // Multi-threshold IntersectionObserver for highly reactive section detection
  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          intersectionRatiosRef.current.set(entry.target.id, entry.intersectionRatio);
        });

        // Determine top active section based on intersection weights and viewport position
        let bestId = activeSection;
        let maxScore = -1;

        const windowHeight = window.innerHeight;
        const focalLine = windowHeight * 0.4; // User reading focus point

        SECTIONS.forEach((sec) => {
          const el = document.getElementById(sec.id);
          if (!el) return;

          const rect = el.getBoundingClientRect();
          const ratio = intersectionRatiosRef.current.get(sec.id) || 0;

          // Priority score combines intersection ratio and proximity to reading focal line
          let score = ratio * 100;
          if (rect.top <= focalLine && rect.bottom >= focalLine) {
            score += 200; // Element directly covers the reading focal area
          }

          if (score > maxScore) {
            maxScore = score;
            bestId = sec.id;
          }
        });

        if (bestId && maxScore > 0) {
          setActiveSection((prev) => (prev !== bestId ? bestId : prev));
        }
      },
      {
        threshold: [0, 0.1, 0.25, 0.4, 0.6, 0.8, 1.0],
        rootMargin: '-10% 0px -20% 0px'
      }
    );

    SECTIONS.forEach((sec) => {
      const el = document.getElementById(sec.id);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const activeIndex = SECTIONS.findIndex((s) => s.id === activeSection);

  // Keyboard navigation support
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = Math.min(SECTIONS.length - 1, activeIndex + 1);
      handleScrollTo(SECTIONS[nextIndex].id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = Math.max(0, activeIndex - 1);
      handleScrollTo(SECTIONS[prevIndex].id);
    }
  };

  return (
    <nav
      id="page-scroll-spy"
      aria-label={isRtl ? 'التنقل السريع بين الأقسام' : 'Page Section Navigation'}
      onKeyDown={handleKeyDown}
      className="fixed right-3 sm:right-5 rtl:right-auto rtl:left-3 rtl:sm:left-5 top-1/2 -translate-y-1/2 z-30 hidden lg:flex flex-col items-center gap-1.5 p-2 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md rounded-full border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-950/10 transition-all duration-300 print:hidden select-none"
    >
      {/* Background connecting rail with reactive animated glow indicator */}
      <div className="absolute top-4 bottom-4 w-[2px] bg-slate-200/70 dark:bg-slate-800/80 rounded-full pointer-events-none -z-0" />

      {SECTIONS.map((section, idx) => {
        const isActive = activeSection === section.id;
        const isNeighbor = Math.abs(idx - activeIndex) === 1;
        const label = isRtl ? section.labelAr : section.labelEn;
        const orderNumber = (idx + 1).toString().padStart(2, '0');

        return (
          <button
            key={section.id}
            type="button"
            onClick={() => handleScrollTo(section.id)}
            aria-label={`${label} ${isActive ? (isRtl ? '(القسم الحالي)' : '(current section)') : ''}`}
            aria-current={isActive ? 'true' : undefined}
            className="group relative flex items-center justify-center p-1 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-full transition-transform active:scale-90"
          >
            {/* Reactive Tooltip Badge with section order & state */}
            <div
              className={`absolute right-full mr-3.5 rtl:right-auto rtl:left-full rtl:mr-0 rtl:ml-3.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 shadow-xl backdrop-blur-md whitespace-nowrap pointer-events-none transition-all duration-200 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 rtl:-translate-x-2 rtl:group-hover:translate-x-0 flex items-center gap-2 border border-slate-700/50 dark:border-slate-300/80 ${
                isRtl ? 'origin-left' : 'origin-right'
              }`}
            >
              <span className="font-mono text-[10px] text-indigo-400 dark:text-indigo-600 font-bold">
                {orderNumber}
              </span>
              <span>{label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dark:bg-emerald-500 animate-pulse" />
              )}
            </div>

            {/* Viewport Reactive Indicator Dot / Pill */}
            <span
              className={`block rounded-full transition-all duration-300 ease-out relative ${
                isActive
                  ? 'h-6 w-2.5 bg-gradient-to-b from-indigo-500 to-indigo-600 dark:from-indigo-400 dark:to-indigo-500 shadow-md shadow-indigo-500/50 ring-4 ring-indigo-500/20 dark:ring-indigo-400/20'
                  : isNeighbor
                  ? 'h-2.5 w-2.5 bg-indigo-300/70 dark:bg-indigo-700/70 hover:bg-indigo-400 dark:hover:bg-indigo-500 group-hover:scale-125'
                  : 'h-2 w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-500 group-hover:scale-125'
              }`}
            >
              {/* Internal micro-pulse for the active dot */}
              {isActive && (
                <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 mx-auto w-1 h-2 rounded-full bg-white/80 animate-pulse" />
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
