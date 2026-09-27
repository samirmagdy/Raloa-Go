import React from 'react';

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
