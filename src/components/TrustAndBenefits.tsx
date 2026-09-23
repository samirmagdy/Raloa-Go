import React from 'react';
import { Zap, Palette, TrendingUp, Monitor } from 'lucide-react';
import { Locale } from '../types';
import { benefitsList } from '../data/content';
import { SocialProofMarquee, PublishedSite } from './SocialProofMarquee';

interface TrustAndBenefitsProps {
  locale: Locale;
  onOpenPublishedSite?: (site: PublishedSite) => void;
}

export const TrustAndBenefits: React.FC<TrustAndBenefitsProps> = ({ locale, onOpenPublishedSite }) => {
  const isRtl = locale === 'ar';

  const getIcon = (iconName: string, color: string) => {
    switch (iconName) {
      case 'zap':
        return <Zap className="w-5 h-5 text-[#EC4899]" />;
      case 'palette':
        return <Palette className="w-5 h-5 text-[#3B82F6]" />;
      case 'trending-up':
        return <TrendingUp className="w-5 h-5 text-[#10B981]" />;
      case 'devices':
      default:
        return <Monitor className="w-5 h-5 text-[#7C3AED]" />;
    }
  };

  return (
    <section id="benefits" className="pt-4 pb-14 sm:pb-18 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800/80 overflow-hidden transition-colors duration-200">
      {/* 01 Auto-Scrolling Horizontal Marquee: Published User Sites & Companies */}
      <SocialProofMarquee
        locale={locale}
        onOpenSiteModal={onOpenPublishedSite}
      />

      {/* 02 Core Platform Value Pillars */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 mt-10 sm:mt-14">
        {/* 4 Benefit Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefitsList.map((benefit) => (
            <div
              key={benefit.id}
              className="bg-white dark:bg-slate-900 rounded-[20px] p-6 border border-slate-200/90 dark:border-slate-800 shadow-[0_6px_18px_rgba(15,23,42,0.04)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] dark:hover:shadow-[0_12px_28px_rgba(0,0,0,0.5)] transition-all duration-300 flex flex-col justify-start group hover:-translate-y-1"
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110 duration-200"
                style={{ backgroundColor: benefit.bgColor }}
              >
                {getIcon(benefit.icon, benefit.color)}
              </div>

              <h3 className="font-extrabold text-[17px] text-[#0F172A] dark:text-white tracking-tight leading-snug mb-2">
                {isRtl ? benefit.titleAr : benefit.title}
              </h3>

              <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                {isRtl ? benefit.bodyAr : benefit.body}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
