import React, { useState, useMemo } from 'react';
import { Check, ArrowRight } from 'lucide-react';
import { Locale, PricingPlan } from '../types';
import { pricingPlans, dictionary } from '../data/content';
import { usePageSEO } from '../hooks/usePageSEO';

interface PricingTableProps {
  locale: Locale;
  onSelectPlan: (plan: PricingPlan, isYearly: boolean) => void;
}

export const PricingTable: React.FC<PricingTableProps> = ({ locale, onSelectPlan }) => {
  const [isYearly, setIsYearly] = useState(false);
  const isRtl = locale === 'ar';
  const t = dictionary[locale].pricingSection;

  const seoKeywords = useMemo(
    () =>
      isRtl
        ? ['أسعار رالوا', 'اشتراك مجاني', 'باقة المحترفين', 'نطاق مخصص', 'بيع رقمي بدون عمولة']
        : ['raloa pricing', 'free link in bio', 'pro creator plan', 'custom domain bio link', 'zero commission creator store'],
    [isRtl]
  );

  const seoMetaTags = useMemo(
    () => [
      { name: 'robots', content: 'index, follow' },
      { name: 'section', content: 'pricing' },
      { property: 'product:price:currency', content: 'USD' }
    ],
    []
  );

  const seoJsonLd = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'OfferCatalog',
      name: isRtl ? 'باقات اشتراك رالوا' : 'RALOA Subscription Plans',
      itemListElement: pricingPlans.map((plan, idx) => ({
        '@type': 'Offer',
        position: idx + 1,
        name: isRtl ? plan.nameAr : plan.name,
        price: plan.priceMonthly.toString(),
        priceCurrency: 'USD',
        description: isRtl ? plan.descriptionAr : plan.description
      }))
    }),
    [isRtl]
  );

  // Section-specific SEO hook passing unique OpenGraph description & meta tags to useSEO
  usePageSEO({
    sectionId: 'pricing',
    locale,
    title: isRtl
      ? 'خطط الأسعار الشفافة — مجانية واحترافية وبدون عمولات | رالوا'
      : 'Transparent Pricing Plans — Free, Pro & Studio | RALOA',
    description: isRtl
      ? 'ابدأ مجاناً مدى الحياة أو اختر باقة المحترفين للنطاقات المخصصة، بدون عمولات مبيعات، وتحليلات متقدمة ودعم أولوية.'
      : 'Start free forever or unlock custom domains, zero transaction fees, deep analytics and VIP priority support with RALOA Pro.',
    ogTitle: isRtl
      ? 'باقات وأسعار رالوا — انطلق مجاناً بدون رسوم خفية'
      : 'Transparent Pricing with No Hidden Fees — Free & Pro Plans | RALOA',
    ogDescription: isRtl
      ? 'أسعار واضحة بدون عمولات بيع مخفية. باقة مجانية وباقات احترافية للنطاقات المخصصة وتسييل المحتوى.'
      : 'Transparent pricing with zero transaction fees on your digital sales. Build for free or upgrade for custom domains and advanced tools.',
    ogImage: 'https://raloa.app/images/og-pricing.png',
    keywords: seoKeywords,
    metaTags: seoMetaTags,
    jsonLd: seoJsonLd
  });

  return (

    <section id="pricing" className="py-14 sm:py-20 md:py-28 bg-[#F8FAFC] dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 transition-colors duration-200">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-[640px] mx-auto mb-12">
          <span className="text-[12px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-2">
            {t.eyebrow}
          </span>
          <h2 className="text-[34px] sm:text-[42px] md:text-[48px] font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-tight">
            {t.headline}
          </h2>
          <p className="text-[16px] sm:text-[18px] text-slate-600 dark:text-slate-300 mt-2 font-normal">
            {t.subheadline}
          </p>

          {/* Billing Cycle Toggle */}
          <div className="inline-flex items-center gap-1 p-1 bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 shadow-2xs mt-8">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                !isYearly
                  ? 'bg-[#0F172A] dark:bg-white text-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.monthly}
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                isYearly
                  ? 'bg-[#0F172A] dark:bg-white text-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{t.yearly}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                {t.saveBadge}
              </span>
            </button>
          </div>
        </div>

        {/* 3 Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch pt-4">
          {pricingPlans.map((plan) => {
            const isPopular = plan.popular;
            const price = plan.priceMonthly === 0 ? 0 : isYearly ? plan.priceYearly : plan.priceMonthly;
            const formattedPrice = plan.priceMonthly === 0 ? '$0' : `$${price.toFixed(price % 1 === 0 ? 0 : 2)}`;

            return (
              <div
                key={plan.id}
                className={`relative bg-white dark:bg-slate-900 rounded-[24px] p-8 border transition-all duration-300 flex flex-col items-center text-center lg:items-start lg:text-start justify-between ${
                  isPopular
                    ? 'border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/20 dark:ring-indigo-500/40 shadow-[0_16px_40px_rgba(91,92,246,0.12)] dark:shadow-[0_16px_40px_rgba(91,92,246,0.25)] lg:-translate-y-2'
                    : 'border-slate-200 dark:border-slate-800 shadow-[0_6px_20px_rgba(15,23,42,0.04)] dark:shadow-[0_6px_20px_rgba(0,0,0,0.3)] hover:shadow-lg dark:hover:shadow-2xl'
                }`}
              >
                {/* Popular Pill */}
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[11px] font-extrabold tracking-wide uppercase shadow-sm">
                    {t.popularBadge}
                  </div>
                )}

                <div>
                  {/* Plan Name & Desc */}
                  <h3 className="font-extrabold text-[22px] text-[#0F172A] dark:text-white tracking-tight mb-1">
                    {isRtl ? plan.nameAr : plan.name}
                  </h3>
                  <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-6 min-h-[38px]">
                    {isRtl ? plan.descriptionAr : plan.description}
                  </p>

                  {/* Price */}
                  <div className="flex items-baseline gap-1.5 mb-7">
                    <span className="text-[44px] font-black text-[#0F172A] dark:text-white tracking-tight leading-none">
                      {formattedPrice}
                    </span>
                    <span className="text-[14px] text-slate-500 dark:text-slate-400 font-medium">
                      / {isRtl ? plan.periodAr : plan.period}
                    </span>
                  </div>

                  {/* Feature Checklist */}
                  <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800 mb-8 w-full">
                    {(isRtl ? plan.featuresAr : plan.features).map((feat, idx) => (
                      <div key={idx} className="flex items-start justify-center lg:justify-start gap-3 text-center lg:text-start">
                        <div className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                        <span className="text-[14px] text-slate-700 dark:text-slate-300 leading-tight">
                          {feat}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Plan Action CTA */}
                <button
                  onClick={() => onSelectPlan(plan, isYearly)}
                  className={`w-full py-3.5 px-6 rounded-full font-bold text-[14px] transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isPopular
                      ? 'bg-[#0F172A] hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 shadow-md hover:scale-[1.01]'
                      : 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-[#0F172A] dark:text-white border border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <span>{isRtl ? plan.ctaTextAr : plan.ctaText}</span>
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </button>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
