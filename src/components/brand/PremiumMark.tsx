import React from 'react';

export type PremiumMarkVariant = 'spark' | 'launch' | 'voucher' | 'booking' | 'links';

interface PremiumMarkProps {
  variant?: PremiumMarkVariant;
  className?: string;
  title?: string;
  style?: React.CSSProperties;
}

/** Small, brand-neutral vector accents for decorative UI details. */
export const PremiumMark: React.FC<PremiumMarkProps> = ({
  variant = 'spark',
  className = '',
  title,
  style,
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    style={style}
    role={title ? 'img' : undefined}
    aria-label={title}
    aria-hidden={title ? undefined : true}
  >
    {variant === 'launch' && (
      <>
        <path d="M5 19c2.2-.2 3.7-1.1 4.6-2.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M13.4 4.2c2.3-1.1 4.7-1.3 6.4-1.1.2 1.7 0 4.1-1.1 6.4-1 1.9-2.5 3.5-4.5 4.5l-3.2-3.2c1-2 2.6-3.5 4.5-4.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="m11 13-3.5.6L6 15.1l3.6.3.3 3.6 1.5-1.5.6-3.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <circle cx="16.8" cy="7.2" r="1.2" fill="currentColor" />
      </>
    )}
    {variant === 'voucher' && (
      <path d="M4 7.5h16v3a2 2 0 0 0 0 3v3H4v-3a2 2 0 0 0 0-3v-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    )}
    {variant === 'booking' && (
      <>
        <rect x="4" y="5.5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 3.5v4M16 3.5v4M4 9.5h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M8 13h.01M12 13h.01M16 13h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </>
    )}
    {variant === 'links' && (
      <>
        <path d="m9.5 14.5-1.2 1.2a3.2 3.2 0 1 1-4.5-4.5l2.6-2.6a3.2 3.2 0 0 1 4.5 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="m14.5 9.5 1.2-1.2a3.2 3.2 0 1 1 4.5 4.5l-2.6 2.6a3.2 3.2 0 0 1-4.5 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="m8.5 15.5 7-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </>
    )}
    {variant === 'spark' && (
      <>
        <path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" fill="currentColor" />
      </>
    )}
  </svg>
);
