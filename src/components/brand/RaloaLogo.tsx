import React from 'react';

export type LogoVariant = 'horizontal' | 'mark' | 'wordmark';
export type LogoTheme = 'primary' | 'on-dark' | 'monochrome-black' | 'monochrome-white';
export type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

interface RaloaLogoProps {
  className?: string;
  variant?: LogoVariant;
  theme?: LogoTheme;
  size?: LogoSize;
  isRtl?: boolean;
  showTagline?: boolean;
  width?: number;
  height?: number;
}

/**
 * Precision Vector Mark: The Ribbon "R" Monogram
 * Faithfully matches the uploaded RALOA brand asset:
 * - Upper-left cyan-to-blue ribbon curve
 * - Midnight navy 3D optical fold
 * - Electric violet to fuchsia lower leg sweep
 * - Optional monochrome black / monochrome white silhouette
 */
export const RaloaMark: React.FC<{
  size?: number;
  className?: string;
  theme?: LogoTheme;
}> = ({ size = 36, className = '', theme = 'primary' }) => {
  const isMonoBlack = theme === 'monochrome-black';
  const isMonoWhite = theme === 'monochrome-white';
  const isMonochrome = isMonoBlack || isMonoWhite;
  const fillColor = isMonoWhite ? '#FFFFFF' : '#000000';

  if (isMonochrome) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 ${className}`}
        aria-label="RALOA Mark"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M 24 22
             C 38 10, 68 9, 88 13
             C 106 17, 114 34, 110 52
             C 106 68, 94 78, 82 82
             L 112 112
             C 110 116, 105 118, 98 118
             L 70 88
             C 64 88, 58 85, 54 80
             C 48 72, 44 58, 48 46
             C 52 34, 64 26, 78 26
             C 90 26, 98 34, 96 46
             C 94 56, 84 62, 72 62
             C 64 62, 58 56, 58 50
             C 58 44, 63 40, 69 40
             C 73 40, 76 43, 75 46
             C 71 46, 68 49, 70 52
             C 71 54, 76 55, 78 52
             C 80 49, 81 44, 76 38
             C 71 33, 62 33, 55 39
             C 47 47, 45 61, 50 74
             C 56 87, 67 98, 78 107
             L 66 112
             C 48 98, 32 84, 20 62
             C 12 44, 15 29, 24 22
             Z"
          fill={fillColor}
        />
      </svg>
    );
  }

  // Primary 3D Gradient Ribbon Mark
  const idPrefix = React.useId().replace(/:/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label="RALOA Mark"
    >
      <defs>
        {/* Cyan to Royal Blue gradient for the upper left ribbon */}
        <linearGradient id={`${idPrefix}-mark-blue`} x1="10%" y1="90%" x2="90%" y2="10%">
          <stop offset="0%" stopColor="#00D2FF" />
          <stop offset="35%" stopColor="#0070F3" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>

        {/* Deep midnight navy for the 3D optical fold */}
        <linearGradient id={`${idPrefix}-mark-fold`} x1="30%" y1="20%" x2="90%" y2="80%">
          <stop offset="0%" stopColor="#0A1128" />
          <stop offset="60%" stopColor="#141E46" />
          <stop offset="100%" stopColor="#2D1554" />
        </linearGradient>

        {/* Electric violet to fuchsia for the lower leg sweep */}
        <linearGradient id={`${idPrefix}-mark-purple`} x1="20%" y1="40%" x2="95%" y2="95%">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="50%" stopColor="#9333EA" />
          <stop offset="100%" stopColor="#C026D3" />
        </linearGradient>

        {/* Curvature gloss sheen */}
        <linearGradient id={`${idPrefix}-mark-sheen`} x1="20%" y1="10%" x2="70%" y2="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 1. Deep Midnight Navy Under-Fold & Leg Core */}
      <path
        d="M 52 38
           C 64 36, 82 36, 92 46
           C 100 56, 98 72, 88 82
           C 84 86, 78 88, 72 88
           L 104 116
           L 88 120
           L 64 88
           C 58 88, 52 84, 48 78
           C 44 72, 44 58, 48 46
           Z"
        fill={`url(#${idPrefix}-mark-fold)`}
      />

      {/* 2. Cyan-to-Blue Main Ribbon & Upper Arch */}
      <path
        d="M 24 94
           C 15 65, 18 36, 34 22
           C 48 10, 70 9, 88 13
           C 104 17, 112 32, 108 48
           C 104 64, 90 74, 74 74
           C 56 74, 46 62, 48 48
           C 50 36, 62 28, 76 28
           C 86 28, 93 34, 91 44
           C 89 52, 81 56, 73 56
           C 66 56, 62 51, 62 46
           C 62 42, 65 38, 70 38
           C 73 38, 75 40, 74 42
           C 68 42, 65 46, 67 50
           C 69 54, 76 55, 78 51
           C 84 47, 85 39, 79 32
           C 72 25, 59 25, 49 33
           C 39 43, 37 60, 43 76
           C 49 90, 60 102, 72 112
           L 60 116
           C 46 104, 34 94, 24 94
           Z"
        fill={`url(#${idPrefix}-mark-blue)`}
      />

      {/* 3. Electric Violet / Purple Lower Flow */}
      <path
        d="M 44 74
           C 56 90, 72 104, 88 114
           L 106 108
           L 84 80
           C 76 86, 68 88, 58 86
           C 50 84, 46 80, 44 74
           Z"
        fill={`url(#${idPrefix}-mark-purple)`}
      />

      {/* 4. Diagonal Leg Terminal */}
      <path
        d="M 84 78
           L 112 110
           C 110 115, 105 118, 98 118
           L 74 88
           C 78 84, 81 81, 84 78
           Z"
        fill={`url(#${idPrefix}-mark-purple)`}
      />

      {/* 5. Surface Gloss Highlight */}
      <path
        d="M 36 24
           C 48 14, 68 13, 84 17
           C 76 15, 52 16, 40 26
           C 28 38, 26 62, 32 82
           C 24 62, 26 36, 36 24
           Z"
        fill={`url(#${idPrefix}-mark-sheen)`}
      />
    </svg>
  );
};

