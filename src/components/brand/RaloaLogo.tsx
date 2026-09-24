import React from 'react';

export type LogoVariant = 'horizontal' | 'mark' | 'wordmark';
export type LogoTheme = 'primary' | 'on-dark' | 'monochrome-black' | 'monochrome-white';
export type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

export interface RaloaLogoProps {
  className?: string;
  variant?: LogoVariant;
  theme?: LogoTheme;
  size?: LogoSize;
  isRtl?: boolean;
  showTagline?: boolean;
  width?: number;
  height?: number;
}

// Aspect ratios from the supplied RALOA brand asset pack.
const HORIZONTAL_ASPECT_RATIO = 630 / 280;
const MARK_ASPECT_RATIO = 649 / 680;
const WORDMARK_ASPECT_RATIO = 1180 / 320;

/**
 * Standalone Ribbon 'R' Monogram Mark
 * Uses the supplied official mark artwork without distorting its aspect ratio.
 */
export const RaloaMark: React.FC<{
  size?: number;
  className?: string;
  theme?: LogoTheme;
}> = ({ size = 36, className = '', theme = 'primary' }) => {
  const isMonoWhite = theme === 'monochrome-white';
  const isMonoBlack = theme === 'monochrome-black';
  const markWidth = Math.round(size * MARK_ASPECT_RATIO);

  if (isMonoWhite) {
    return (
      <img
        src="/brand/raloa-mark-white.webp"
        alt="RALOA Mark"
        width={markWidth}
        height={size}
        style={{ width: `${markWidth}px`, height: `${size}px` }}
        className={`shrink-0 object-contain select-none pointer-events-none ${className}`}
        draggable={false}
        loading="eager"
      />
    );
  }

  if (isMonoBlack) {
    return (
      <img
        src="/brand/raloa-mark-black.webp"
        alt="RALOA Mark"
        width={markWidth}
        height={size}
        style={{ width: `${markWidth}px`, height: `${size}px` }}
        className={`shrink-0 object-contain select-none pointer-events-none ${className}`}
        draggable={false}
        loading="eager"
      />
    );
  }

  // Primary 3D Gradient Ribbon Mark
  return (
    <img
      src="/brand/raloa-mark-black.webp"
      alt="RALOA Mark"
      width={markWidth}
      height={size}
      style={{ width: `${markWidth}px`, height: `${size}px` }}
      className={`shrink-0 object-contain select-none pointer-events-none ${className}`}
      draggable={false}
      loading="eager"
    />
  );
};

/**
 * Standalone 'RALOA' Wordmark component for backwards-compatibility
 */
export const RaloaWordmark: React.FC<{
  height?: number;
  className?: string;
  theme?: LogoTheme;
}> = ({ height = 22, className = '', theme = 'primary' }) => {
  const isDark = theme === 'on-dark' || theme === 'monochrome-white';
  const src = isDark
    ? '/brand/raloa-wordmark-white.webp'
    : theme === 'monochrome-black'
    ? '/brand/raloa-wordmark-black.webp'
    : '/brand/raloa-wordmark-navy.webp';
  const width = Math.round(height * WORDMARK_ASPECT_RATIO);

  return (
    <img
      src={src}
      alt="RALOA"
      width={width}
      height={height}
      style={{ width: `${width}px`, height: `${height}px` }}
      className={`shrink-0 object-contain select-none pointer-events-none ${className}`}
      draggable={false}
      loading="eager"
    />
  );
};

/**
 * Primary RALOA Logo Component
 * Uses the official brand assets with responsive scaling and auto dark-mode switching.
 */
export const RaloaLogo: React.FC<RaloaLogoProps> = ({
  className = '',
  variant = 'horizontal',
  theme,
  size = 'md',
  isRtl = false,
  showTagline = false,
  width,
  height
}) => {
  // Balanced sizing matrix
  const sizeMap: Record<LogoSize, { h: number; markSize: number }> = {
    sm: { h: 28, markSize: 28 },
    md: { h: 34, markSize: 34 },
    lg: { h: 42, markSize: 42 },
    xl: { h: 52, markSize: 52 }
  };

  const currentSize = sizeMap[size];
  const finalHeight = height || currentSize.h;
  const finalWidth = width || Math.round(finalHeight * HORIZONTAL_ASPECT_RATIO);

  // Variant: Standalone Mark
  if (variant === 'mark') {
    return (
      <RaloaMark
        size={width || height || currentSize.markSize}
        className={className}
        theme={theme}
      />
    );
  }

  // Variant: Wordmark only
  if (variant === 'wordmark') {
    return (
      <RaloaWordmark
        height={finalHeight}
        className={className}
        theme={theme}
      />
    );
  }

  // Variant: Full Horizontal Lockup (Mark + Wordmark)
  const renderLogoImage = () => {
    // Explicit on-dark theme
    if (theme === 'on-dark') {
      return (
        <img
          src="/brand/raloa-logo-horizontal-on-dark.png"
          alt="RALOA"
          width={finalWidth}
          height={finalHeight}
          style={{ width: `${finalWidth}px`, height: `${finalHeight}px` }}
          className={`shrink-0 object-contain select-none pointer-events-none ${className}`}
          draggable={false}
          loading="eager"
        />
      );
    }

    // Explicit monochrome white
    if (theme === 'monochrome-white') {
      return (
        <img
          src="/brand/raloa-logo-horizontal-on-dark.png"
          alt="RALOA"
          width={finalWidth}
          height={finalHeight}
          style={{ width: `${finalWidth}px`, height: `${finalHeight}px` }}
          className={`shrink-0 object-contain select-none pointer-events-none ${className}`}
          draggable={false}
          loading="eager"
        />
      );
    }

    // Explicit monochrome black
    if (theme === 'monochrome-black') {
      return (
        <img
          src="/brand/raloa-logo-horizontal-monochrome-black.png"
          alt="RALOA"
          width={finalWidth}
          height={finalHeight}
          style={{ width: `${finalWidth}px`, height: `${finalHeight}px` }}
          className={`shrink-0 object-contain select-none pointer-events-none ${className}`}
          draggable={false}
          loading="eager"
        />
      );
    }

    // Default / Primary: automatic dark mode switcher
    return (
      <>
        <img
          src="/brand/raloa-logo-horizontal-primary.png"
          alt="RALOA"
          width={finalWidth}
          height={finalHeight}
          style={{ width: `${finalWidth}px`, height: `${finalHeight}px` }}
          className={`dark:hidden shrink-0 object-contain select-none pointer-events-none ${className}`}
          draggable={false}
          loading="eager"
        />
        <img
          src="/brand/raloa-logo-horizontal-on-dark.png"
          alt="RALOA"
          width={finalWidth}
          height={finalHeight}
          style={{ width: `${finalWidth}px`, height: `${finalHeight}px` }}
          className={`hidden dark:block shrink-0 object-contain select-none pointer-events-none ${className}`}
          draggable={false}
          loading="eager"
        />
      </>
    );
  };

  if (!showTagline) {
    return (
      <div className="inline-flex items-center shrink-0">
        {renderLogoImage()}
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-start shrink-0">
      {renderLogoImage()}
      <span
        className={`text-[10px] font-semibold tracking-tight mt-1 ${
          theme === 'on-dark' || theme === 'monochrome-white'
            ? 'text-slate-400'
            : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {isRtl ? 'مواقع مصغرة تركز على التصميم' : 'Design-first mini-sites'}
      </span>
    </div>
  );
};
