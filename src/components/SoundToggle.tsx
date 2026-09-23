import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Locale } from '../types';
import { Tooltip } from './Tooltip';

interface SoundToggleProps {
  enabled: boolean;
  onToggle: () => void;
  variant?: 'header' | 'mobile';
  className?: string;
  locale?: Locale;
}

export const SoundToggle: React.FC<SoundToggleProps> = ({
  enabled,
  onToggle,
  variant = 'header',
  className = '',
  locale = 'en'
}) => {
  const isRtl = locale === 'ar';

  const label = enabled
    ? isRtl
      ? 'كتم الصوت المحيطي (M)'
      : 'Disable ambient sound (M)'
    : isRtl
      ? 'تشغيل الصوت المحيطي (M)'
      : 'Enable ambient sound (M)';

  if (variant === 'mobile') {
    return (
      <div className={`w-full ${className}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            {enabled ? (
              <Volume2 className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{isRtl ? 'الصوت المحيطي' : 'Ambient Audio'}</span>
          </span>
          {enabled && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              {isRtl ? 'يعمل' : 'Live'}
            </span>
          )}
        </div>

        <div
          role="radiogroup"
          aria-label={isRtl ? 'الصوت المحيطي' : 'Ambient Audio Setting'}
          className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80"
        >
          <button
            type="button"
            role="radio"
            aria-checked={enabled}
            onClick={() => {
              if (!enabled) onToggle();
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[13px] font-semibold transition-all duration-150 cursor-pointer ${
              enabled
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{isRtl ? 'تشغيل' : 'On'}</span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={!enabled}
            onClick={() => {
              if (enabled) onToggle();
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[13px] font-semibold transition-all duration-150 cursor-pointer ${
              !enabled
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <VolumeX className="w-3.5 h-3.5" />
            <span>{isRtl ? 'مكتوم' : 'Muted'}</span>
          </button>
        </div>
      </div>
    );
  }

  // Desktop Header variant
  const tooltipTitle = enabled
    ? isRtl
      ? 'كتم الصوت المحيطي'
      : 'Mute Ambient Audio'
    : isRtl
      ? 'تشغيل الصوت المحيطي'
      : 'Enable Ambient Audio';

  const tooltipDesc = enabled
    ? isRtl
      ? 'إيقاف مولد الترددات الصوتية المهدئة للتركيز'
      : 'Mute continuous background synthesizer tones'
    : isRtl
      ? 'تشغيل صوت محيطي هادئ يساعد على التركيز والإبداع'
      : 'Play generative ambient background tones for focus';

  return (
    <Tooltip
      content={tooltipTitle}
      description={tooltipDesc}
      shortcut="M"
      position="bottom"
    >
      <button
        type="button"
        id="global-sound-toggle-btn"
        onClick={onToggle}
        aria-label={label}
        className={`relative p-2 rounded-full border transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${
          enabled
            ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
            : 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
        } ${className}`}
      >
        {enabled ? (
          <div className="flex items-center justify-center">
            <Volume2 className="w-4 h-4" />
            {/* Subtle animated sound wave bars indicator */}
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
          </div>
        ) : (
          <VolumeX className="w-4 h-4" />
        )}
      </button>
    </Tooltip>
  );
};
