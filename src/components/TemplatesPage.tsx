import React from 'react';
import { ArrowLeft, ArrowRight, Eye } from 'lucide-react';
import { Locale, TemplateItem } from '../types';
import { templatesData } from '../data/content';
import { RaloaLogo } from './brand/RaloaLogo';
import { usePageSEO } from '../hooks/usePageSEO';
import { FadeInSection } from './FadeInSection';

interface TemplatesPageProps {
  locale: Locale;
  onReturnHome: () => void;
  onSelectTemplate: (template: TemplateItem) => void;
}

export const TemplatesPage: React.FC<TemplatesPageProps> = ({ locale, onReturnHome, onSelectTemplate }) => {
  const isRtl = locale === 'ar';

  usePageSEO({
    sectionId: 'templates-page',
    locale,
    title: isRtl ? 'كل قوالب رالوا — معرض التصاميم' : 'All Templates — RALOA Design Gallery',
    description: isRtl ? 'استعرض جميع قوالب رالوا المتجاوبة واختر التصميم المناسب لموقعك المصغر.' : 'Browse every responsive RALOA template and choose the right design for your mini-site.',
    ogTitle: isRtl ? 'معرض قوالب رالوا' : 'RALOA Template Gallery',
    ogDescription: isRtl ? 'كل القوالب في مكان واحد.' : 'Explore every RALOA template in one place.',
    keywords: isRtl ? ['قوالب رالوا', 'تصاميم مواقع مصغرة', 'قوالب بايو'] : ['RALOA templates', 'creator website templates', 'link in bio designs'],
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: isRtl ? 'معرض قوالب رالوا' : 'RALOA Template Gallery',
      numberOfItems: templatesData.length,
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: templatesData.map((template, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: template.name
        }))
      }
    }
  });

  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const ForwardIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <button type="button" onClick={onReturnHome} aria-label={isRtl ? 'العودة إلى الرئيسية' : 'Return home'} className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
            <RaloaLogo isRtl={isRtl} size="md" />
          </button>
          <button type="button" onClick={onReturnHome} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <BackIcon className="w-4 h-4" />
            <span>{isRtl ? 'العودة للرئيسية' : 'Back to home'}</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <FadeInSection id="templates-page-header">
          <div className="max-w-3xl mb-10 sm:mb-14">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">{isRtl ? 'معرض التصاميم' : 'Design gallery'}</span>
            <h1 className="mt-3 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05]">{isRtl ? 'كل القوالب، في مكان واحد' : 'Every template, in one place.'}</h1>
            <p className="mt-5 text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300">{isRtl ? 'اختر نقطة البداية المناسبة لك، ثم خصصها في الاستوديو خلال دقائق.' : 'Choose the right starting point, then customize it in Studio in minutes.'}</p>
            <p className="mt-3 text-xs font-semibold text-slate-400">{templatesData.length} {isRtl ? 'قوالب متاحة' : 'templates available'}</p>
          </div>
        </FadeInSection>

        <FadeInSection id="templates-page-grid" delayClass="delay-100">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
            {templatesData.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => onSelectTemplate(template)}
                className="group text-left rtl:text-right rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-3.5 shadow-[0_4px_18px_rgba(15,23,42,0.04)] hover:-translate-y-1 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-[0_16px_32px_rgba(15,23,42,0.1)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800">
                  <img src={template.avatar} alt={template.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  <span className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-950/75 px-2 py-2 text-[11px] font-bold text-white backdrop-blur-sm">
                    <Eye className="w-3.5 h-3.5" />
                    {isRtl ? 'معاينة القالب' : 'Preview template'}
                  </span>
                </div>
                <div className="px-1 pt-3 pb-1">
                  <h2 className="text-sm sm:text-[15px] font-extrabold leading-tight text-slate-900 dark:text-white">{template.name}</h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{template.category}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                    {isRtl ? 'عرض التفاصيل' : 'View details'}
                    <ForwardIcon className="w-3 h-3" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </FadeInSection>
      </main>
    </div>
  );
};