/**
 * Precision Vector Wordmark: "RALOA"
 * Accurately reproduces the exact custom font from uploaded assets:
 * - 'R': Rounded top-left corner, horizontal top bar, rounded bowl, curved leg
 * - 'A': Inverted chevron (no horizontal crossbar) with floating circular dot in center
 * - 'L': Clean modern vertical stem curving 90° into horizontal foot
 * - 'O': Symmetrical geometric circle/oval
 * - 'A': Second chevron with floating circular dot
 */
export const RaloaWordmark: React.FC<{
  height?: number;
  className?: string;
  theme?: LogoTheme;
}> = ({ height = 24, className = '', theme = 'primary' }) => {
  const idPrefix = React.useId().replace(/:/g, '');
  
  // Aspect ratio of wordmark "RALOA" viewBox: 310 x 58 (approx 5.34 : 1)
  const calculatedWidth = height * 5.34;

  // Determine colors based on theme
  const isCustomTheme = theme === 'on-dark' || theme === 'monochrome-white' || theme === 'monochrome-black';
  const customColor =
    theme === 'on-dark' || theme === 'monochrome-white'
      ? '#FFFFFF'
      : theme === 'monochrome-black'
      ? '#000000'
      : undefined;

  const letterColor = customColor || 'currentColor';

  const useGradientDots = theme === 'primary';
  const dotFill = useGradientDots
    ? `url(#${idPrefix}-wordmark-dot)`
    : letterColor;

  return (
    <svg
      width={calculatedWidth}
      height={height}
      viewBox="0 0 310 58"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${isCustomTheme ? '' : 'text-[#0B132B] dark:text-white'} ${className}`}
      aria-label="RALOA"
    >
      {useGradientDots && (
        <defs>
          <linearGradient id={`${idPrefix}-wordmark-dot`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00D2FF" />
            <stop offset="50%" stopColor="#0070F3" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
      )}

      {/* --- LETTER 'R' (x: 4 to 56) --- */}
      <path
        d="M 6 12
           C 6 6, 12 2, 19 2
           L 38 2
           C 49 2, 57 9, 57 20
           C 57 30, 49 37, 39 38
           L 57 56
           L 44 56
           L 29 40
           L 18 40
           L 18 56
           L 6 56
           Z
           M 18 12
           L 18 30
           L 36 30
           C 42 30, 46 26, 46 21
           C 46 16, 42 12, 36 12
           Z"
        fill={letterColor}
      />

      {/* --- LETTER 'A' (x: 64 to 122) --- */}
      {/* Outer Chevron Triangle (No crossbar) */}
      <path
        d="M 93 2
           C 96 2, 98 4, 100 8
           L 122 56
           L 109 56
           L 93 18
           L 77 56
           L 64 56
           L 86 8
           C 88 4, 90 2, 93 2
           Z"
        fill={letterColor}
      />
      {/* Floating Circular Dot inside 'A' */}
      <circle
        cx="93"
        cy="40"
        r="5.5"
        fill={dotFill}
      />

      {/* --- LETTER 'L' (x: 130 to 174) --- */}
      <path
        d="M 130 2
           L 142 2
           L 142 44
           L 174 44
           L 174 56
           L 142 56
           C 135 56, 130 51, 130 44
           Z"
        fill={letterColor}
      />

      {/* --- LETTER 'O' (x: 182 to 238) --- */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 210 2
           C 226 2, 238 14, 238 29
           C 238 44, 226 56, 210 56
           C 194 56, 182 44, 182 29
           C 182 14, 194 2, 210 2
           Z
           M 210 13
           C 201 13, 194 20, 194 29
           C 194 38, 201 45, 210 45
           C 219 45, 226 38, 226 29
           C 226 20, 219 13, 210 13
           Z"
        fill={letterColor}
      />

      {/* --- LETTER 'A' (x: 246 to 304) --- */}
      {/* Outer Chevron Triangle */}
      <path
        d="M 275 2
           C 278 2, 280 4, 282 8
           L 304 56
           L 291 56
           L 275 18
           L 259 56
           L 246 56
           L 268 8
           C 270 4, 272 2, 275 2
           Z"
        fill={letterColor}
      />
      {/* Floating Circular Dot inside second 'A' */}
      <circle
        cx="275"
        cy="40"
        r="5.5"
        fill={dotFill}
      />
    </svg>
  );
};

/**
 * Primary RALOA Logo Component
 * Combines the Ribbon 'R' Mark with the geometric 'RALOA' Wordmark
 */
export const RaloaLogo: React.FC<RaloaLogoProps> = ({
  className = '',
  variant = 'horizontal',
  theme = 'primary',
  size = 'md',
  isRtl = false,
  showTagline = false,
  width,
  height
}) => {
  // Sizing matrix for visual balance
  const sizeConfig = {
    sm: { markSize: 28, wordmarkHeight: 18, textGap: 'gap-2.5' },
    md: { markSize: 36, wordmarkHeight: 22, textGap: 'gap-3' },
    lg: { markSize: 44, wordmarkHeight: 26, textGap: 'gap-3.5' },
    xl: { markSize: 56, wordmarkHeight: 32, textGap: 'gap-4' }
  };

  const currentSize = sizeConfig[size];
  const finalMarkSize = height ? height * 1.3 : currentSize.markSize;
  const finalWordmarkHeight = height || currentSize.wordmarkHeight;

  if (variant === 'mark') {
    return (
      <RaloaMark
        size={width || finalMarkSize}
        className={className}
        theme={theme}
      />
    );
  }

  if (variant === 'wordmark') {
    return (
      <RaloaWordmark
        height={finalWordmarkHeight}
        className={className}
        theme={theme}
      />
    );
  }

  // Full Horizontal Lockup (Mark + Wordmark)
  return (
    <div
      className={`inline-flex items-center ${currentSize.textGap} select-none transition-transform ${className}`}
      role="banner"
    >
      <RaloaMark
        size={finalMarkSize}
        theme={theme}
      />

      <div className="flex flex-col justify-center">
        <RaloaWordmark
          height={finalWordmarkHeight}
          theme={theme}
        />
        {showTagline && (
          <span
            className={`text-[10px] font-semibold tracking-tight mt-0.5 ${
              theme === 'on-dark' || theme === 'monochrome-white'
                ? 'text-slate-300'
                : 'text-slate-500'
            }`}
          >
            {isRtl ? 'مواقع مصغرة تركز على التصميم' : 'Design-first mini-sites'}
          </span>
        )}
      </div>
    </div>
  );
};
