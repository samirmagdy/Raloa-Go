import React, { useState } from 'react';
import { ExternalLink, CheckCircle2, ArrowUpRight, Globe, Layers, Users } from 'lucide-react';
import { Locale } from '../types';
import { PlatformIcon } from './brand/PlatformIcon';

interface SocialProofMarqueeProps {
  locale: Locale;
  onOpenSiteModal?: (site: PublishedSite) => void;
}

export interface PublishedSite {
  id: string;
  name: string;
  nameAr: string;
  handle: string;
  role: string;
  roleAr: string;
  category: string;
  categoryAr: string;
  avatar: string;
  cover?: string;
  accent: string;
  stats: string;
  statsAr: string;
}

export interface PartnerCompany {
  id: string;
  name: string;
  handle: string;
  team: string;
  teamAr: string;
  logoSvg: React.ReactNode;
  category: string;
  categoryAr: string;
}

const PUBLISHED_USER_SITES: PublishedSite[] = [
  {
    id: 'site-elena',
    name: 'Elena Vance',
    nameAr: 'إيلينا فانس',
    handle: 'raloa.app/@elena',
    role: 'Architectural & Space Photographer',
    roleAr: 'مصورة معمارية وتصميم مساحات',
    category: 'Portfolio',
    categoryAr: 'معرض أعمال',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    accent: '#5B5CF6',
    stats: '24k views/mo',
    statsAr: '٢٤ ألف زيارة/شهر'
  },
  {
    id: 'site-forma',
    name: 'Forma Spatial Studio',
    nameAr: 'استوديو فورما للتصميم',
    handle: 'raloa.app/@forma',
    role: 'Interior Architecture & Minimal Living',
    roleAr: 'هندسة معمارية وتصميم داخلي',
    category: 'Agency',
    categoryAr: 'استوديو تصميم',
    avatar: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=120&q=80',
    accent: '#0070F3',
    stats: '18k bookings',
    statsAr: '١٨ ألف حجز'
  },
  {
    id: 'site-tariq',
    name: 'Dr. Tariq Al-Mansoor',
    nameAr: 'د. طارق المنصور',
    handle: 'raloa.app/@dr-tariq',
    role: 'Angel Investor & Venture Partner',
    roleAr: 'مستثمر ملائكي وشريك استثماري',
    category: 'Executive',
    categoryAr: 'أعمال واستثمار',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
    accent: '#10B981',
    stats: '95k followers',
    statsAr: '٩٥ ألف متابع'
  },
  {
    id: 'site-nexus',
    name: 'Nexus Audio Labs',
    nameAr: 'نيكسوس للأبحاث الصوتية',
    handle: 'raloa.app/@nexus-sound',
    role: 'Grammy-Nominated Music Production',
    roleAr: 'إنتاج موسيقي وهندسة صوتية',
    category: 'Music & Audio',
    categoryAr: 'موسيقى وصوتيات',
    avatar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=120&q=80',
    accent: '#7C3AED',
    stats: '4.8 rated',
    statsAr: 'تقييم ٤.٨'
  },
  {
    id: 'site-layla',
    name: 'Layla Al-Khatib',
    nameAr: 'ليلى الخطيب',
    handle: 'raloa.app/@layla-cooks',
    role: 'Culinary Stylist & Cookbook Author',
    roleAr: 'مؤلفة كتب طهي ومنسقة أطباق',
    category: 'Culinary',
    categoryAr: 'فن الطهي',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80',
    accent: '#F59E0B',
    stats: '140k readers',
    statsAr: '١٤٠ ألف قارئ'
  },
  {
    id: 'site-kite',
    name: 'Kite & Oak Roasters',
    nameAr: 'كايت أند أوك روسترز',
    handle: 'raloa.app/@kiteandoak',
    role: 'Artisan Micro-Roastery & Café',
    roleAr: 'محمصة قهوة مختصة ومتجر',
    category: 'Commerce',
    categoryAr: 'متجر وتجارة',
    avatar: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=120&q=80',
    accent: '#D97706',
    stats: 'Verified Shop',
    statsAr: 'متجر موثق'
  },
  {
    id: 'site-vertex',
    name: 'Vertex AI Collective',
    nameAr: 'فيرتكس للذكاء الاصطناعي',
    handle: 'raloa.app/@vertex-ai',
    role: 'Applied Machine Learning Researchers',
    roleAr: 'أبحاث الذكاء الاصطناعي التطبيقي',
    category: 'Tech & Research',
    categoryAr: 'تكنولوجيا وأبحاث',
    avatar: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=120&q=80',
    accent: '#06B6D4',
    stats: '320+ citations',
    statsAr: '٣٢٠+ اقتباس علمي'
  },
  {
    id: 'site-sora',
    name: 'Sora Ceramics',
    nameAr: 'سورا للخزف الفني',
    handle: 'raloa.app/@sora-goods',
    role: 'Handcrafted Minimalist Pottery',
    roleAr: 'خزف يدوي ومستلزمات منزلية',
    category: 'Art & Craft',
    categoryAr: 'فنون وخزف',
    avatar: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=120&q=80',
    accent: '#EC4899',
    stats: 'Drops in 2m',
    statsAr: 'نفاد الكمية بدقيقتين'
  }
];

