import { TemplateItem, TemplateThemeConfig, BackgroundStyle } from '../types';

export const TEMPLATE_THEMES: Record<string, TemplateThemeConfig> = {
  // 1. FitLife - Dark athletic fitness aesthetic with glowing pink accents and gym backdrop
  fitlife: {
    mode: 'dark',
    bgClasses: 'bg-[#090D16] text-white',
    bgCustomStyle: 'radial-gradient(circle at 50% 12%, rgba(236,72,153,0.26) 0%, rgba(15,23,42,0.98) 75%)',
    ambientGlow: 'radial-gradient(circle at 50% 20%, rgba(236,72,153,0.32) 0%, transparent 70%)',
    bannerOverlay: 'from-transparent via-[#090D16]/60 to-[#090D16]',
    statusBarColor: 'light',
    cardBg: 'bg-slate-900/85 backdrop-blur-md',
    cardBorder: 'border-slate-800/90',
    cardHoverBorder: 'hover:border-pink-500/60',
    cardText: 'text-white',
    cardSubtext: 'text-slate-400',
    cardIconBg: 'bg-pink-950/70',
    cardIconColor: 'text-pink-400',
    textColor: 'text-white',
    roleColor: 'text-pink-400',
    bioColor: 'text-slate-300',
    socialBg: 'bg-slate-900/80',
    socialBorder: 'border-slate-800',
    socialText: 'text-slate-200',
    socialHoverBg: 'hover:bg-pink-600 hover:text-white hover:border-pink-500',
    footerText: 'text-slate-400',
    homeBarColor: 'bg-slate-700'
  },

  // 2. Elena - Alabaster & stone architectural minimal aesthetic
  elena: {
    mode: 'light',
    bgClasses: 'bg-[#F9FAFB] text-slate-800',
    bgCustomStyle: 'radial-gradient(circle at 50% 10%, rgba(91,92,246,0.12) 0%, #F9FAFB 65%)',
    ambientGlow: 'radial-gradient(circle at 50% 15%, rgba(91,92,246,0.2) 0%, transparent 60%)',
    bannerOverlay: 'from-transparent via-[#F9FAFB]/50 to-[#F9FAFB]',
    statusBarColor: 'dark',
    cardBg: 'bg-white/92 backdrop-blur-md',
    cardBorder: 'border-slate-200/90',
    cardHoverBorder: 'hover:border-indigo-400',
    cardText: 'text-slate-900',
    cardSubtext: 'text-slate-500',
    cardIconBg: 'bg-indigo-50',
    cardIconColor: 'text-indigo-600',
    textColor: 'text-slate-900',
    roleColor: 'text-indigo-600',
    bioColor: 'text-slate-600',
    socialBg: 'bg-white',
    socialBorder: 'border-slate-200',
    socialText: 'text-slate-700',
    socialHoverBg: 'hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200',
    footerText: 'text-slate-500',
    homeBarColor: 'bg-slate-300'
  },

  // 3. Mateo - Midnight cinematic film director aesthetic
  mateo: {
    mode: 'dark',
    bgClasses: 'bg-[#070A12] text-white',
    bgCustomStyle: 'radial-gradient(circle at 50% 15%, rgba(37,99,235,0.25) 0%, #070A12 70%)',
    ambientGlow: 'radial-gradient(circle at 50% 20%, rgba(37,99,235,0.32) 0%, transparent 70%)',
    bannerOverlay: 'from-transparent via-[#070A12]/60 to-[#070A12]',
    statusBarColor: 'light',
    cardBg: 'bg-slate-900/80 backdrop-blur-md',
    cardBorder: 'border-blue-950/80',
    cardHoverBorder: 'hover:border-blue-500/60',
    cardText: 'text-white',
    cardSubtext: 'text-slate-400',
    cardIconBg: 'bg-blue-950/70',
    cardIconColor: 'text-blue-400',
    textColor: 'text-white',
    roleColor: 'text-blue-400',
    bioColor: 'text-slate-300',
    socialBg: 'bg-slate-900/80',
    socialBorder: 'border-slate-800',
    socialText: 'text-slate-200',
    socialHoverBg: 'hover:bg-blue-600 hover:text-white hover:border-blue-500',
    footerText: 'text-slate-400',
    homeBarColor: 'bg-slate-700'
  },

  // 4. STUDIO - Luxury modern Scandinavian interior & object design
  studio: {
    mode: 'dark',
    bgClasses: 'bg-[#101317] text-stone-100',
    bgCustomStyle: 'radial-gradient(circle at 50% 12%, rgba(217,119,6,0.14) 0%, #101317 70%)',
    ambientGlow: 'radial-gradient(circle at 50% 20%, rgba(217,119,6,0.2) 0%, transparent 70%)',
    bannerOverlay: 'from-transparent via-[#101317]/60 to-[#101317]',
    statusBarColor: 'light',
    cardBg: 'bg-stone-900/85 backdrop-blur-md',
    cardBorder: 'border-stone-800',
    cardHoverBorder: 'hover:border-amber-600/50',
    cardText: 'text-stone-100',
    cardSubtext: 'text-stone-400',
    cardIconBg: 'bg-stone-800',
    cardIconColor: 'text-amber-400',
    textColor: 'text-white',
    roleColor: 'text-stone-300',
    bioColor: 'text-stone-400',
    socialBg: 'bg-stone-900/80',
    socialBorder: 'border-stone-800',
    socialText: 'text-stone-300',
    socialHoverBg: 'hover:bg-stone-800 hover:text-amber-300 hover:border-amber-500/40',
    footerText: 'text-stone-500',
    homeBarColor: 'bg-stone-700'
  },

  // 5. Dr. Ahmed - Mint & teal clinical wellness
  'dr-ahmed': {
    mode: 'light',
    bgClasses: 'bg-[#F4FBF7] text-slate-800',
    bgCustomStyle: 'radial-gradient(circle at 50% 12%, rgba(16,185,129,0.15) 0%, #F4FBF7 65%)',
    ambientGlow: 'radial-gradient(circle at 50% 15%, rgba(16,185,129,0.24) 0%, transparent 60%)',
    bannerOverlay: 'from-transparent via-[#F4FBF7]/55 to-[#F4FBF7]',
    statusBarColor: 'dark',
    cardBg: 'bg-white/94 backdrop-blur-md',
    cardBorder: 'border-emerald-100/90',
    cardHoverBorder: 'hover:border-emerald-400',
    cardText: 'text-slate-900',
    cardSubtext: 'text-slate-500',
    cardIconBg: 'bg-emerald-50',
    cardIconColor: 'text-emerald-600',
    textColor: 'text-slate-900',
    roleColor: 'text-emerald-600',
    bioColor: 'text-slate-600',
    socialBg: 'bg-white',
    socialBorder: 'border-emerald-100',
    socialText: 'text-slate-700',
    socialHoverBg: 'hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300',
    footerText: 'text-slate-400',
    homeBarColor: 'bg-slate-300'
  },

  // 6. Wander - Azure deep ocean & coastal travel adventure
  wander: {
    mode: 'dark',
    bgClasses: 'bg-[#071322] text-white',
    bgCustomStyle: 'radial-gradient(circle at 50% 14%, rgba(2,132,199,0.28) 0%, #071322 75%)',
    ambientGlow: 'radial-gradient(circle at 50% 20%, rgba(2,132,199,0.36) 0%, transparent 70%)',
    bannerOverlay: 'from-transparent via-[#071322]/65 to-[#071322]',
    statusBarColor: 'light',
    cardBg: 'bg-sky-950/75 backdrop-blur-md',
    cardBorder: 'border-sky-900/60',
    cardHoverBorder: 'hover:border-sky-400/60',
    cardText: 'text-white',
    cardSubtext: 'text-sky-200/70',
    cardIconBg: 'bg-sky-900/60',
    cardIconColor: 'text-sky-400',
    textColor: 'text-white',
    roleColor: 'text-sky-400',
    bioColor: 'text-slate-300',
    socialBg: 'bg-sky-950/80',
    socialBorder: 'border-sky-900/80',
    socialText: 'text-sky-200',
    socialHoverBg: 'hover:bg-sky-600 hover:text-white hover:border-sky-400',
    footerText: 'text-sky-400/60',
    homeBarColor: 'bg-slate-700'
  },

  // 7. Savor - Warm bakery parchment & golden pastry tones
  savor: {
    mode: 'light',
    bgClasses: 'bg-[#FAF5ED] text-stone-800',
    bgCustomStyle: 'radial-gradient(circle at 50% 12%, rgba(217,119,6,0.15) 0%, #FAF5ED 65%)',
    ambientGlow: 'radial-gradient(circle at 50% 15%, rgba(217,119,6,0.22) 0%, transparent 60%)',
    bannerOverlay: 'from-transparent via-[#FAF5ED]/55 to-[#FAF5ED]',
    statusBarColor: 'dark',
    cardBg: 'bg-white/92 backdrop-blur-md',
    cardBorder: 'border-amber-200/70',
    cardHoverBorder: 'hover:border-amber-400',
    cardText: 'text-stone-900',
    cardSubtext: 'text-stone-500',
    cardIconBg: 'bg-amber-100/70',
    cardIconColor: 'text-amber-700',
    textColor: 'text-stone-900',
    roleColor: 'text-amber-700',
    bioColor: 'text-stone-600',
    socialBg: 'bg-white',
    socialBorder: 'border-amber-200/80',
    socialText: 'text-stone-700',
    socialHoverBg: 'hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300',
    footerText: 'text-stone-400',
    homeBarColor: 'bg-stone-300'
  },

  // 8. Nova - Electric modular synth neon purple aesthetic
  nova: {
    mode: 'dark',
    bgClasses: 'bg-[#0A0614] text-white',
    bgCustomStyle: 'radial-gradient(circle at 50% 15%, rgba(124,58,237,0.3) 0%, #0A0614 75%)',
    ambientGlow: 'radial-gradient(circle at 50% 20%, rgba(124,58,237,0.4) 0%, transparent 70%)',
    bannerOverlay: 'from-transparent via-[#0A0614]/65 to-[#0A0614]',
    statusBarColor: 'light',
    cardBg: 'bg-purple-950/60 backdrop-blur-md',
    cardBorder: 'border-purple-900/60',
    cardHoverBorder: 'hover:border-purple-400/60',
    cardText: 'text-white',
    cardSubtext: 'text-purple-200/70',
    cardIconBg: 'bg-purple-900/60',
    cardIconColor: 'text-purple-400',
    textColor: 'text-white',
    roleColor: 'text-purple-400',
    bioColor: 'text-slate-300',
    socialBg: 'bg-purple-950/80',
    socialBorder: 'border-purple-900/80',
    socialText: 'text-purple-200',
    socialHoverBg: 'hover:bg-purple-600 hover:text-white hover:border-purple-400',
    footerText: 'text-purple-400/60',
    homeBarColor: 'bg-slate-700'
  }
};

