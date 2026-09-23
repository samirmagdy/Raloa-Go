import React, { useState } from 'react';
import { Check, ArrowRight, AlertCircle } from 'lucide-react';
import { PremiumMark } from './brand/PremiumMark';
import { Locale } from '../types';
import { dictionary } from '../data/content';

interface FinalCTAProps {
  locale: Locale;
  onOpenStudio: (username: string) => void;
}

export const FinalCTA: React.FC<FinalCTAProps> = ({ locale, onOpenStudio }) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isRtl = locale === 'ar';
  const t = dictionary[locale].finalCta;

  const validateAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = username.trim().toLowerCase();
    if (!clean) {
      setError(isRtl ? 'يرجى إدخال اسم المستخدم' : 'Please enter a username');
      return;
    }
    const validPattern = /^[a-zA-Z0-9_-]{2,30}$/;
    if (!validPattern.test(clean)) {
      setError(
        isRtl
          ? 'يجب أن يتكون الاسم من ٢-٣٠ حرفاً إنجليزياً أو أرقام'
          : 'Username must be 2–30 alphanumeric characters'
      );
      return;
    }
    setError(null);
    onOpenStudio(clean);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    setUsername(val);
    if (error) setError(null);
  };

  return (
    <section className="py-14 sm:py-20 md:py-28 bg-white dark:bg-slate-950 transition-colors duration-200">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Banner with gradient matching tokens: linear-gradient(90deg, #5B5CF6 0%, #8B5CF6 100%) */}
        <div className="relative rounded-[32px] overflow-hidden p-8 sm:p-12 lg:p-16 text-white shadow-[0_20px_50px_rgba(91,92,246,0.25)] dark:shadow-[0_20px_50px_rgba(91,92,246,0.15)] bg-gradient-to-r from-[#5B5CF6] via-[#6366F1] to-[#8B5CF6]">
          
          {/* Decorative spark elements */}
          <div className="absolute top-4 left-6 opacity-30 select-none pointer-events-none">
            <PremiumMark className="w-8 h-8 text-white animate-pulse" />
          </div>
          <div className="absolute bottom-4 right-8 opacity-25 select-none pointer-events-none">
            <PremiumMark className="w-10 h-10 text-white animate-pulse" />
          </div>

          <div className="max-w-3xl mx-auto text-center flex flex-col items-center">
            
            {/* Eyebrow */}
            <span className="text-[12px] font-extrabold uppercase tracking-widest text-indigo-100 mb-3 block">
              {t.eyebrow}
            </span>

            {/* Headline */}
            <h2 className="text-[34px] sm:text-[44px] md:text-[52px] font-extrabold tracking-tight leading-[1.08] mb-4 text-white">
              {t.headline}
            </h2>

            {/* Subhead */}
            <p className="text-[16px] sm:text-[18px] text-indigo-100 mb-8 max-w-xl font-normal">
              {t.subheadline}
            </p>

            {/* Input Bar */}
            <form
              onSubmit={validateAndSubmit}
              className="w-full max-w-[500px] mb-4"
              noValidate
            >
              <div
                className={`relative flex flex-col sm:flex-row items-stretch sm:items-center bg-white dark:bg-slate-900 border border-transparent dark:border-slate-800 rounded-2xl sm:rounded-full p-2 text-slate-900 dark:text-white shadow-xl transition-all ${
                  error ? 'ring-3 ring-rose-400' : 'focus-within:ring-3 focus-within:ring-white/80'
                }`}
              >
                <div className="flex items-center flex-1 px-3 py-2 sm:py-0">
                  <span className="text-[14px] font-semibold text-slate-400 dark:text-slate-500 select-none ltr:mr-1 rtl:ml-1">
                    raloa.app/@
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={handleInputChange}
                    placeholder={locale === 'ar' ? 'اسمك' : 'yourname'}
                    className="w-full bg-transparent text-[15px] font-semibold text-[#0F172A] dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                    aria-label="Username for final CTA"
                  />
                </div>

                <button
                  type="submit"
                  className="mt-2 sm:mt-0 min-h-[46px] px-6 py-2.5 rounded-xl sm:rounded-full bg-[#0F172A] hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 active:scale-[0.98] text-white font-bold text-[14px] flex items-center justify-center gap-2 shadow-md transition-all whitespace-nowrap cursor-pointer"
                >
                  <span>{t.cta}</span>
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </button>
              </div>

              {error && (
                <div className="flex items-center justify-center gap-1.5 mt-2 text-white bg-rose-500/80 rounded-lg py-1 px-3 text-xs font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </form>

            {/* Proof Points */}
            <div className="flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-[13px] font-medium text-indigo-100 mt-2">
              {t.proof.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-white/20 text-white flex items-center justify-center">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
