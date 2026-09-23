import React from 'react';
import { Star, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Locale } from '../types';
import { testimonialsData, dictionary } from '../data/content';

interface TestimonialsProps {
  locale: Locale;
  onSeeMoreStories: () => void;
}

export const Testimonials: React.FC<TestimonialsProps> = ({ locale, onSeeMoreStories }) => {
  const isRtl = locale === 'ar';
  const t = dictionary[locale].testimonialsSection;

  return (
    <section id="testimonials" className="py-14 sm:py-20 md:py-28 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800/80 transition-colors duration-200">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-6">
          <div className="max-w-[600px]">
            <span className="text-[12px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-2">
              {t.eyebrow}
            </span>
            <h2 className="text-[32px] sm:text-[40px] md:text-[46px] font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-tight">
              {t.headline}
            </h2>
          </div>

          <button
            onClick={onSeeMoreStories}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 text-slate-800 dark:text-slate-200 text-[14px] font-bold shadow-2xs hover:shadow-sm transition-all whitespace-nowrap self-start md:self-auto cursor-pointer"
          >
            <span>{t.seeMore}</span>
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </button>
        </div>

        {/* 3 Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonialsData.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 rounded-[22px] p-7 border border-slate-200/90 dark:border-slate-800 shadow-[0_6px_20px_rgba(15,23,42,0.04)] dark:shadow-[0_6px_20px_rgba(0,0,0,0.3)] flex flex-col items-center text-center lg:items-start lg:text-start justify-between hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.5)] transition-all duration-300"
            >
              <div className="space-y-4">
                {/* 5 Golden Stars */}
                <div className="flex items-center gap-1 text-amber-400">
                  {[...Array(item.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                {/* Quote Text */}
                <p className="text-[15px] sm:text-[16px] text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                  "{isRtl ? item.quoteAr : item.quote}"
                </p>
              </div>

              {/* Author Info */}
              <div className="flex items-center justify-center lg:justify-start gap-3 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 w-full">
                <div className="relative">
                  <img
                    src={item.avatar}
                    alt={item.author}
                    className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 bg-white dark:bg-slate-900 rounded-full p-0.5 shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 fill-blue-600 text-white" />
                  </div>
                </div>

                <div>
                  <h4 className="font-extrabold text-[15px] text-slate-900 dark:text-white leading-tight">
                    {isRtl ? item.authorAr : item.author}
                  </h4>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    {isRtl ? item.roleAr : item.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