/**
 * Smartly derives a fallback theme config for custom templates based on accent color and gradients
 */
export function deriveFallbackTheme(template: TemplateItem, isDarkDefault: boolean = false): TemplateThemeConfig {
  const isDark = isDarkDefault;
  const themeHex = template.themeColor || '#6366F1';

  if (isDark) {
    return {
      mode: 'dark',
      bgClasses: 'bg-[#0A0E1A] text-white',
      bgCustomStyle: `radial-gradient(circle at 50% 15%, ${themeHex}33 0%, #0A0E1A 75%)`,
      ambientGlow: `radial-gradient(circle at 50% 20%, ${themeHex}4D 0%, transparent 70%)`,
      bannerOverlay: 'from-transparent via-[#0A0E1A]/60 to-[#0A0E1A]',
      statusBarColor: 'light',
      cardBg: 'bg-slate-900/80 backdrop-blur-md',
      cardBorder: 'border-slate-800',
      cardHoverBorder: 'hover:border-indigo-400/60',
      cardText: 'text-white',
      cardSubtext: 'text-slate-400',
      cardIconBg: 'bg-slate-800/90',
      cardIconColor: 'text-indigo-400',
      textColor: 'text-white',
      roleColor: 'text-indigo-400',
      bioColor: 'text-slate-300',
      socialBg: 'bg-slate-900/80',
      socialBorder: 'border-slate-800',
      socialText: 'text-slate-200',
      socialHoverBg: 'hover:bg-indigo-600 hover:text-white',
      footerText: 'text-slate-400',
      homeBarColor: 'bg-slate-700'
    };
  }

  return {
    mode: 'light',
    bgClasses: 'bg-[#F8FAFC] text-slate-900',
    bgCustomStyle: `radial-gradient(circle at 50% 12%, ${themeHex}1A 0%, #F8FAFC 70%)`,
    ambientGlow: `radial-gradient(circle at 50% 18%, ${themeHex}26 0%, transparent 65%)`,
    bannerOverlay: 'from-transparent via-[#F8FAFC]/50 to-[#F8FAFC]',
    statusBarColor: 'dark',
    cardBg: 'bg-white/92 backdrop-blur-md',
    cardBorder: 'border-slate-200/90',
    cardHoverBorder: 'hover:border-indigo-400',
    cardText: 'text-slate-900',
    cardSubtext: 'text-slate-500',
    cardIconBg: 'bg-indigo-50',
    cardIconColor: 'text-indigo-600',
    textColor: 'text-slate-900',
    roleColor: 'text-indigo-600',
    bioColor: 'text-slate-600',
    socialBg: 'bg-white',
    socialBorder: 'border-slate-200',
    socialText: 'text-slate-700',
    socialHoverBg: 'hover:bg-slate-100',
    footerText: 'text-slate-400',
    homeBarColor: 'bg-slate-300'
  };
}

