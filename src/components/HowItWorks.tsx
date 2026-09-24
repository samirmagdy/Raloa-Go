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
  const stepCardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [activeStep, setActiveStep] = useState<number>(1);

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
  }, []);

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="scroll-mt-20 py-10 sm:py-20 md:py-24 bg-slate-50/70 dark:bg-slate-950 border-b border-slate-200/70 dark:border-slate-800/80 relative overflow-hidden transition-colors duration-200"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-7 sm:mb-11">
          <div>
            <div className="flex items-center gap-2.5 mb-3 flex-wrap">
              <span className="text-[12px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {t.eyebrow}
              </span>
              <span aria-hidden="true" className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
              <ReadTimeBadge
                formatted={readTime.formatted}
                wordCount={readTime.wordCount}
                locale={locale}
              />
            </div>
            <h2 className="text-[28px] sm:text-[42px] md:text-[48px] font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-[1.08]">
              {t.headline}
            </h2>
            <p className="text-[16px] sm:text-[18px] text-slate-600 dark:text-slate-300 mt-3 font-normal leading-relaxed max-w-2xl">
              {t.subheadline}
            </p>
          </div>
        </div>

        {/* 3 Steps Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-5 lg:gap-6 relative">
          
          {/* Connecting line (Desktop) */}
          <div className="hidden md:block absolute top-[49px] left-[14%] right-[14%] h-px bg-slate-200 dark:bg-slate-800 z-0 rounded-full overflow-hidden">
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
              <button
                key={step.num}
                type="button"
                ref={(el) => { stepCardRefs.current[idx] = el; }}
                id={`how-it-works-step-${step.num}`}
                onClick={() => scrollToStep(step.num)}
                className={`relative z-10 w-full min-h-0 md:min-h-[250px] flex flex-col items-center md:items-start text-center md:text-left rtl:md:text-right p-4 sm:p-6 rounded-3xl transition-all duration-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${
                  isCurrent
                    ? 'bg-white dark:bg-slate-900 border-2 border-indigo-500/80 dark:border-indigo-400/80 shadow-lg shadow-indigo-500/10 ring-4 ring-indigo-500/10'
                    : isPast
                    ? 'bg-white/80 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:border-slate-300'
                    : 'bg-white/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 opacity-80 hover:opacity-100 hover:border-slate-200'
                }`}
              >
                {/* Step Status Badge */}
                <div className="mb-4">
                  {isCurrent ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
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
              </button>
            );
          })}

        </div>

      </div>
    </section>
  );
};
