import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Share2,
  ExternalLink,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Mail,
  Copy,
  Check
} from 'lucide-react';
import { TemplateItem, Locale } from '../types';
import { templatesData } from '../data/content';
import { resolveTemplateTheme, getTemplateBackgroundContainerProperties } from '../utils/templateThemes';
import { PlatformIcon, PlatformIconName } from './brand/PlatformIcon';
import { RaloaLogo } from './brand/RaloaLogo';
import { recordLinkClick, recordPageView } from '../lib/firebase';
import { usePageSEO } from '../hooks/usePageSEO';
import { SafeImage } from './SafeImage';

interface PublicCreatorProfileProps {
  handle: string;
  locale: Locale;
  onClaimHandle?: (handle: string) => void;
  onReturnHome?: () => void;
  onNotFound?: (handle: string) => void;
}

export const PublicCreatorProfile: React.FC<PublicCreatorProfileProps> = ({
  handle,
  locale,
  onClaimHandle,
  onReturnHome,
  onNotFound
}) => {
  const isRtl = locale === 'ar';
  const cleanHandle = handle.replace(/^@/, '').toLowerCase().trim();
  const [copied, setCopied] = useState(false);

  // Look for matching creator in templatesData or known handles
  const creator = templatesData.find(
    (t) => t.id.toLowerCase() === cleanHandle || t.name.toLowerCase() === cleanHandle
  );

  useEffect(() => {
    if (!creator) {
      onNotFound?.(cleanHandle);
    } else {
      recordPageView(`/@${cleanHandle}`);
    }
  }, [cleanHandle, creator, onNotFound]);

  // Dynamic OpenGraph & Meta tag hydration for public creator route (FR-3.2)
  usePageSEO({
    sectionId: `creator-${cleanHandle}`,
    title: creator
      ? `${creator.name} (@${cleanHandle}) - RALOA Mini-Site`
      : `RALOA Profile`,
    description: creator
      ? (isRtl ? creator.bioAr : creator.bio) || `Check out @${cleanHandle}'s official links and mini-site on RALOA.`
      : 'Official creator profile on RALOA.',
    ogTitle: creator ? `${creator.name} (@${cleanHandle}) | RALOA` : undefined,
    ogDescription: creator ? (isRtl ? creator.bioAr : creator.bio) : undefined,
    ogImage: creator?.avatar,
    canonicalUrl: `https://raloa.app/@${cleanHandle}`,
    locale
  });


  if (!creator) {
    return null;
  }

  const bgStyle = creator.backgroundStyle || 'signature';
  const themeConfig = resolveTemplateTheme(creator, bgStyle, 'auto');
  const bgContainerProps = getTemplateBackgroundContainerProperties(
    creator,
    bgStyle,
    'auto',
    creator.coverImage
  );

  const handleShare = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLinkSelect = (link: typeof creator.sampleLinks[0]) => {
    recordLinkClick(link.id, link.title, cleanHandle);
    if (link.url.startsWith('#')) {
      alert(isRtl ? `فتح: ${isRtl ? link.titleAr : link.title}` : `Opening: ${link.title}`);
    } else {
      window.open(link.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className="min-h-[100dvh] flex flex-col justify-between selection:bg-indigo-500/20 selection:text-indigo-600 transition-colors duration-200 relative overflow-x-hidden"
      style={bgContainerProps.screenContainerStyle}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Ambient Glow Background Effect */}
      {themeConfig.ambientGlow && bgStyle !== 'minimal' && (
        <div
          className="fixed top-0 left-0 right-0 h-96 pointer-events-none z-0 opacity-70"
          style={{ background: themeConfig.ambientGlow }}
        />
      )}

      {/* Top Header Floating Actions */}
      <header className="relative z-20 w-full max-w-xl mx-auto px-4 pt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onReturnHome}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl"
        >
          <RaloaLogo isRtl={isRtl} size="sm" />
        </button>

        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md bg-white/20 hover:bg-white/30 dark:bg-black/30 dark:hover:bg-black/40 border border-white/20 text-current shadow-xs transition-colors cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
          <span>{copied ? (isRtl ? 'تم النسخ!' : 'Copied!') : (isRtl ? 'مشاركة' : 'Share')}</span>
        </button>
      </header>

      {/* Main Profile Body */}
      <main className="relative z-10 w-full max-w-md mx-auto px-4 py-8 flex-1 flex flex-col items-center">
        {/* Cover Banner if present */}
        {creator.coverImage && (
          <div className="w-full h-32 sm:h-40 rounded-3xl overflow-hidden mb-[-48px] shadow-sm relative z-0">
            <SafeImage
              src={creator.coverImage}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30" />
          </div>
        )}

        {/* Avatar */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35 }}
          className="relative z-10 mb-4"
        >
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xl border border-white/40">
            <SafeImage
              src={creator.avatar}
              alt={creator.name}
              className="w-full h-full rounded-full object-cover"
            />
          </div>
        </motion.div>

        {/* Display Name & Handle */}
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-1.5">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: themeConfig.textColor }}>
              {creator.name}
            </h1>
            <CheckCircle2 className="w-4 h-4 text-indigo-500 fill-indigo-500/20" />
          </div>
          <div className="text-xs font-mono font-medium text-indigo-600 dark:text-indigo-400 mt-0.5">
            raloa.app/@{cleanHandle}
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider mt-1 opacity-75" style={{ color: themeConfig.roleColor }}>
            {creator.role}
          </p>
        </div>

        {/* Bio */}
        <p
          className="text-center text-xs sm:text-sm max-w-sm mb-6 leading-relaxed opacity-90 px-2"
          style={{ color: themeConfig.bioColor }}
        >
          {isRtl ? creator.bioAr : creator.bio}
        </p>

        {/* Social Icons Strip */}
        {creator.socials && creator.socials.length > 0 && (
          <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
            {creator.socials.map((soc) => (
              <a
                key={soc.platform}
                href={soc.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => recordLinkClick(`soc_${soc.platform}`, soc.platform, cleanHandle)}
                className="w-10 h-10 rounded-2xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-2xs backdrop-blur-md"
                style={{
                  backgroundColor: themeConfig.socialBg || 'rgba(255,255,255,0.1)',
                  border: `1px solid ${themeConfig.socialBorder || 'rgba(255,255,255,0.2)'}`,
                  color: themeConfig.socialText || 'inherit',
                }}
                aria-label={soc.platform}
              >
                {soc.platform === 'email' ? (
                  <Mail className="w-4 h-4" />
                ) : (
                  <PlatformIcon name={soc.platform as PlatformIconName} className="w-4 h-4" />
                )}
              </a>

            ))}
          </div>
        )}

        {/* Links Stack */}
        <div className="w-full space-y-3 mb-8">
          {creator.sampleLinks.map((link, idx) => (
            <motion.button
              key={link.id}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              onClick={() => handleLinkSelect(link)}
              className="w-full group p-3.5 sm:p-4 rounded-2xl flex items-center gap-3.5 text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] shadow-xs backdrop-blur-md cursor-pointer border"
              style={{
                backgroundColor: themeConfig.cardBg || 'rgba(255,255,255,0.15)',
                borderColor: themeConfig.cardBorder || 'rgba(255,255,255,0.2)',
                color: themeConfig.cardText || 'inherit',
              }}
            >
              {link.thumbnail && (
                <SafeImage
                  src={link.thumbnail}
                  alt=""
                  className="w-11 h-11 rounded-xl object-cover shrink-0 shadow-2xs"
                />
              )}

              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm sm:text-base leading-snug truncate" style={{ color: themeConfig.cardText }}>
                  {isRtl ? link.titleAr : link.title}
                </div>
                {(link.subtitle || link.subtitleAr) && (
                  <div className="text-xs truncate opacity-75 mt-0.5" style={{ color: themeConfig.cardSubtext }}>
                    {isRtl ? link.subtitleAr : link.subtitle}
                  </div>
                )}
              </div>

              <div className="w-8 h-8 rounded-full flex items-center justify-center opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </div>
            </motion.button>
          ))}
        </div>

        {/* Branded CTA Banner: Claim your handle / Create your own */}
        <div className="w-full pt-4 pb-2">
          <div className="rounded-2xl p-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/40 dark:border-slate-800/80 shadow-lg text-center">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mb-2">
              <Sparkles className="w-3 h-3" />
              <span>{isRtl ? 'اصنع صفحتك الخاصة' : 'Create your mini-site'}</span>
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-3">
              {isRtl
                ? `أعجبك تصميم @${cleanHandle}؟ أنشئ موقعك المصغر في دقائق مع رالوا`
                : `Like @${cleanHandle}'s page? Build your own beautiful mini-site with RALOA.`}
            </p>
            <button
              type="button"
              onClick={() => onClaimHandle ? onClaimHandle(cleanHandle) : onReturnHome?.()}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{isRtl ? 'ابدأ مجاناً الآن' : 'Get Your Free Link-in-Bio'}</span>
              {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full py-4 text-center text-xs opacity-60">
        <p>© {new Date().getFullYear()} RALOA · Powered by Next-Gen Edge Engine</p>
      </footer>
    </div>
  );
};