/**
 * Resolves the final theme configuration for a template with overrides and background styles
 */
export function resolveTemplateTheme(
  template: TemplateItem,
  backgroundStyle: BackgroundStyle = 'signature',
  modeOverride: 'auto' | 'dark' | 'light' = 'auto'
): TemplateThemeConfig {
  const base = template.themeConfig
    ? { ...(TEMPLATE_THEMES[template.id] || deriveFallbackTheme(template)), ...template.themeConfig }
    : (TEMPLATE_THEMES[template.id] || deriveFallbackTheme(template));

  let finalMode = base.mode;
  if (modeOverride === 'dark') finalMode = 'dark';
  if (modeOverride === 'light') finalMode = 'light';

  let config = { ...base };

  // If mode was changed from default
  if (finalMode !== base.mode) {
    config = deriveFallbackTheme(template, finalMode === 'dark');
  }

  // Adjust for different background styles
  if (backgroundStyle === 'minimal') {
    config.bgCustomStyle = undefined;
    config.ambientGlow = undefined;
  } else if (backgroundStyle === 'gradient') {
    const themeHex = template.themeColor || '#6366F1';
    config.bgCustomStyle = `linear-gradient(160deg, ${themeHex}33 0%, ${finalMode === 'dark' ? '#090D16' : '#FFFFFF'} 60%)`;
  }

  return config;
}

