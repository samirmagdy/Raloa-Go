import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LayoutGrid, PenTool, Send, Check, CheckCircle2 } from 'lucide-react';
import { Locale } from '../types';
import { dictionary } from '../data/content';
import { calculateReadingTime } from '../utils/readingTime';
import { ReadTimeBadge } from './ReadTimeBadge';

interface HowItWorksProps {
  locale: Locale;
}

export const HowItWorks: React.FC<HowItWorksProps> = ({ locale }) => {
  const isRtl = locale === 'ar';
  const t = dictionary[locale].howItWorksSection;

  const sectionRef = useRef<HTMLElement>(null);
  const stepCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [readingProgress, setReadingProgress] = useState<number>(33);

  // Calculate estimated reading time for all guide content
  const sectionContent = [
    t.eyebrow,
    t.headline,
    t.subheadline,
    ...t.steps.map((s) => `${s.title} ${s.body}`),
    t.doodleText
  ];
  const readTime = calculateReadingTime(sectionContent, locale);

  const steps = [
    {
      num: 1,
      shortLabel: isRtl ? 'اختيار القالب' : 'Template',
      icon: <LayoutGrid className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
      title: t.steps[0].title,
      body: t.steps[0].body,
      color: 'bg-indigo-600 text-white'
    },
    {
      num: 2,
      shortLabel: isRtl ? 'إضافة المحتوى' : 'Content',
      icon: <PenTool className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
      title: t.steps[1].title,
      body: t.steps[1].body,
      color: 'bg-blue-600 text-white'
    },
    {
      num: 3,
      shortLabel: isRtl ? 'النشر والانطلاق' : 'Launch',
      icon: <Send className="w-5 h-5 text-violet-600 dark:text-violet-400" />,
      title: t.steps[2].title,
      body: t.steps[2].body,
      color: 'bg-violet-600 text-white'
    }
  ];

  // Dynamic reading position and active step tracking
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof window === 'undefined') return;

    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const readingLine = windowHeight * 0.45;

      let closestStep = 1;
      let minDistance = Infinity;

      stepCardRefs.current.forEach((card, idx) => {
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const cardCenter = rect.top + rect.height / 2;
        const dist = Math.abs(cardCenter - readingLine);

        if (rect.top <= readingLine && rect.bottom >= readingLine) {
          closestStep = idx + 1;
          minDistance = -1;
        } else if (dist < minDistance && minDistance !== -1) {
          minDistance = dist;
          closestStep = idx + 1;
        }
      });

      setActiveStep(closestStep);
      setReadingProgress(closestStep === 1 ? 33 : closestStep === 2 ? 66 : 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  // Smooth scroll to a selected step when user clicks on the indicator
  const scrollToStep = useCallback((stepNum: number) => {
    const targetCard = stepCardRefs.current[stepNum - 1];
    if (!targetCard) return;

    const headerOffset = 100;
    const elementPosition = targetCard.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
    setActiveStep(stepNum);
    setReadingProgress(stepNum === 1 ? 33 : stepNum === 2 ? 66 : 100);
  }, []);

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="py-20 md:py-28 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800/80 relative overflow-hidden transition-colors duration-200"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header with Doodle & Estimated Read Time */}
        <div className="relative mb-10 md:mb-14">
          <div className="max-w-[640px]">
            <div className="flex items-center gap-2.5 mb-2.5 flex-wrap">
              <span className="text-[12px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {t.eyebrow}
              </span>
              <span className="text-slate-300 dark:text-slate-700 select-none">•</span>
              <ReadTimeBadge
                formatted={readTime.formatted}
                wordCount={readTime.wordCount}
                locale={locale}
              />
            </div>
            <h2 className="text-[34px] sm:text-[42px] md:text-[46px] font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-tight">
              {t.headline}
            </h2>
            <p className="text-[16px] sm:text-[18px] text-slate-600 dark:text-slate-300 mt-2 font-normal">
              {t.subheadline}
            </p>
          </div>

          {/* Right Floating Doodle ("From idea to impact in minutes") */}
          <div className="hidden lg:flex items-center gap-3 absolute top-2 right-4 text-indigo-600 dark:text-indigo-400 select-none pointer-events-none">
            <div className="relative">
              <span className="text-[15px] font-bold italic tracking-tight font-serif text-indigo-700 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/80 px-3.5 py-1.5 rounded-full border border-indigo-100 dark:border-indigo-800 shadow-2xs rotate-2 block">
                {t.doodleText}
              </span>
              <svg
                width="70"
                height="45"
                viewBox="0 0 70 45"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-indigo-500 dark:text-indigo-400 absolute -bottom-6 right-2 rtl:left-2 rtl:right-auto rtl:scale-x-[-1]"
              >
                <path
                  d="M10 5C25 15 45 35 60 22"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeDasharray="4 2"
                />
                <path
                  d="M50 16L62 21L58 32"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Section-Specific Reading Progress Indicator Widget */}
        <div
          id="how-it-works-reading-tracker"
          className="mb-12 p-3 sm:p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/90 shadow-2xs backdrop-blur-xs transition-all duration-200"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            {/* Active Step Badge & Current Step Title */}
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] sm:text-xs font-extrabold bg-indigo-600 text-white shadow-xs shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span>
                  {isRtl
                    ? `الخطوة ${activeStep} من 3`
                    : `Step ${activeStep} of 3`}
                </span>
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {steps[activeStep - 1]?.title}
              </span>
            </div>

            {/* Reading Progress Percentage */}
            <div className="flex items-center gap-2 self-start sm:self-auto text-xs text-slate-500 dark:text-slate-400 font-semibold">
              <span>{isRtl ? 'نسبة إنجاز الدليل:' : 'Guide Progress:'}</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 shadow-2xs">
                {readingProgress}%
              </span>
            </div>
          </div>

          {/* 3-Segment Interactive Step Progress Bar */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {steps.map((s) => {
              const isPast = activeStep > s.num;
              const isCurrent = activeStep === s.num;

              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => scrollToStep(s.num)}
                  aria-label={`${s.title} - ${isCurrent ? (isRtl ? 'الخطوة النشطة' : 'Active step') : isPast ? (isRtl ? 'مكتمل' : 'Completed') : (isRtl ? 'قادم' : 'Upcoming')}`}
                  className={`flex items-center gap-2 sm:gap-2.5 p-2 sm:p-2.5 rounded-xl text-left rtl:text-right transition-all cursor-pointer group ${
                    isCurrent
                      ? 'bg-white dark:bg-slate-800 shadow-xs border border-indigo-300 dark:border-indigo-600 ring-2 ring-indigo-500/20'
                      : isPast
                      ? 'bg-white/60 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70'
                      : 'bg-slate-100/70 dark:bg-slate-850 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Step Number or Check */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-transform group-hover:scale-105 ${
                      isCurrent
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : isPast
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {isPast ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : s.num}
                  </div>

                  {/* Step Quick Label */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[11px] sm:text-xs font-bold truncate ${
                        isCurrent
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : isPast
                          ? 'text-slate-700 dark:text-slate-300'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {s.shortLabel}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Continuous Progress Track */}
          <div className="mt-3 w-full h-1.5 bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-violet-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${readingProgress}%` }}
            />
          </div>
        </div>

        {/* 3 Steps Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          
          {/* Connecting line (Desktop) */}
          <div className="hidden md:block absolute top-[52px] left-[15%] right-[15%] h-[3px] bg-slate-200 dark:bg-slate-800 -z-0 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-violet-500 transition-all duration-500"
              style={{
                width: activeStep === 1 ? '20%' : activeStep === 2 ? '65%' : '100%'
              }}
            />
          </div>

          {steps.map((step, idx) => {
            const isCurrent = activeStep === step.num;
            const isPast = activeStep > step.num;

            return (
              <div
                key={step.num}
                ref={(el) => { stepCardRefs.current[idx] = el; }}
                id={`how-it-works-step-${step.num}`}
                onClick={() => scrollToStep(step.num)}
                className={`relative z-10 flex flex-col items-center md:items-start text-center md:text-left rtl:md:text-right p-6 sm:p-7 rounded-3xl transition-all duration-300 cursor-pointer ${
                  isCurrent
                    ? 'bg-white dark:bg-slate-900 border-2 border-indigo-500/80 dark:border-indigo-400/80 shadow-xl shadow-indigo-500/10 ring-4 ring-indigo-500/10 scale-[1.02]'
                    : isPast
                    ? 'bg-white/80 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:border-slate-300'
                    : 'bg-white/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 opacity-80 hover:opacity-100 hover:border-slate-200'
                }`}
              >
                {/* Step Status Badge */}
                <div className="mb-4">
                  {isCurrent ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping" />
                      <span>{isRtl ? 'الخطوة النشطة الآن' : 'Currently Reading'}</span>
                    </span>
                  ) : isPast ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{isRtl ? 'تمت القراءة' : 'Completed'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-850/60 border border-slate-200/60 dark:border-slate-800">
                      <span>{isRtl ? 'الخطوة القادمة' : 'Upcoming Step'}</span>
                    </span>
                  )}
                </div>

                {/* Step Number + Icon Badge */}
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-12 h-12 rounded-full ${step.color} font-extrabold text-[18px] flex items-center justify-center shadow-md ring-4 ring-white dark:ring-slate-950 transition-transform ${isCurrent ? 'scale-110' : ''}`}>
                    {isPast ? <Check className="w-5 h-5 stroke-[3]" /> : step.num}
                  </div>
                  <div className={`w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-900 border flex items-center justify-center shadow-2xs transition-colors ${isCurrent ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-800'}`}>
                    {step.icon}
                  </div>
                </div>

                {/* Title & Body */}
                <h3 className="font-extrabold text-[20px] text-[#0F172A] dark:text-white tracking-tight mb-2">
                  {step.title}
                </h3>
                <p className="text-[14px] sm:text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed font-normal max-w-sm">
                  {step.body}
                </p>
              </div>
            );
          })}

        </div>

      </div>
    </section>
  );
};