const PARTNER_COMPANIES: PartnerCompany[] = [
  {
    id: 'comp-linear',
    name: 'Linear',
    handle: 'raloa.app/@linear-community',
    team: 'Community & DevRel',
    teamAr: 'مجتمع المطورين والمستخدمين',
    category: 'Software',
    categoryAr: 'برمجيات',
    logoSvg: (
      <svg className="w-5 h-5 fill-current" viewBox="0 0 100 100">
        <path d="M1.22 63.64C7.03 76.84 17.5 87.24 30.76 92.94L30.76 6.94C17.5 12.64 7.03 23.04 1.22 36.24L1.22 63.64ZM98.78 36.36C92.97 23.16 82.5 12.76 69.24 7.06L69.24 93.06C82.5 87.36 92.97 76.96 98.78 63.76L98.78 36.36ZM50 0C47.2 0 44.47 0.28 41.83 0.81L41.83 99.19C44.47 99.72 47.2 100 50 100C52.8 100 55.53 99.72 58.17 99.19L58.17 0.81C55.53 0.28 52.8 0 50 0Z" />
      </svg>
    )
  },
  {
    id: 'comp-vercel',
    name: 'Vercel',
    handle: 'raloa.app/@vercel-dx',
    team: 'Frontend Cloud & DX Teams',
    teamAr: 'فريق تجربة المطورين والحوسبة السحابية',
    category: 'Cloud',
    categoryAr: 'سحابة وتطوير',
    logoSvg: (
      <svg className="w-5 h-5 fill-current" viewBox="0 0 116 100">
        <path fillRule="evenodd" clipRule="evenodd" d="M57.5 0L115 100H0L57.5 0Z" />
      </svg>
    )
  },
  {
    id: 'comp-notion',
    name: 'Notion',
    handle: 'raloa.app/@notion-creators',
    team: 'Global Creator Ecosystem',
    teamAr: 'منظومة المبدعين العالمية',
    category: 'Productivity',
    categoryAr: 'إنتاجية وتنظيم',
    logoSvg: (
      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.466-.373-.933-.513-1.68-.466L3.48 2.528c-.42.046-.513.28-.327.466l1.306 1.214zm1.446 3.687v12.879c0 .747.373 1.027 1.213.98l13.914-.84c.84-.046.933-.606.933-1.213V6.634c0-.607-.28-.887-.84-.84l-14.38.887c-.607.047-.84.42-.84.887zm13.12 1.493c.094.42 0 .84-.42.887l-.84.14v8.446c-.513.28-.98.42-1.446.42-.746 0-.933-.233-1.493-1.027l-4.573-7.093v6.72l1.213.28c.373.093.42.42.42.84 0 .42-.187.56-.56.56l-3.36.187c-.093-.42 0-.84.42-.887l.84-.14V9.66c0-.513-.187-.653-.746-.7l-.84-.14c-.093-.42 0-.84.42-.887l3.64-.233c.747 0 1.073.327 1.493 1.027l4.48 6.953V9.613l-1.12-.28c-.373-.093-.42-.42-.42-.84 0-.42.187-.56.56-.56l3.36-.187c.047 0 .14.047.14.093z" />
      </svg>
    )
  },
  {
    id: 'comp-figma',
    name: 'Figma',
    handle: 'raloa.app/@figma-designers',
    team: 'Design Advocates & Community',
    teamAr: 'رواد التصميم ومجتمع المبدعين',
    category: 'Design',
    categoryAr: 'تصميم وواجهات',
    logoSvg: (
      <svg className="w-4 h-5 fill-current" viewBox="0 0 38 57">
        <path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z" />
        <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" />
        <path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z" />
        <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z" />
        <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z" />
      </svg>
    )
  },
  {
    id: 'comp-shopify',
    name: 'Shopify',
    handle: 'raloa.app/@shopify-merchants',
    team: 'Independent Brands Collective',
    teamAr: 'مجتمع العلامات التجارية المستقلة',
    category: 'Commerce',
    categoryAr: 'تجارة ومبيعات',
    logoSvg: (
      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
        <path d="M15.42 2.68c-.06-.41-.42-.68-.83-.68l-3.32.33c-.26-.74-.83-1.33-1.63-1.33-.2 0-.41.04-.61.12L7.3 2.05c-.32.13-.5.48-.41.82l.85 3.3-4.9 1.48c-.4.12-.55.6-.29.92l5.73 7.02L18.42 24l5.3-2.02L15.42 2.68zm-6.19-.74c.48 0 .8.34 1.05.86l-2.07.61.8-1.37c.07-.07.14-.1.22-.1z" />
      </svg>
    )
  },
  {
    id: 'comp-stripe',
    name: 'Stripe',
    handle: 'raloa.app/@stripe-startups',
    team: 'Global Creator Payouts',
    teamAr: 'بنية المدفوعات العالمية للمبدعين',
    category: 'Finance',
    categoryAr: 'مدفوعات مالية',
    logoSvg: (
      <PlatformIcon name="stripe" className="w-5 h-5" title="Stripe" />
    )
  },
  {
    id: 'comp-substack',
    name: 'Substack',
    handle: 'raloa.app/@substack-writers',
    team: 'Editorial & Independent Press',
    teamAr: 'الصحافة المستقلة والكتاب المحترفون',
    category: 'Publishing',
    categoryAr: 'نشر ومحتوى',
    logoSvg: (
      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
        <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" />
      </svg>
    )
  },
  {
    id: 'comp-spotify',
    name: 'Spotify',
    handle: 'raloa.app/@spotify-creators',
    team: 'Artists & Podcasters Network',
    teamAr: 'شبكة الفنانين وصناع البودكاست',
    category: 'Audio',
    categoryAr: 'صوتيات وموسيقى',
    logoSvg: (
      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.48.66.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
      </svg>
    )
  }
];

