import React, { useRef, useState, useEffect, useMemo } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react';
import { Locale, TemplateItem } from '../types';
import { templatesData, dictionary } from '../data/content';
import { TemplateSnapshotPopover } from './TemplateSnapshotPopover';
import { usePageSEO } from '../hooks/usePageSEO';

interface TemplateGalleryProps {
  locale: Locale;
  onSelectTemplate: (template: TemplateItem) => void;
  onBrowseAll: () => void;
}

export const TemplateGallery: React.FC<TemplateGalleryProps> = ({
  locale,
  onSelectTemplate,
  onBrowseAll
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isRtl = locale === 'ar';
  const t = dictionary[locale].templatesSection;

  const seoKeywords = useMemo(
    () =>
      isRtl
        ? ['قوالب رالوا', 'مواقع مصغرة', 'تصميم صفحة بايو', 'قوالب صناع المحتوى', 'قوالب متجاوبة']
        : ['mini site templates', 'link in bio templates', 'creator portfolio themes', 'raloa starter sites', 'aesthetic bio links'],
    [isRtl]
  );

  const seoMetaTags = useMemo(
    () => [
      { name: 'robots', content: 'index, follow' },
      { name: 'section', content: 'templates' },
      { property: 'article:section', content: 'Design & Templates' }
    ],
    []
  );

  const seoJsonLd = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: isRtl ? 'قوالب مواقع رالوا المصغرة' : 'RALOA Starter Templates',
      description: isRtl
        ? 'مجموعة قوالب تفاعلية جاهزة للاستخدام الفوري'
        : 'Curated gallery of mobile-responsive mini-site templates for creators',
      numberOfItems: templatesData.length,
      itemListElement: templatesData.map((tmpl, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: tmpl.name,
        description: isRtl ? tmpl.bioAr : tmpl.bio
      }))
    }),
    [isRtl]
  );

  // Section-specific SEO hook passing unique OpenGraph description & meta tags to useSEO
  usePageSEO({
    sectionId: 'templates',
    locale,
    title: isRtl
      ? 'معرض قوالب وتصاميم رالوا — مواقع مصغرة متجاوبة لصناع المحتوى'
      : 'Curated Mini-Site Templates & Creator Themes — RALOA',
    description: isRtl
      ? 'استعرض قوالب تفاعلية أنيقة مصممة لزيادة التفاعل والمبيعات لصناع المحتوى، المصورين، والمدربين. انطلق في دقائق.'
      : 'Explore curated, conversion-crafted aesthetic templates for digital creators, photographers, educators, coaches and modern businesses.',
    ogTitle: isRtl
      ? 'استكشف قوالب رالوا للمواقع المصغرة — تصاميم حصرية'
      : 'Explore Beautiful Mini-Site Templates — RALOA Gallery',
    ogDescription: isRtl
      ? 'تصفح قوالب رالوا المتوافقة مع كافة الهواتف والأجهزة. تصاميم بصرية مميزة تدعم صفحات وروابط متعددة بدون أي كود برمجي.'
      : 'Browse dozens of hand-crafted starter designs for musicians, creators, coaches, and agencies. Live interactive previews with multi-page support.',
    ogImage: 'https://raloa.app/images/og-templates.png',
    keywords: seoKeywords,
    metaTags: seoMetaTags,
    jsonLd: seoJsonLd
  });

  const [hoveredState, setHoveredState] = useState<{

    template: TemplateItem;
    rect: DOMRect;
  } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (template: TemplateItem, e: React.MouseEvent<HTMLDivElement>) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredState({ template, rect });
    }, 120);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredState(null);
  };

  useEffect(() => {
    const handleScrollOrResize = () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      setHoveredState(null);
    };

    window.addEventListener('scroll', handleScrollOrResize, { passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    
    const scroller = scrollRef.current;
    if (scroller) {
      scroller.addEventListener('scroll', handleScrollOrResize, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
      if (scroller) {
        scroller.removeEventListener('scroll', handleScrollOrResize);
      }
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 320;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <section id="templates" className="py-14 sm:py-20 md:py-28 bg-[#F8FAFC] dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 transition-colors duration-200">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="max-w-[640px]">
            <span className="text-[12px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-2">
              {t.eyebrow}
            </span>
            <h2 className="text-[32px] sm:text-[40px] md:text-[46px] font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-[1.1]">
              <span>{t.headline} </span>
              <span className="bg-gradient-to-r from-[#7C3AED] to-[#2563EB] dark:from-[#9061F9] dark:to-[#3B82F6] bg-clip-text text-transparent">
                {t.headlineGradient}
              </span>
            </h2>
            <p className="text-[16px] sm:text-[18px] text-slate-600 dark:text-slate-300 mt-3 font-normal leading-relaxed">
              {t.subheadline}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Carousel navigation buttons */}
            <div className="hidden sm:flex items-center gap-1.5 ltr:mr-2 rtl:ml-2">
              <button
                onClick={() => scroll(isRtl ? 'right' : 'left')}
                className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
                aria-label="Scroll templates left"
              >
                <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
              </button>
              <button
                onClick={() => scroll(isRtl ? 'left' : 'right')}
                className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
                aria-label="Scroll templates right"
              >
                <ChevronRight className="w-5 h-5 rtl:rotate-180" />
              </button>
            </div>

            <button
              onClick={onBrowseAll}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 text-slate-800 dark:text-slate-200 text-[14px] font-bold shadow-2xs hover:shadow-sm transition-all whitespace-nowrap"
            >
              <span>{t.browseAll}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </div>
        </div>

        {/* Horizontal Visual Gallery */}
        <div
          ref={scrollRef}
          className="flex items-stretch gap-5 overflow-x-auto no-scrollbar pb-6 pt-2 snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none' }}
        >
          {templatesData.map((template) => (
            <div
              key={template.id}
              onClick={() => {
                handleMouseLeave();
                onSelectTemplate(template);
              }}
              onMouseEnter={(e) => handleMouseEnter(template, e)}
              onMouseLeave={handleMouseLeave}
              className="w-[180px] sm:w-[200px] shrink-0 snap-start bg-white dark:bg-slate-900 rounded-[22px] p-3 border border-slate-200 dark:border-slate-800 shadow-[0_4px_16px_rgba(15,23,42,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] hover:shadow-[0_16px_36px_rgba(15,23,42,0.12)] dark:hover:shadow-[0_16px_36px_rgba(0,0,0,0.6)] hover:-translate-y-1.5 transition-all duration-300 cursor-pointer group flex flex-col text-center"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleMouseLeave();
                  onSelectTemplate(template);
                }
              }}
              aria-label={`View template ${template.name}`}
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-[3/4] w-full rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 mb-3">
                <img
                  src={template.avatar}
                  alt={template.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                
                {/* Overlay hover badge */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                  <span className="text-white text-[11px] font-bold flex items-center gap-1">
                    <span>{locale === 'ar' ? 'معاينة القالب' : 'Preview template'}</span>
                    <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                  </span>
                </div>
              </div>

              {/* Info text */}
              <div className="px-1 pb-1">
                <h3 className="font-extrabold text-[15px] text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-tight">
                  {template.name}
                </h3>
                <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400 block mt-0.5">
                  {template.category}
                </span>
              </div>
            </div>
          ))}

          {/* "+ More templates" Card */}
          <div
            onClick={onBrowseAll}
            className="w-[180px] sm:w-[200px] shrink-0 snap-start bg-white/70 hover:bg-white dark:bg-slate-900/70 dark:hover:bg-slate-900 rounded-[22px] p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 shadow-2xs hover:shadow-md transition-all duration-300 cursor-pointer group flex flex-col items-center justify-center text-center"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onBrowseAll();
              }
            }}
          >
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/80 text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center justify-center mb-3 transition-colors">
              <Plus className="w-6 h-6" />
            </div>
            <span className="font-bold text-[14px] text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {t.moreTemplates}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {locale === 'ar' ? 'استكشف ٢٤+ قالباً' : 'Explore 24+ layouts'}
            </span>
          </div>
        </div>

        {/* Mock Site Snapshot Hover Popover */}
        <TemplateSnapshotPopover
          template={hoveredState?.template ?? null}
          anchorRect={hoveredState?.rect ?? null}
          locale={locale}
          visible={!!hoveredState}
        />

      </div>
    </section>
  );
};
