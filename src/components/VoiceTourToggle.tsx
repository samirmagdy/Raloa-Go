import React from 'react';
import { Headphones, Volume2, RotateCcw, X, Mic } from 'lucide-react';
import { Locale } from '../types';
import { Tooltip } from './Tooltip';

interface VoiceTourToggleProps {
  enabled: boolean;
  isSpeaking: boolean;
  onToggle: () => void;
  currentSection?: string;
  onReplay?: () => void;
  variant?: 'header' | 'mobile' | 'floating';
  className?: string;
  locale?: Locale;
}

const SECTION_LABELS: Record<string, { en: string; ar: string }> = {
  hero: { en: 'Introduction', ar: 'المقدمة' },
  benefits: { en: 'Platform Trust', ar: 'ثقة المنصة' },
  templates: { en: 'Templates & Themes', ar: 'القوالب والتصاميم' },
  'how-it-works': { en: 'How It Works', ar: 'كيف تعمل المنصة' },
  features: { en: 'Creator Features', ar: 'مميزات المبدعين' },
  testimonials: { en: 'Creator Stories', ar: 'قصص المبدعين' },
  pricing: { en: 'Pricing Plans', ar: 'خطط الأسعار' },
  faq: { en: 'Support & FAQ', ar: 'الأسئلة الشائعة' },
  newsletter: { en: 'Creator Newsletter', ar: 'النشرة البريدية' }
};

export const VoiceTourToggle: React.FC<VoiceTourToggleProps> = ({
  enabled,
  isSpeaking,
  onToggle,
  currentSection = 'hero',
  onReplay,
  variant = 'header',
  className = '',
  locale = 'en'
}) => {
  const isRtl = locale === 'ar';
  const sectionTitle = SECTION_LABELS[currentSection]?.[locale] || currentSection;

  const tooltipLabel = enabled
    ? isRtl
      ? 'إيقاف الجولة الصوتية'
      : 'Stop voice-over tour'
    : isRtl
      ? 'تشغيل الجولة الصوتية (تعليق صوتي عند التمرير)'
      : 'Start voice-over tour (scroll narration)';

  if (variant === 'mobile') {
    return (
      <div className={`w-full ${className}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Headphones className={`w-3.5 h-3.5 ${enabled ? 'text-indigo-500' : 'text-slate-400'}`} />
            <span>{isRtl ? 'الجولة الصوتية' : 'Voice-over Tour'}</span>
          </span>
          {enabled && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <span className={`w-1.5 h-1.5 rounded-full bg-indigo-500 ${isSpeaking ? 'animate-ping' : ''}`} />
              {isSpeaking ? (isRtl ? 'جارٍ السرد...' : 'Speaking...') : (isRtl ? 'مفعّلة' : 'Active')}
            </span>
          )}
        </div>

        <div
          role="radiogroup"
          aria-label={isRtl ? 'الجولة الصوتية' : 'Voice-over Tour Setting'}
          className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80"
        >
          <button
            type="button"
            role="radio"
            aria-checked={enabled}
            onClick={() => {
              if (!enabled) onToggle();
            }}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              enabled
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>{isRtl ? 'تشغيل' : 'On'}</span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={!enabled}
            onClick={() => {
              if (enabled) onToggle();
            }}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              !enabled
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <X className="w-3.5 h-3.5" />
            <span>{isRtl ? 'إيقاف' : 'Off'}</span>
          </button>
        </div>
      </div>
    );
  }

  // Floating Player Widget (visible when tour is active)
  if (variant === 'floating') {
    if (!enabled) return null;

    return (
      <aside
        id="voice-tour-controller"
        aria-label={isRtl ? 'عناصر التحكم في الجولة الصوتية' : 'Voice-over tour player'}
        className="fixed bottom-24 sm:bottom-20 left-4 sm:left-6 z-40 flex items-center gap-3 px-4 py-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-indigo-100 dark:border-indigo-900/50 text-xs text-slate-800 dark:text-slate-200 transition-all duration-300 animate-in slide-in-from-bottom-3 print:hidden"
      >
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
            <Volume2 className={`w-4 h-4 ${isSpeaking ? 'animate-pulse' : ''}`} />
            {isSpeaking && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-[11px] uppercase tracking-wider">
                {isRtl ? 'جولة صوتية' : 'Voice Tour'}
              </span>
              <span className="text-[10px] text-slate-400">•</span>
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                {sectionTitle}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {isSpeaking
                ? (isRtl ? 'يتم السرد الصوتي الآن...' : 'Narrating current section...')
                : (isRtl ? 'مرر للتنقل بين الأقسام' : 'Scroll to explore sections')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 pl-2 rtl:pl-0 rtl:pr-2 border-l rtl:border-l-0 rtl:border-r border-slate-200 dark:border-slate-800">
          {onReplay && (
            <button
              type="button"
              onClick={onReplay}
              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={isRtl ? 'إعادة تشغيل المقطع الحالي' : 'Replay section narration'}
              aria-label={isRtl ? 'إعادة تشغيل المقطع الحالي' : 'Replay narration'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onToggle}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={isRtl ? 'إنهاء الجولة الصوتية' : 'Stop voice tour'}
            aria-label={isRtl ? 'إنهاء الجولة الصوتية' : 'Close voice tour'}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>
    );
  }

  // Standard Header button variant
  const titleText = enabled
    ? isRtl
      ? 'إيقاف الجولة الصوتية'
      : 'End Spoken Tour'
    : isRtl
      ? 'تشغيل الجولة الصوتية'
      : 'Start Guided Tour';

  const descText = enabled
    ? isRtl
      ? 'إيقاف التعليق الصوتي التلقائي'
      : 'Stop automatic spoken narration'
    : isRtl
      ? 'استمع لسرد صوتي ذكي يواكب تمريرك عبر أقسام الموقع'
      : 'Listen to narrated audio walkthrough as you explore sections';

  return (
    <Tooltip
      content={titleText}
      description={descText}
      shortcut="V"
      position="bottom"
    >
      <button
        type="button"
        onClick={onToggle}
        className={`relative p-2 rounded-full border transition-all cursor-pointer ${
          enabled
            ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300 shadow-2xs'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700'
        } ${className}`}
        aria-label={tooltipLabel}
        aria-pressed={enabled}
      >
        <Headphones className={`w-4 h-4 ${enabled && isSpeaking ? 'animate-bounce' : ''}`} />
        {enabled && (
          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600" />
          </span>
        )}
      </button>
    </Tooltip>
  );
};
