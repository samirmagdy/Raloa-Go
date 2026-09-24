import React from 'react';
import { Smartphone, Share2 } from 'lucide-react';
import { Locale, TemplateItem, BackgroundStyle } from '../../types';
import { PhoneMockup } from '../PhoneMockup';
import { SocialPreviewGenerator } from './SocialPreviewGenerator';
import { getTemplateBackgroundContainerProperties } from '../../utils/templateThemes';

export interface StudioTemplatePreviewProps {
  template: TemplateItem;
  username: string;
  displayName: string;
  role: string;
  bio: string;
  avatar: string;
  coverImage: string;
  links: any[];
  bgStyle: BackgroundStyle;
  themeMode: 'auto' | 'dark' | 'light';
  isRtl: boolean;
  locale: Locale;
  previewMode: 'phone' | 'social';
  onPreviewModeChange: (mode: 'phone' | 'social') => void;
  onOpenPhoneAction?: (type: 'portfolio' | 'booking' | 'shop' | 'gear', data?: any) => void;
  accentColor?: string;
  surfaceColor?: string;
  cardRadius?: 'sharp' | 'subtle' | 'rounded' | 'pill';
  cardShadow?: 'none' | 'subtle' | 'soft' | 'hard';
  borderStyle?: 'none' | 'thin' | 'bold' | 'dashed';
}

/**
 * Studio Modal Template Preview Component
 * Dynamically renders the actual template's background container properties
 * (including stage background gradient, ambient lighting, and phone container styles)
 * without relying on hard-coded CSS background classes.
 */
export const StudioTemplatePreview: React.FC<StudioTemplatePreviewProps> = ({
  template,
  username,
  displayName,
  role,
  bio,
  avatar,
  coverImage,
  links,
  bgStyle,
  themeMode,
  isRtl,
  locale,
  previewMode,
  onPreviewModeChange,
  onOpenPhoneAction,
  accentColor,
  surfaceColor,
  cardRadius,
  cardShadow,
  borderStyle
}) => {
  // Dynamically compute the template's background container properties with accent color applied
  const effectiveTemplate = accentColor ? { ...template, themeColor: accentColor } : template;
  const bgContainerProps = getTemplateBackgroundContainerProperties(
    effectiveTemplate,
    bgStyle,
    themeMode,
    coverImage
  );

  return (
    <div
      className="flex lg:col-span-5 flex-col items-center justify-center p-4 sm:p-6 min-h-[520px] lg:min-h-[680px] max-h-[calc(100dvh-8rem)] lg:max-h-none overflow-y-auto border-t border-slate-200 lg:border-t-0 studio-preview-column print:flex! print:p-2! print:bg-white! print:overflow-visible! transition-all duration-500"
      style={bgContainerProps.stageContainerStyle}
    >
      {/* View Mode Switcher Pill */}
      <div className="mb-3 flex items-center gap-1 p-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs print:hidden">
        <button
          type="button"
          onClick={() => onPreviewModeChange('phone')}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            previewMode === 'phone'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>{isRtl ? 'معاينة الهاتف' : 'Phone Mockup'}</span>
        </button>

        <button
          type="button"
          onClick={() => onPreviewModeChange('social')}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            previewMode === 'social'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>{isRtl ? 'بطاقة التواصل' : 'Social Card'}</span>
        </button>
      </div>

      {previewMode === 'phone' ? (
        <div className="w-full max-w-[320px] scale-[0.92] origin-top print:scale-100 print:max-w-[420px]">
          <div className="text-center mb-2 print:hidden">
            <span
              className="text-[10px] font-extrabold uppercase tracking-wider opacity-70"
              style={{ color: bgContainerProps.isDark ? '#94A3B8' : '#64748B' }}
            >
              {isRtl ? 'المعاينة الحية التفاعلية' : 'Live Interactive Preview'}
            </span>
          </div>
          <PhoneMockup
            template={template}
            isRtl={isRtl}
            interactive={true}
            backgroundStyle={bgStyle}
            customCoverImage={coverImage}
            themeModeOverride={themeMode}
            onOpenAction={onOpenPhoneAction}
            accentColor={accentColor}
            surfaceColor={surfaceColor}
            cardRadius={cardRadius}
            cardShadow={cardShadow}
            borderStyle={borderStyle}
          />
        </div>
      ) : (
        <div className="w-full max-w-[440px] animate-in fade-in zoom-in-95 duration-200 p-2">
          <div className="text-center mb-2 print:hidden">
            <span
              className="text-[10px] font-extrabold uppercase tracking-wider opacity-70"
              style={{ color: bgContainerProps.isDark ? '#94A3B8' : '#64748B' }}
            >
              {isRtl ? 'معاينة بطاقة OpenGraph التفاعلية' : 'Dynamic OpenGraph Mockup'}
            </span>
          </div>
          <SocialPreviewGenerator
            username={username}
            displayName={displayName}
            role={role}
            bio={bio}
            avatar={avatar}
            linksCount={links.length}
            locale={locale}
            isCompact={true}
          />
        </div>
      )}
    </div>
  );
};
