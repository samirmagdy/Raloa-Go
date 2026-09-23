import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export const AnnotationCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  rotation?: string;
}> = ({ children, className = '', rotation = '-rotate-2' }) => {
  return (
    <div
      className={`inline-flex items-center px-3.5 py-1.5 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-indigo-100 dark:border-slate-800 shadow-[0_4px_16px_rgba(15,23,42,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)] text-[12px] font-semibold text-slate-800 dark:text-slate-200 ${rotation} ${className}`}
    >
      {children}
    </div>
  );
};

export const CurvedArrowDownRight: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    width="50"
    height="45"
    viewBox="0 0 50 45"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`text-indigo-500 ${className}`}
  >
    <path
      d="M8 8C18 6 36 12 38 34"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeDasharray="4 2"
    />
    <path
      d="M30 30L39 36L44 26"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CurvedArrowUpRight: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    width="50"
    height="45"
    viewBox="0 0 50 45"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`text-indigo-500 ${className}`}
  >
    <path
      d="M10 36C18 36 34 28 38 12"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeDasharray="4 2"
    />
    <path
      d="M30 14L40 9L44 20"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CurvedArrowDownLeft: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    width="50"
    height="45"
    viewBox="0 0 50 45"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`text-indigo-500 ${className}`}
  >
    <path
      d="M40 8C30 8 16 16 12 34"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeDasharray="4 2"
    />
    <path
      d="M20 30L10 36L6 26"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const FloatingMetricBadge: React.FC<{
  metric?: string;
  label?: string;
  className?: string;
}> = ({ metric = '+300%', label = 'More clicks', className = '' }) => {
  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800 shadow-[0_12px_32px_rgba(15,23,42,0.12)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center min-w-[100px] text-center ${className}`}
    >
      <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1.5">
        <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
      </div>
      <span className="text-[17px] font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">
        {metric}
      </span>
      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
        {label}
      </span>
    </div>
  );
};
