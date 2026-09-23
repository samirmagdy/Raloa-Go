import React, { useMemo } from 'react';
import {
  Globe,
  Calendar,
  ShoppingBag,
  BarChart3,
  Image,
  Share2,
  Search,
  Sliders,
  ArrowRight
} from 'lucide-react';
import { Locale } from '../types';
import { featuresList, dictionary } from '../data/content';
import { usePageSEO } from '../hooks/usePageSEO';

interface FeatureGridProps {
  locale: Locale;
  onExploreFeatures: () => void;
}

export const FeatureGrid: React.FC<FeatureGridProps> = ({ locale, onExploreFeatures }) => {
  const isRtl = locale === 'ar';
  const t = dictionary[locale].featuresSection;

  const seoKeywords = useMemo(
    () =>
      isRtl
        ? ['مميزات رالوا', 'أدوات المبدعين', 'متجر رقمي', 'حجز مواعيد', 'تحليلات الزوار']
        : ['raloa features', 'link in bio creator tools', 'digital downloads store', 'calendar booking widget'],
    [isRtl]
  );

  const seoMetaTags = useMemo(
    () => [
      { name: 'robots', content: 'index, follow' },
      { name: 'section', content: 'features' }
    ],
    []
  );

  // Section-specific SEO hook passing unique OpenGraph description & meta tags to useSEO
  usePageSEO({
    sectionId: 'features',
    locale,
    title: isRtl
      ? 'مميزات وأدوات صناع المحتوى المتكاملة — رالوا'
      : 'Creator Tools & Integrated Mini-Site Features — RALOA',
    description: isRtl
      ? 'نطاقات مخصصة، متجر رقمي متكامل، نظام حجز مواعيد، معارض وسائط متقدمة، وتحليلات فورية في منصة موحدة.'
      : 'Custom domains, instant digital storefronts, calendar bookings, portfolio galleries, real-time analytics, and SEO optimization in one place.',
    ogTitle: isRtl
      ? 'أدوات ومميزات متطورة لصناع المحتوى والمهنيين — رالوا'
      : 'All-in-One Creator Toolkit — Modern Mini-Sites by RALOA',
    ogDescription: isRtl
      ? 'كل ما يحتاجه المبدع في منصة واحدة: نطاقات خاصة، مبيعات بدون عمولة، حجوزات مباشرة وتحليلات فورية.'
      : 'Everything you need: custom domains, zero commission digital sales, booking schedules, and real-time UTM analytics.',
    ogImage: 'https://raloa.app/images/og-features.png',
    keywords: seoKeywords,
    metaTags: seoMetaTags
  });

  const renderIcon = (name: string) => {

    switch (name) {
      case 'globe':
        return <Globe className="w-5 h-5 text-blue-600" />;
      case 'calendar':
        return <Calendar className="w-5 h-5 text-pink-600" />;
      case 'shopping-bag':
        return <ShoppingBag className="w-5 h-5 text-purple-600" />;
      case 'bar-chart-3':
        return <BarChart3 className="w-5 h-5 text-blue-600" />;
      case 'image':
        return <Image className="w-5 h-5 text-sky-600" />;
      case 'share-2':
        return <Share2 className="w-5 h-5 text-emerald-600" />;
      case 'search':
        return <Search className="w-5 h-5 text-teal-600" />;
      case 'sliders':
      default:
        return <Sliders className="w-5 h-5 text-amber-600" />;
    }
  };

  return (
    <section id="features" className="py-14 sm:py-20 md:py-28 bg-[#F8FAFC] dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 transition-colors duration-200">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-6">
          <div className="max-w-[640px]">
            <span className="text-[12px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-2">
              {t.eyebrow}
            </span>
            <h2 className="text-[32px] sm:text-[40px] md:text-[46px] font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-[1.1]">
              {t.headline}
            </h2>
            <p className="text-[16px] sm:text-[18px] text-slate-600 dark:text-slate-300 mt-2 font-normal">
              {t.subheadline}
            </p>
          </div>

          <button
            onClick={onExploreFeatures}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 text-slate-800 dark:text-slate-200 text-[14px] font-bold shadow-2xs hover:shadow-sm transition-all whitespace-nowrap self-start md:self-auto cursor-pointer"
          >
            <span>{t.seeAll}</span>
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </button>
        </div>

        {/* 8-Card Grid (4x2 on desktop, 2x4 on tablet, 1x8 on mobile) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuresList.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 rounded-[20px] p-6 border border-slate-200 dark:border-slate-800 shadow-[0_4px_16px_rgba(15,23,42,0.03)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] dark:hover:shadow-[0_12px_28px_rgba(0,0,0,0.5)] transition-all duration-300 group hover:-translate-y-1 flex flex-col items-center text-center lg:items-start lg:text-start"
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110 duration-200"
                style={{ backgroundColor: item.bgColor }}
              >
                {renderIcon(item.icon)}
              </div>

              <h3 className="font-extrabold text-[17px] text-[#0F172A] dark:text-white tracking-tight mb-1.5 leading-snug">
                {isRtl ? item.titleAr : item.title}
              </h3>

              <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                {isRtl ? item.bodyAr : item.body}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
