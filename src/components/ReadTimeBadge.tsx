import React from 'react';
import { Clock } from 'lucide-react';
import { Locale } from '../types';

interface ReadTimeBadgeProps {
  formatted: string;
  wordCount?: number;
  locale?: Locale;
  className?: string;
}

export const ReadTimeBadge: React.FC<ReadTimeBadgeProps> = ({
  formatted,
  wordCount,
  locale = 'en',
  className = ''
}) => {
  const isRtl = locale === 'ar';
  const tooltipText = wordCount
    ? isRtl
      ? `حوالي ${wordCount} كلمة`
      : `Approx. ${wordCount} words`
    : undefined;

  return (
    <span
      title={tooltipText}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-[12px] font-semibold bg-indigo-50/90 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-100/90 dark:border-indigo-800/80 shadow-2xs select-none transition-all hover:bg-indigo-100/80 dark:hover:bg-indigo-900/60 ${className}`}
    >
      <Clock className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
      <span>{formatted}</span>
    </span>
  );
};