export interface TemplateContainerProperties {
  stageContainerStyle: React.CSSProperties;
  screenContainerStyle: React.CSSProperties;
  phoneShellStyle: React.CSSProperties;
  bannerOverlayStyle: React.CSSProperties;
  isDark: boolean;
  themeColor: string;
}

/**
 * Dynamically computes real CSS background container properties from the template's actual properties
 * (themeColor, accentGradient, coverImage, backgroundProperties, and themeConfig)
 * rather than relying on hardcoded CSS classes.
 */
export function getTemplateBackgroundContainerProperties(
  template: TemplateItem,
  backgroundStyle: BackgroundStyle = 'signature',
  modeOverride: 'auto' | 'dark' | 'light' = 'auto',
  customCoverImage?: string
): TemplateContainerProperties {
  const themeConfig = resolveTemplateTheme(template, backgroundStyle, modeOverride);
  const isDark = themeConfig.mode === 'dark';
  const themeColor = template.themeColor || '#6366F1';
  const coverImg = customCoverImage || template.coverImage;

  // 1. Stage container properties (outer studio preview stage container)
  const stageContainerStyle: React.CSSProperties = {
    backgroundColor: isDark ? '#080B12' : '#F8FAFC',
    backgroundImage: isDark
      ? `radial-gradient(ellipse at 50% 25%, ${themeColor}28 0%, rgba(11, 15, 25, 0.95) 75%), radial-gradient(circle at 10% 80%, ${themeColor}1A 0%, transparent 60%)`
      : `radial-gradient(ellipse at 50% 25%, ${themeColor}18 0%, #F1F5F9 75%), radial-gradient(circle at 90% 85%, ${themeColor}12 0%, transparent 60%)`,
    color: isDark ? '#F8FAFC' : '#0F172A',
    transition: 'background-color 0.4s ease, background-image 0.4s ease, color 0.3s ease'
  };

  // Merge any explicit backgroundProperties defined on the template
  if (template.backgroundProperties) {
    Object.assign(stageContainerStyle, template.backgroundProperties);
  }

  // 2. Screen container properties (the device screen background container)
  const screenBg = isDark ? (themeConfig.bgSolid || '#090D16') : '#F8FAFC';
  let screenBgImage: string | undefined = undefined;

  if (backgroundStyle === 'immersive' && coverImg) {
    screenBgImage = isDark
      ? `linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(9,13,22,0.85) 60%, rgba(9,13,22,0.98)), url("${coverImg}")`
      : `linear-gradient(to bottom, rgba(255,255,255,0.5), rgba(248,250,252,0.85) 60%, rgba(248,250,252,0.98)), url("${coverImg}")`;
  } else if (backgroundStyle === 'gradient') {
    screenBgImage = `linear-gradient(160deg, ${themeColor}38 0%, ${isDark ? '#090D16' : '#FFFFFF'} 65%)`;
  } else if (backgroundStyle === 'signature') {
    screenBgImage = isDark
      ? `radial-gradient(circle at 50% 12%, ${themeColor}32 0%, ${screenBg} 75%)`
      : `radial-gradient(circle at 50% 10%, ${themeColor}1C 0%, ${screenBg} 65%)`;
  }

  const screenContainerStyle: React.CSSProperties = {
    backgroundColor: screenBg,
    backgroundImage: screenBgImage,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    color: isDark ? '#FFFFFF' : '#0F172A',
    boxShadow: isDark
      ? `inset 0 0 40px rgba(0,0,0,0.7), 0 0 30px ${themeColor}26`
      : `inset 0 0 25px rgba(0,0,0,0.06), 0 0 20px ${themeColor}18`,
    transition: 'background-color 0.3s ease, background-image 0.3s ease, color 0.3s ease'
  };

  // 3. Phone shell frame style
  const phoneShellStyle: React.CSSProperties = {
    backgroundColor: isDark ? '#0C0F17' : '#1E293B',
    borderColor: isDark ? '#1E2433' : '#334155',
    boxShadow: isDark
      ? `0 28px 70px rgba(0, 0, 0, 0.45), 0 0 35px ${themeColor}24`
      : `0 28px 70px rgba(15, 23, 42, 0.28), 0 0 25px ${themeColor}15`,
    transition: 'background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease'
  };

  // 4. Banner overlay style
  const bannerOverlayStyle: React.CSSProperties = {
    background: isDark
      ? `linear-gradient(to bottom, transparent, ${screenBg}CC 70%, ${screenBg} 100%)`
      : `linear-gradient(to bottom, transparent, ${screenBg}99 70%, ${screenBg} 100%)`
  };

  return {
    stageContainerStyle,
    screenContainerStyle,
    phoneShellStyle,
    bannerOverlayStyle,
    isDark,
    themeColor
  };
}
