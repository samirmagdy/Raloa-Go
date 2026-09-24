import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Mail
} from 'lucide-react';
import { PremiumMark } from './brand/PremiumMark';
import { SafeImage } from './SafeImage';
import { PlatformIcon, PlatformIconName } from './brand/PlatformIcon';
import { TemplateItem, BackgroundStyle } from '../types';
import { RaloaMark } from './brand/RaloaLogo';
import { resolveTemplateTheme, getTemplateBackgroundContainerProperties } from '../utils/templateThemes';

interface PhoneMockupProps {
  template: TemplateItem;
  className?: string;
  isRtl?: boolean;
  interactive?: boolean;
  onOpenAction?: (type: 'portfolio' | 'booking' | 'shop' | 'gear', data?: any) => void;
  backgroundStyle?: BackgroundStyle;
  customCoverImage?: string;
  themeModeOverride?: 'auto' | 'dark' | 'light';
  accentColor?: string;
  surfaceColor?: string;
  cardRadius?: 'sharp' | 'subtle' | 'rounded' | 'pill';
  cardShadow?: 'none' | 'subtle' | 'soft' | 'hard';
  borderStyle?: 'none' | 'thin' | 'bold' | 'dashed';
}

export const PhoneMockup: React.FC<PhoneMockupProps> = ({
  template,
  className = '',
  isRtl = false,
  interactive = true,
  onOpenAction,
  backgroundStyle = 'immersive',
  customCoverImage,
  themeModeOverride = 'auto',
  accentColor,
  surfaceColor,
  cardRadius = 'rounded',
  cardShadow = 'subtle',
  borderStyle = 'thin'
}) => {
  const [clickedItem, setClickedItem] = useState<string | null>(null);

  // Resolve template theme configuration and actual background container properties
  const currentBgStyle = backgroundStyle || template.backgroundStyle || 'immersive';
  const effectiveThemeColor = accentColor || template.themeColor || '#6366F1';
  const effectiveTemplate = { ...template, themeColor: effectiveThemeColor };

  const themeConfig = resolveTemplateTheme(effectiveTemplate, currentBgStyle, themeModeOverride);
  const bgContainerProps = getTemplateBackgroundContainerProperties(
    effectiveTemplate,
    currentBgStyle,
    themeModeOverride,
    customCoverImage
  );
  const coverImg = customCoverImage || template.coverImage;
  const isLightStatusBar = themeConfig.statusBarColor === 'light';
  const isDark = themeConfig.mode === 'dark';

  // Compute card geometry tokens
  const getRadiusClass = () => {
    switch (cardRadius) {
      case 'sharp':
        return 'rounded-none';
      case 'subtle':
        return 'rounded-lg';
      case 'pill':
        return 'rounded-full';
      case 'rounded':
      default:
        return 'rounded-2xl';
    }
  };

  const getShadowClass = () => {
    switch (cardShadow) {
      case 'none':
        return 'shadow-none';
      case 'soft':
        return isDark ? 'shadow-[0_8px_20px_rgba(0,0,0,0.4)]' : 'shadow-[0_8px_20px_rgba(0,0,0,0.08)]';
      case 'hard':
        return isDark ? 'shadow-[3px_3px_0px_rgba(255,255,255,0.25)]' : 'shadow-[3px_3px_0px_#0F172A]';
      case 'subtle':
      default:
        return 'shadow-xs';
    }
  };

  const getBorderStyles = (): React.CSSProperties => {
    if (borderStyle === 'none') {
      return { border: 'none' };
    }
    const strokeWidth = borderStyle === 'bold' ? '2px' : '1px';
    const strokeType = borderStyle === 'dashed' ? 'dashed' : 'solid';
    const borderColor = isDark
      ? (borderStyle === 'bold' ? `${effectiveThemeColor}80` : 'rgba(255,255,255,0.15)')
      : (borderStyle === 'bold' ? effectiveThemeColor : 'rgba(0,0,0,0.12)');

    return {
      borderWidth: strokeWidth,
      borderStyle: strokeType,
      borderColor
    };
  };

  const getCardStyle = (): React.CSSProperties => {
    const customBorder = getBorderStyles();
    const style: React.CSSProperties = {
      ...customBorder
    };

    if (surfaceColor) {
      style.backgroundColor = surfaceColor;
      // Derive legible text color if a custom surface color was set
      if (surfaceColor.startsWith('#')) {
        const hex = surfaceColor.replace('#', '');
        if (hex.length === 6) {
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          if (luminance < 0.5) {
            style.color = '#FFFFFF';
          } else {
            style.color = '#0F172A';
          }
        }
      }
    }

    return style;
  };

  const handleLinkClick = (link: typeof template.sampleLinks[0], e: React.MouseEvent) => {
    if (!interactive) return;
    e.preventDefault();
    setClickedItem(link.id);
    setTimeout(() => setClickedItem(null), 350);

    if (onOpenAction) {
      if (link.type === 'gallery') onOpenAction('portfolio', link);
      else if (link.type === 'booking') onOpenAction('booking', link);
      else if (link.type === 'shop') onOpenAction('shop', link);
      else onOpenAction('gear', link);
    }
  };

  return (
    <div
      className={`relative mx-auto w-[295px] sm:w-[320px] md:w-[340px] rounded-[48px] p-3 border-[6px] select-none transition-all duration-300 hover:scale-[1.01] raloa-phone-mockup ${className}`}
      style={bgContainerProps.phoneShellStyle}
    >
      {/* Screen Frame with Dynamic Template Background Container Properties */}
      <div
        className="relative rounded-[38px] overflow-hidden flex flex-col min-h-[580px] max-h-[640px] shadow-inner raloa-phone-screen transition-all duration-300"
        style={bgContainerProps.screenContainerStyle}
      >
        {/* Ambient Glow for Template (Signature / Gradient mode) */}
        {themeConfig.ambientGlow && currentBgStyle !== 'minimal' && (
          <div
            className="absolute top-0 left-0 right-0 h-80 pointer-events-none z-0 opacity-70"
            style={{ background: themeConfig.ambientGlow }}
          />
        )}

        {/* Dynamic Island & Status Bar */}
        <div
          className={`relative pt-3 px-6 pb-2 flex items-center justify-between text-[11px] font-semibold z-20 phone-status-bar transition-colors ${
            isLightStatusBar ? 'text-white' : 'text-slate-900'
          }`}
        >
          <span>9:41</span>
          <div className="w-24 h-5 bg-black rounded-full flex items-center justify-center shadow-xs">
            <div className="w-2 h-2 rounded-full bg-slate-800 ml-auto mr-2" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]">5G</span>
            <div
              className={`w-4 h-2.5 border rounded-2xs p-0.5 flex items-center ${
                isLightStatusBar ? 'border-white/70' : 'border-slate-700'
              }`}
            >
              <div
                className={`w-full h-full rounded-3xs ${
                  isLightStatusBar ? 'bg-white' : 'bg-slate-900'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Scrollable Screen Content */}
        <div className="relative z-10 flex-1 overflow-y-auto no-scrollbar flex flex-col items-center text-center">
          
          {/* Header Cover Banner (Signature or Banner style) */}
          {(currentBgStyle === 'signature' || currentBgStyle === 'banner') && coverImg && (
            <div className="relative w-full h-28 sm:h-32 overflow-hidden shrink-0 select-none">
              <SafeImage
                src={coverImg}
                alt=""
                className="w-full h-full object-cover scale-105"
                loading="eager"
              />
              {/* Vignette fade connecting image to the template background */}
              <div
                className="absolute inset-0"
                style={bgContainerProps.bannerOverlayStyle}
              />
              <div className="absolute inset-0 bg-black/15" />
            </div>
          )}

          {/* Main profile content container */}
          <div className={`w-full px-4 pb-6 flex flex-col items-center ${(currentBgStyle === 'signature' || currentBgStyle === 'banner') && coverImg ? '-mt-11' : 'pt-2'}`}>
            
            {/* Avatar with verified badge */}
            <div className="relative mb-3 z-10">
              <div
                className="w-20 h-20 rounded-full p-1 shadow-lg ring-4 ring-black/10 dark:ring-white/10"
                style={{
                  background: `linear-gradient(135deg, ${effectiveThemeColor}, #9333ea)`
                }}
              >
                <SafeImage
                  src={template.avatar}
                  alt={template.name}
                  className="w-full h-full object-cover rounded-full bg-slate-100"
                  loading="eager"
                />
              </div>
              <div
                className="absolute -bottom-1 -right-1 rounded-full p-0.5 shadow-sm"
                style={{ backgroundColor: surfaceColor || '#FFFFFF' }}
              >
                <CheckCircle2
                  className="w-5 h-5"
                  style={{ color: effectiveThemeColor, fill: effectiveThemeColor }}
                />
              </div>
            </div>

            {/* Name & Role */}
            <h3 className={`font-extrabold text-[18px] tracking-tight leading-tight ${themeConfig.textColor}`}>
              {template.name}
            </h3>
            <p
              className={`text-[12px] font-semibold mt-1 transition-colors`}
              style={{ color: effectiveThemeColor }}
            >
              {template.role}
            </p>
            <p className={`text-[11px] mt-1.5 px-3 leading-relaxed max-w-[270px] ${themeConfig.bioColor}`}>
              {isRtl ? template.bioAr : template.bio}
            </p>

            {/* Social Icons Strip */}
            <div className="flex items-center justify-center gap-2 mt-3.5 mb-4">
              {template.socials.map((social) => {
                const isPlatformIcon = social.platform !== 'email';
                return (
                  <a
                    key={`${social.platform}-${social.url}`}
                    href={social.url}
                    target={social.url.startsWith('mailto:') || social.url.startsWith('tel:') ? undefined : '_blank'}
                    rel={social.url.startsWith('mailto:') || social.url.startsWith('tel:') ? undefined : 'noopener noreferrer'}
                    aria-label={social.platform}
                    className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all shadow-2xs ${themeConfig.socialBg} ${themeConfig.socialBorder} ${themeConfig.socialText} ${themeConfig.socialHoverBg}`}
                    style={surfaceColor ? { backgroundColor: surfaceColor } : undefined}
                  >
                    {isPlatformIcon ? (
                      <PlatformIcon name={social.platform as PlatformIconName} className="w-3.5 h-3.5" />
                    ) : (
                      <Mail className="w-3.5 h-3.5" />
                    )}
                  </a>
                );
              })}
            </div>

            {/* Mini-site interactive links */}
            <div className="w-full space-y-2.5 mt-1">
              {template.sampleLinks.map((link) => {
                const isClicked = clickedItem === link.id;
                const cardDynamicStyle = getCardStyle();
                const radiusClass = getRadiusClass();
                const shadowClass = getShadowClass();

                return (
                  <button
                    key={link.id}
                    onClick={(e) => handleLinkClick(link, e)}
                    type="button"
                    style={cardDynamicStyle}
                    className={`w-full p-2.5 border flex items-center gap-3 transition-all duration-200 text-left rtl:text-right group cursor-pointer ${
                      radiusClass
                    } ${shadowClass} ${
                      !surfaceColor ? `${themeConfig.cardBg} ${themeConfig.cardBorder}` : ''
                    } ${themeConfig.cardHoverBorder} ${
                      isClicked ? 'scale-[0.98] ring-2 ring-indigo-500' : 'hover:scale-[1.01]'
                    }`}
                  >
                    {link.thumbnail ? (
                      <div
                        className={`relative w-11 h-11 ${cardRadius === 'sharp' ? 'rounded-none' : cardRadius === 'pill' ? 'rounded-full' : 'rounded-xl'} overflow-hidden shrink-0 border border-black/10 dark:border-white/10 ${themeConfig.cardIconBg} ${themeConfig.cardIconColor}`}
                      >
                        <div className="absolute inset-0 flex items-center justify-center">
                          <PremiumMark className="w-5 h-5" style={{ color: effectiveThemeColor }} />
                        </div>
                        <SafeImage
                          src={link.thumbnail}
                          alt={link.title}
                          className="relative z-10 w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        className={`w-11 h-11 ${cardRadius === 'sharp' ? 'rounded-none' : cardRadius === 'pill' ? 'rounded-full' : 'rounded-xl'} flex items-center justify-center shrink-0 ${themeConfig.cardIconBg} ${themeConfig.cardIconColor}`}
                        style={{ color: effectiveThemeColor }}
                      >
                        <PremiumMark className="w-5 h-5" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-bold text-[13px] truncate transition-colors ${
                            !surfaceColor ? themeConfig.cardText : ''
                          }`}
                        >
                          {isRtl ? link.titleAr : link.title}
                        </span>
                      </div>
                      {(link.subtitle || link.subtitleAr) && (
                        <p
                          className={`text-[10px] truncate mt-0.5 ${
                            !surfaceColor ? themeConfig.cardSubtext : 'opacity-70'
                          }`}
                        >
                          {isRtl ? link.subtitleAr : link.subtitle}
                        </p>
                      )}
                    </div>

                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors rtl:rotate-180 opacity-70 group-hover:opacity-100 ${
                        themeConfig.mode === 'dark'
                          ? 'bg-white/10 text-white'
                          : 'bg-black/5 text-slate-700'
                      }`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Interactive Hint */}
            <div className={`mt-4 pt-3 border-t border-black/10 dark:border-white/10 w-full flex items-center justify-center gap-1.5 text-[10px] font-medium ${themeConfig.footerText}`}>
              <span
                className="w-1.5 h-1.5 rounded-full animate-ping"
                style={{ backgroundColor: effectiveThemeColor }}
              />
              <span>{isRtl ? 'اضغط على الروابط لتجربة التفاعل المباشر' : 'Tap links to test live interactions'}</span>
            </div>

            {/* Bottom Handle Badge */}
            <div className={`mt-2.5 flex items-center justify-center gap-1.5 text-[10px] font-semibold tracking-wider ${themeConfig.footerText}`}>
              <RaloaMark size={14} />
              <span>raloa.app/@{template.name.toLowerCase()}</span>
            </div>
          </div>
        </div>

        {/* iPhone Home Bar */}
        <div className="relative z-20 py-2 flex justify-center bg-transparent">
          <div className={`w-28 h-1 rounded-full ${themeConfig.homeBarColor}`} />
        </div>
      </div>
    </div>
  );
};
