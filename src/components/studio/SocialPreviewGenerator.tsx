import React, { useEffect, useState } from 'react';
import {
  Globe,
  Copy,
  Check,
  RefreshCw,
  Code,
  ExternalLink,
  ShieldCheck,
  Layers,
  Sliders,
  Share2,
  CheckCircle2,
  Heart,
  MessageCircle,
  Repeat,
  Send,
  Bookmark,
  ThumbsUp,
  MoreHorizontal
} from 'lucide-react';
import { Locale } from '../../types';
import { RaloaMark } from '../brand/RaloaLogo';
import { PremiumMark } from '../brand/PremiumMark';

export type SocialPlatform = 'twitter' | 'linkedin' | 'imessage';
export type OgTheme = 'gradient' | 'slate' | 'sunset' | 'emerald';

interface SocialPreviewGeneratorProps {
  username: string;
  displayName: string;
  role: string;
  bio: string;
  avatar: string;
  linksCount: number;
  locale: Locale;
  // If embedded in the right-column preview vs full tab
  isCompact?: boolean;
}

export const SocialPreviewGenerator: React.FC<SocialPreviewGeneratorProps> = ({
  username,
  displayName,
  role,
  bio,
  avatar,
  linksCount,
  locale,
  isCompact = false
}) => {
  const isRtl = locale === 'ar';

  const defaultTitle = `${displayName || 'Creator'} — ${role || 'Portfolio'} | RALOA`;
  const defaultDesc =
    bio ||
    (isRtl
      ? 'استكشف معرض الأعمال، مواعيد الحجز المباشر، والروابط الرسمية عبر صفحتي المصغرة على RALOA.'
      : 'Explore portfolio work, booking calendar, and curated links on my official RALOA mini-site.');

  const [platform, setPlatform] = useState<SocialPlatform>('twitter');
  const [ogTitle, setOgTitle] = useState(defaultTitle);
  const [ogDesc, setOgDesc] = useState(defaultDesc);
  const [ogTheme, setOgTheme] = useState<OgTheme>('gradient');
  const [badgeText, setBadgeText] = useState(isRtl ? 'صانع محتوى موثق' : 'Verified Creator');
  const [showAvatar, setShowAvatar] = useState(true);
  const [showBadge, setShowBadge] = useState(true);
  const [showStats, setShowStats] = useState(true);

  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showCodeSnippet, setShowCodeSnippet] = useState(false);

  // Sync from profile
  const handleResetToProfile = () => {
    setOgTitle(`${displayName || 'Creator'} — ${role || 'Portfolio'} | RALOA`);
    setOgDesc(
      bio ||
        (isRtl
          ? 'استكشف معرض الأعمال، مواعيد الحجز المباشر، والروابط الرسمية عبر صفحتي المصغرة على RALOA.'
          : 'Explore portfolio work, booking calendar, and curated links on my official RALOA mini-site.')
    );
  };

  const currentUrl = `https://raloa.app/@${username}`;

  // The compact version is the live Studio preview. Keep it synchronized with
  // profile edits while preserving manual social-card edits in the full view.
  useEffect(() => {
    if (!isCompact) return;
    setOgTitle(`${displayName || 'Creator'} — ${role || 'Portfolio'} | RALOA`);
    setOgDesc(
      bio ||
        (isRtl
          ? 'استكشف معرض الأعمال، مواعيد الحجز المباشر، والروابط الرسمية عبر صفحتي المصغرة على RALOA.'
          : 'Explore portfolio work, booking calendar, and curated links on my official RALOA mini-site.')
    );
  }, [bio, displayName, isCompact, isRtl, role]);

  // Theme styling configurations
  const themeStyles: Record<OgTheme, { bg: string; text: string; subtext: string; pillBg: string; pillBorder: string; accent: string }> = {
    gradient: {
      bg: 'bg-gradient-to-br from-[#1E1B4B] via-[#312E81] to-[#4C1D95]',
      text: 'text-white',
      subtext: 'text-indigo-200',
      pillBg: 'bg-white/10 backdrop-blur-md',
      pillBorder: 'border-white/20',
      accent: 'text-indigo-300'
    },
    slate: {
      bg: 'bg-gradient-to-br from-[#0B0F19] via-[#0F172A] to-[#1E293B]',
      text: 'text-white',
      subtext: 'text-slate-300',
      pillBg: 'bg-white/5 backdrop-blur-md',
      pillBorder: 'border-white/10',
      accent: 'text-sky-400'
    },
    sunset: {
      bg: 'bg-gradient-to-br from-[#4A044E] via-[#831843] to-[#9F1239]',
      text: 'text-white',
      subtext: 'text-rose-200',
      pillBg: 'bg-white/10 backdrop-blur-md',
      pillBorder: 'border-white/20',
      accent: 'text-rose-300'
    },
    emerald: {
      bg: 'bg-gradient-to-br from-[#064E3B] via-[#065F46] to-[#047857]',
      text: 'text-white',
      subtext: 'text-emerald-100',
      pillBg: 'bg-white/10 backdrop-blur-md',
      pillBorder: 'border-white/20',
      accent: 'text-emerald-300'
    }
  };

  const activeThemeConfig = themeStyles[ogTheme];

  // HTML Meta tag snippet for OpenGraph & Twitter
  const metaTagsSnippet = `<!-- Open Graph / Facebook / LinkedIn / WhatsApp -->
<meta property="og:type" content="website" />
<meta property="og:url" content="${currentUrl}" />
<meta property="og:title" content="${ogTitle}" />
<meta property="og:description" content="${ogDesc}" />
<meta property="og:image" content="https://raloa.app/api/og?user=${username}&theme=${ogTheme}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:site_name" content="RALOA" />

<!-- Twitter / X Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@raloa_app" />
<meta name="twitter:creator" content="@${username}" />
<meta name="twitter:title" content="${ogTitle}" />
<meta name="twitter:description" content="${ogDesc}" />
<meta name="twitter:image" content="https://raloa.app/api/og?user=${username}&theme=${ogTheme}" />`;

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(metaTagsSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2200);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // 1200x630 proportion OpenGraph Card Banner
  const renderOgCardBanner = () => (
    <div
      className={`relative w-full aspect-[1.91/1] ${activeThemeConfig.bg} rounded-2xl overflow-hidden p-4 sm:p-5 flex flex-col justify-between select-none shadow-inner`}
    >
      {/* Decorative Grid & Glow Overlay */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 20%, rgba(255,255,255,0.4) 0%, transparent 40%), radial-gradient(circle at 85% 80%, rgba(255,255,255,0.2) 0%, transparent 45%)'
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />

      {/* Top Header of OG Banner */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center p-1">
            <RaloaMark size={20} />
          </div>
          <span className="text-[11px] font-black tracking-wider text-white uppercase font-sans">
            RALOA
          </span>
          <span className="text-[10px] text-white/60 font-mono">
            /@{username}
          </span>
        </div>

        {showBadge && (
          <div
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold text-white border ${activeThemeConfig.pillBg} ${activeThemeConfig.pillBorder} flex items-center gap-1 shadow-2xs`}
          >
            <ShieldCheck className="w-3 h-3 text-emerald-300" />
            <span>{badgeText}</span>
          </div>
        )}
      </div>

      {/* Main Core: Creator Profile + Headline */}
      <div className="relative z-10 my-auto py-2">
        <div className="flex items-center gap-3 mb-2">
          {showAvatar && (
            <div className="relative shrink-0">
              <img
                src={avatar}
                alt={displayName}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover border-2 border-white/40 shadow-md"
                referrerPolicy="no-referrer"
              />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
              </span>
            </div>
          )}

          <div className="min-w-0">
            <h4 className="text-sm sm:text-base font-black text-white leading-tight truncate">
              {displayName}
            </h4>
            <p className="text-[11px] text-white/70 font-medium truncate">
              {role}
            </p>
          </div>
        </div>

        <h3 className="text-xs sm:text-sm md:text-base font-black text-white tracking-tight line-clamp-2 leading-snug drop-shadow-xs">
          {ogTitle}
        </h3>
        <p className="text-[10px] sm:text-xs text-white/75 mt-1 line-clamp-2 leading-relaxed">
          {ogDesc}
        </p>
      </div>

      {/* Bottom Footer Info Chips */}
      <div className="relative z-10 flex items-center justify-between pt-1 border-t border-white/10 text-[9px] sm:text-[10px] text-white/60">
        <div className="flex items-center gap-2">
          {showStats && (
            <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/90 font-medium">
              <span className="inline-flex items-center gap-1">
                <PremiumMark variant="links" className="w-3 h-3" />
                {linksCount} {isRtl ? 'خدمات وروابط' : 'Links & Services'}
              </span>
            </span>
          )}
          <span className="hidden sm:inline-block">
            <span className="inline-flex items-center gap-1">
              <PremiumMark variant="booking" className="w-3 h-3" />
              {isRtl ? 'حجز فوري' : 'Live Booking'}
            </span>
          </span>
        </div>
        <div className="font-mono text-white/80 font-semibold tracking-wide">
          raloa.app/@{username}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`space-y-6 ${isRtl ? 'text-right' : 'text-left'}`}>
      
      {/* Top Banner / Headline */}
      {!isCompact && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-100">
                OpenGraph 1200×630
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                Social SEO
              </span>
            </div>
            <h3 className="text-base font-black text-slate-900">
              {isRtl ? 'مولد المعاينة الاجتماعية (Social Preview)' : 'Social Share & OpenGraph Preview'}
            </h3>
            <p className="text-xs text-slate-500">
              {isRtl
                ? 'تحكم في كيفية ظهور رابط موقعك عند مشاركته على منصات تويتر (X)، لينكدإن، وتطبيقات المراسلة.'
                : 'Preview and fine-tune how your mini-site card renders when shared on Twitter (X), LinkedIn, and messaging apps.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleResetToProfile}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title={isRtl ? 'مزامنة مع الملف الشخصي' : 'Sync from profile'}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{isRtl ? 'مزامنة' : 'Sync'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowCodeSnippet(!showCodeSnippet)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Code className="w-3.5 h-3.5 text-indigo-400" />
              <span>{showCodeSnippet ? (isRtl ? 'إخفاء الكود' : 'Hide Meta') : (isRtl ? 'كود Meta' : 'Meta Code')}</span>
            </button>
          </div>
        </div>
      )}

      {/* HTML Meta Tags Modal/Drawer if open */}
      {showCodeSnippet && (
        <div className="p-4 bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 space-y-3 animate-in fade-in duration-200 font-mono text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-indigo-400 font-bold font-sans">
              <Code className="w-4 h-4" />
              <span>{isRtl ? 'وسوم OpenGraph و Twitter Card الجاهزة' : 'Ready-to-Use OpenGraph & Twitter Meta Tags'}</span>
            </div>
            <button
              type="button"
              onClick={handleCopySnippet}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-sans font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copiedSnippet ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3 text-white" />}
              <span>{copiedSnippet ? (isRtl ? 'تم النسخ!' : 'Copied!') : (isRtl ? 'نسخ الوسوم' : 'Copy HTML Tags')}</span>
            </button>
          </div>
          <pre className="overflow-x-auto p-2 bg-slate-900 rounded-xl text-[11px] leading-relaxed text-slate-300">
            {metaTagsSnippet}
          </pre>
          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-sans">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {isRtl
                ? 'يتم تضمين هذه الوسوم ديناميكياً داخل رأس صفحة موقعك الشخصي على خوادم RALOA Edge.'
                : 'These tags are automatically rendered on edge when crawlers request your public URL.'}
            </span>
          </div>
        </div>
      )}

      {/* Platform Switcher Pills */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setPlatform('twitter')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              platform === 'twitter'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {/* Custom clean X / Twitter Icon */}
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span>Twitter / X</span>
          </button>

          <button
            type="button"
            onClick={() => setPlatform('linkedin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              platform === 'linkedin'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {/* Clean LinkedIn SVG Icon */}
            <svg className="w-3.5 h-3.5 fill-current text-[#0A66C2]" viewBox="0 0 24 24">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.45a1.64 1.64 0 1 0 0 3.27 1.64 1.64 0 0 0 0-3.27z" />
            </svg>
            <span>LinkedIn</span>
          </button>

          <button
            type="button"
            onClick={() => setPlatform('imessage')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              platform === 'imessage'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
            <span>{isRtl ? 'الرسائل والمحادثات' : 'iMessage / Chat'}</span>
          </button>
        </div>

        {/* Copy Share Link */}
        <button
          type="button"
          onClick={handleCopyUrl}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors cursor-pointer"
        >
          {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
          <span>{copiedLink ? (isRtl ? 'تم نسخ الرابط!' : 'URL Copied!') : (isRtl ? 'مشاركة الرابط' : 'Copy Share URL')}</span>
        </button>
      </div>

      {/* PLATFORM MOCKUP STAGE */}
      <div className="bg-slate-100/80 p-3 sm:p-5 rounded-3xl border border-slate-200 shadow-xs">
        
        {/* 1. TWITTER / X POST CARD */}
        {platform === 'twitter' && (
          <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-left">
            {/* Tweet Author Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <img
                  src={avatar}
                  alt={displayName}
                  className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">
                      {displayName}
                    </span>
                    {/* Blue check badge */}
                    <svg className="w-3.5 h-3.5 text-[#1D9BF0] fill-current" viewBox="0 0 24 24">
                      <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.67-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91c-1.31.67-2.19 1.91-2.19 3.34s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.75 4.5l-3.5-3.5 1.41-1.41 2.09 2.08 5.67-5.67 1.41 1.41-7.08 7.09z" />
                    </svg>
                    <span className="text-slate-500 text-xs">@{username}</span>
                    <span className="text-slate-400 text-xs">· 1m</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    {role}
                  </p>
                </div>
              </div>
              <MoreHorizontal className="w-4 h-4 text-slate-400" />
            </div>

            {/* Tweet Text */}
            <p className="text-xs sm:text-[13px] text-slate-800 mb-3 leading-relaxed">
              {isRtl
                ? `أطلقت للتو صفحتي المصغرة الجديدة على RALOA! يمكنك حجز الجلسات مباشرة، الاطلاع على معرض أعمالي، والوصول لكافة الروابط هنا.`
                : `Just refreshed my personal mini-site & digital hub! You can now book sessions, explore my portfolio, and find my curated links in one place.`}
            </p>

            {/* THE CLICKABLE TWITTER CARD (SUMMARY LARGE IMAGE) */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 transition-colors shadow-2xs group cursor-pointer">
              {renderOgCardBanner()}

              {/* Twitter Card Meta Footer */}
              <div className="p-3 bg-slate-50/70 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                  <Globe className="w-3 h-3 text-slate-400" />
                  <span>raloa.app</span>
                </div>
                <h4 className="text-xs sm:text-[13px] font-bold text-slate-900 mt-0.5 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                  {ogTitle}
                </h4>
                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                  {ogDesc}
                </p>
              </div>
            </div>

            {/* Mock Tweet Engagement Buttons */}
            <div className="flex items-center justify-between pt-3 mt-1 text-slate-400 text-[11px] px-2">
              <div className="flex items-center gap-1.5 hover:text-sky-500 transition-colors cursor-pointer">
                <MessageCircle className="w-4 h-4" />
                <span>12</span>
              </div>
              <div className="flex items-center gap-1.5 hover:text-emerald-500 transition-colors cursor-pointer">
                <Repeat className="w-4 h-4" />
                <span>8</span>
              </div>
              <div className="flex items-center gap-1.5 hover:text-rose-500 transition-colors cursor-pointer">
                <Heart className="w-4 h-4" />
                <span>64</span>
              </div>
              <div className="flex items-center gap-1.5 hover:text-indigo-500 transition-colors cursor-pointer">
                <Bookmark className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-1.5 hover:text-indigo-500 transition-colors cursor-pointer">
                <Send className="w-4 h-4" />
              </div>
            </div>
          </div>
        )}

        {/* 2. LINKEDIN POST CARD */}
        {platform === 'linkedin' && (
          <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-left">
            {/* LinkedIn Author Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <img
                    src={avatar}
                    alt={displayName}
                    className="w-11 h-11 rounded-full object-cover border border-slate-200"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">
                      {displayName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">• 1st</span>
                  </div>
                  <p className="text-[11px] text-slate-600 truncate max-w-[280px]">
                    {role} • Creator & Specialist
                  </p>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    <span>2h</span>
                    <span>•</span>
                    <Globe className="w-2.5 h-2.5" />
                  </p>
                </div>
              </div>
              <MoreHorizontal className="w-4 h-4 text-slate-400" />
            </div>

            {/* Post Content */}
            <p className="text-xs text-slate-800 mb-3 leading-relaxed">
              {isRtl
                ? `يسعدني مشاركة المركز الرقمي الموحد لصفحتي المصغرة على منصة RALOA. صُممت لتسهيل حجز الاستشارات وتصفح أحدث المشروعات والمحتوى بدون أي تشتيت.`
                : `Thrilled to share my unified digital hub built on RALOA! It consolidates all my active projects, booking calendar, and client resources into one fast, mobile-first experience.`}
              <span className="text-indigo-600 block mt-1 font-semibold">
                #portfolio #networking #raloa #creators
              </span>
            </p>

            {/* The LinkedIn Link Card */}
            <div className="border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors shadow-2xs group cursor-pointer">
              {renderOgCardBanner()}

              <div className="p-3 bg-slate-50/80 border-t border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                  RALOA.APP
                </span>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug line-clamp-1 group-hover:text-indigo-600 transition-colors">
                  {ogTitle}
                </h4>
                <p className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">
                  {ogDesc}
                </p>
              </div>
            </div>

            {/* LinkedIn Reactions and Engagement */}
            <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100 text-slate-500 text-xs">
              <button className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors py-1 cursor-pointer">
                <ThumbsUp className="w-4 h-4 text-indigo-500" />
                <span className="font-semibold text-[11px]">{isRtl ? 'إعجاب' : 'Like'}</span>
              </button>
              <button className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors py-1 cursor-pointer">
                <MessageCircle className="w-4 h-4" />
                <span className="font-semibold text-[11px]">{isRtl ? 'تعليق' : 'Comment'}</span>
              </button>
              <button className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors py-1 cursor-pointer">
                <Repeat className="w-4 h-4" />
                <span className="font-semibold text-[11px]">{isRtl ? 'إعادة نشر' : 'Repost'}</span>
              </button>
              <button className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors py-1 cursor-pointer">
                <Send className="w-4 h-4" />
                <span className="font-semibold text-[11px]">{isRtl ? 'إرسال' : 'Send'}</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. iMESSAGE / CHAT CARD */}
        {platform === 'imessage' && (
          <div className="max-w-md mx-auto space-y-3">
            <div className="flex items-end gap-2 justify-end">
              <div className="max-w-[340px] bg-indigo-600 text-white rounded-3xl rounded-br-xs p-3 shadow-md">
                <p className="text-xs mb-2">
                  {isRtl ? `تفضل بالاطلاع على موقعي المصغر الجديد:` : `Hey! Check out my new mini-site and booking page:`}
                  <br />
                  <span className="underline opacity-90 font-mono text-[11px]">https://raloa.app/@{username}</span>
                </p>

                {/* Rich iMessage link card preview */}
                <div className="bg-white text-slate-900 rounded-2xl overflow-hidden shadow-inner border border-white/20">
                  {renderOgCardBanner()}
                  <div className="p-2.5 bg-slate-50 text-left">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      RALOA.APP
                    </p>
                    <h5 className="text-xs font-bold text-slate-900 line-clamp-1">
                      {ogTitle}
                    </h5>
                    <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                      {ogDesc}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-center text-[10px] text-slate-400">
              {isRtl ? 'تم التسليم • معاينة iMessage' : 'Delivered • iMessage Rich Link Preview'}
            </p>
          </div>
        )}
      </div>

      {/* CONTROLS & GENERATOR SETTINGS */}
      <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <h4 className="text-xs font-bold text-slate-900">
              {isRtl ? 'إعدادات بطاقة OpenGraph و SEO' : 'Card Customization & OpenGraph Controls'}
            </h4>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Recommended: 1200×630px
          </span>
        </div>

        {/* 1. OG Title */}
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
            <label htmlFor="og-title-input">
              {isRtl ? 'عنوان المشاركة (og:title)' : 'Social Share Title (og:title)'}
            </label>
            <span
              className={`text-[10px] font-mono ${
                ogTitle.length > 60 ? 'text-amber-600 font-bold' : 'text-slate-400'
              }`}
            >
              {ogTitle.length} / 60 {isRtl ? 'حرف' : 'chars'}
            </span>
          </div>
          <input
            id="og-title-input"
            type="text"
            value={ogTitle}
            onChange={(e) => setOgTitle(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
            placeholder={defaultTitle}
          />
        </div>

        {/* 2. OG Description */}
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
            <label htmlFor="og-desc-input">
              {isRtl ? 'وصف المشاركة (og:description)' : 'Social Share Description (og:description)'}
            </label>
            <span
              className={`text-[10px] font-mono ${
                ogDesc.length > 160 ? 'text-amber-600 font-bold' : 'text-slate-400'
              }`}
            >
              {ogDesc.length} / 160 {isRtl ? 'حرف' : 'chars'}
            </span>
          </div>
          <textarea
            id="og-desc-input"
            rows={2}
            value={ogDesc}
            onChange={(e) => setOgDesc(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 resize-none"
            placeholder={defaultDesc}
          />
        </div>

        {/* 3. Theme & Card Color Scheme */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            {isRtl ? 'نمط وخلفية بطاقة المشاركة' : 'Card Visual Theme'}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'gradient', name: isRtl ? 'بنفسجي متدرج' : 'Gradient Iris', color: 'from-[#1E1B4B] to-[#4C1D95]' },
              { id: 'slate', name: isRtl ? 'أسود ليلي' : 'Midnight Slate', color: 'from-[#0B0F19] to-[#1E293B]' },
              { id: 'sunset', name: isRtl ? 'وردي دافئ' : 'Sunset Rose', color: 'from-[#4A044E] to-[#9F1239]' },
              { id: 'emerald', name: isRtl ? 'زمردي عصري' : 'Emerald Mint', color: 'from-[#064E3B] to-[#047857]' }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setOgTheme(t.id as OgTheme)}
                className={`p-2.5 rounded-xl border text-left rtl:text-right flex items-center gap-2 transition-all cursor-pointer ${
                  ogTheme === t.id
                    ? 'border-indigo-600 ring-2 ring-indigo-500/10 bg-indigo-50/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-gradient-to-r ${t.color} shrink-0`} />
                <span className="text-[11px] font-bold text-slate-800 truncate">
                  {t.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 4. Display Toggles & Badge */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* Badge text */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              {isRtl ? 'شارة التحقق' : 'Badge Tag'}
            </label>
            <input
              type="text"
              value={badgeText}
              onChange={(e) => setBadgeText(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Verified Creator"
            />
          </div>

          {/* Toggle Avatar */}
          <div className="flex items-center justify-between sm:justify-start gap-2 pt-5">
            <input
              id="toggle-avatar"
              type="checkbox"
              checked={showAvatar}
              onChange={(e) => setShowAvatar(e.target.checked)}
              className="w-4 h-4 rounded-sm text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
            />
            <label htmlFor="toggle-avatar" className="text-xs text-slate-700 font-medium cursor-pointer">
              {isRtl ? 'عرض الصورة الرمزية' : 'Show Profile Avatar'}
            </label>
          </div>

          {/* Toggle Stats */}
          <div className="flex items-center justify-between sm:justify-start gap-2 pt-5">
            <input
              id="toggle-stats"
              type="checkbox"
              checked={showStats}
              onChange={(e) => setShowStats(e.target.checked)}
              className="w-4 h-4 rounded-sm text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
            />
            <label htmlFor="toggle-stats" className="text-xs text-slate-700 font-medium cursor-pointer">
              {isRtl ? 'عرض عدد الخدمات' : 'Show Links Counter'}
            </label>
          </div>
        </div>

        {/* 5. Health Check Checklist */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-600">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Aspect Ratio: <strong>1.91:1 (1200×630)</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Card Type: <strong>summary_large_image</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Fast CDN Cached</span>
          </div>
        </div>

      </div>

    </div>
  );
};