export const SocialProofMarquee: React.FC<SocialProofMarqueeProps> = ({
  locale,
  onOpenSiteModal
}) => {
  const isRtl = locale === 'ar';
  const [activeTab, setActiveTab] = useState<'sites' | 'companies'>('sites');

  // Double the lists to guarantee seamless, uninterrupted infinite loop
  const doubledSites = [...PUBLISHED_USER_SITES, ...PUBLISHED_USER_SITES];
  const doubledCompanies = [...PARTNER_COMPANIES, ...PARTNER_COMPANIES];

  return (
    <div className="w-full py-8 overflow-hidden select-none" id="social-proof-marquee">
      {/* Eyebrow Header with Mode Toggles */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
            {isRtl
              ? 'مواقع منشورة حية وتجارب حقيقية عبر رالوا'
              : 'Over 25,000+ live mini-sites & teams published with RALOA'}
          </span>
        </div>

        {/* Segmented Filter Pills */}
        <div
          role="tablist"
          aria-label={isRtl ? 'تبديل العرض' : 'Toggle marquee view'}
          className="inline-flex p-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-[12px] font-semibold"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'sites'}
            onClick={() => setActiveTab('sites')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all duration-200 cursor-pointer ${
              activeTab === 'sites'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
            <span>{isRtl ? 'مواقع المستخدمين' : 'Published Sites'}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 font-mono">
              Live
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'companies'}
            onClick={() => setActiveTab('companies')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all duration-200 cursor-pointer ${
              activeTab === 'companies'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            <span>{isRtl ? 'الشركات والفرق' : 'Companies & Teams'}</span>
          </button>
        </div>
      </div>

      {/* Marquee Wrapper with Side Gradient Fade Masks */}
      <div className="relative w-full overflow-hidden">
        {/* Left Gradient Edge Fade */}
        <div
          className="absolute top-0 bottom-0 left-0 w-16 sm:w-32 z-10 pointer-events-none bg-gradient-to-r from-white dark:from-slate-950 via-white/80 dark:via-slate-950/80 to-transparent"
          aria-hidden="true"
        />

        {/* Right Gradient Edge Fade */}
        <div
          className="absolute top-0 bottom-0 right-0 w-16 sm:w-32 z-10 pointer-events-none bg-gradient-to-l from-white dark:from-slate-950 via-white/80 dark:via-slate-950/80 to-transparent"
          aria-hidden="true"
        />

        {/* TRACK 1: User Sites Published */}
        {activeTab === 'sites' && (
          <div className="flex flex-col gap-3.5">
            {/* Top Row - Forward Direction */}
            <div className="animate-marquee-track hover:[animation-play-state:paused] flex items-center gap-4 py-1">
              {doubledSites.map((site, idx) => (
                <div
                  key={`${site.id}-${idx}`}
                  onClick={() => onOpenSiteModal?.(site)}
                  className="group relative flex items-center gap-3.5 px-4 py-2.5 bg-white hover:bg-slate-50/90 dark:bg-slate-900 dark:hover:bg-slate-850 rounded-2xl border border-slate-200/90 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500 shadow-[0_4px_16px_rgba(15,23,42,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_24px_rgba(99,102,241,0.12)] transition-all duration-200 cursor-pointer shrink-0"
                >
                  {/* Avatar with live pulse dot */}
                  <div className="relative shrink-0">
                    <img
                      src={site.avatar}
                      alt={site.name}
                      className="w-10 h-10 rounded-xl object-cover border border-slate-100 dark:border-slate-800 shadow-xs"
                      loading="lazy"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                  </div>

                  {/* Info */}
                  <div className="flex flex-col min-w-[170px] max-w-[210px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[14px] text-slate-900 dark:text-white truncate">
                        {isRtl ? site.nameAr : site.name}
                      </span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    </div>

                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {site.handle}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-1 pt-1 border-t border-slate-100/80 dark:border-slate-800">
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate">
                        {isRtl ? site.categoryAr : site.category}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded-full">
                        {isRtl ? site.statsAr : site.stats}
                      </span>
                    </div>
                  </div>

                  {/* External peek indicator */}
                  <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ps-1">
                    <ArrowUpRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Row - Reverse Direction for Dynamic Kinetic Effect */}
            <div className="animate-marquee-track-reverse hover:[animation-play-state:paused] flex items-center gap-4 py-1">
              {[...doubledSites].reverse().map((site, idx) => (
                <div
                  key={`rev-${site.id}-${idx}`}
                  onClick={() => onOpenSiteModal?.(site)}
                  className="group relative flex items-center gap-3.5 px-4 py-2.5 bg-white/95 hover:bg-slate-50 dark:bg-slate-900/95 dark:hover:bg-slate-850 rounded-2xl border border-slate-200/90 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500 shadow-[0_4px_16px_rgba(15,23,42,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_24px_rgba(99,102,241,0.12)] transition-all duration-200 cursor-pointer shrink-0"
                >
                  <div className="relative shrink-0">
                    <img
                      src={site.avatar}
                      alt={site.name}
                      className="w-10 h-10 rounded-xl object-cover border border-slate-100 dark:border-slate-800 shadow-xs"
                      loading="lazy"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                  </div>

                  <div className="flex flex-col min-w-[170px] max-w-[210px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[14px] text-slate-900 dark:text-white truncate">
                        {isRtl ? site.nameAr : site.name}
                      </span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    </div>

                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {site.handle}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-1 pt-1 border-t border-slate-100/80 dark:border-slate-800">
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate">
                        {isRtl ? site.categoryAr : site.category}
                      </span>
                      <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-1.5 py-0.5 rounded-full">
                        {isRtl ? site.statsAr : site.stats}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ps-1">
                    <ArrowUpRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TRACK 2: Companies & Teams Using RALOA */}
        {activeTab === 'companies' && (
          <div className="flex flex-col gap-3.5">
            <div className="animate-marquee-track hover:[animation-play-state:paused] flex items-center gap-4 py-1">
              {doubledCompanies.map((comp, idx) => (
                <div
                  key={`${comp.id}-${idx}`}
                  className="group relative flex items-center gap-3.5 px-5 py-3 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-850 rounded-2xl border border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-[0_4px_16px_rgba(15,23,42,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] transition-all duration-200 shrink-0"
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform border border-transparent dark:border-slate-700">
                    {comp.logoSvg}
                  </div>

                  <div className="flex flex-col min-w-[150px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-[15px] text-slate-900 dark:text-white">
                        {comp.name}
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {isRtl ? comp.categoryAr : comp.category}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {comp.handle}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {isRtl ? comp.teamAr : comp.team}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="animate-marquee-track-reverse hover:[animation-play-state:paused] flex items-center gap-4 py-1">
              {[...doubledCompanies].reverse().map((comp, idx) => (
                <div
                  key={`rev-comp-${comp.id}-${idx}`}
                  className="group relative flex items-center gap-3.5 px-5 py-3 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-850 rounded-2xl border border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-[0_4px_16px_rgba(15,23,42,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] transition-all duration-200 shrink-0"
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform border border-transparent dark:border-slate-700">
                    {comp.logoSvg}
                  </div>

                  <div className="flex flex-col min-w-[150px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-[15px] text-slate-900 dark:text-white">
                        {comp.name}
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {isRtl ? comp.categoryAr : comp.category}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {comp.handle}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {isRtl ? comp.teamAr : comp.team}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
