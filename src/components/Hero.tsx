import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Check, ArrowRight, AlertCircle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { motion, useTransform } from 'motion/react';
import { Locale, TemplateItem, BackgroundStyle } from '../types';
import { dictionary } from '../data/content';
import { PhoneMockup } from './PhoneMockup';
import { useScrollProgress } from '../hooks/useScrollProgress';
import {
  AnnotationCard,
  CurvedArrowDownRight,
  CurvedArrowUpRight,
  CurvedArrowDownLeft,
  FloatingMetricBadge
} from './brand/Doodles';

// Reserved or already claimed handles for realistic availability feedback
const RESERVED_HANDLES = new Set(['admin', 'support', 'help', 'api', 'raloa', 'team', 'official', 'billing', 'root', 'security']);

interface HeroProps {
  locale: Locale;
  heroTemplate: TemplateItem;
  onOpenStudio: (username: string) => void;
  onOpenPhoneAction: (type: 'portfolio' | 'booking' | 'shop' | 'gear', data?: any) => void;
}

export const Hero: React.FC<HeroProps> = ({
  locale,
  heroTemplate,
  onOpenStudio,
  onOpenPhoneAction
}) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // FR-2.2 Local component memory state for interactive preview canvas
  const [previewThemeMode, setPreviewThemeMode] = useState<'auto' | 'dark' | 'light'>('auto');
  const [previewBgStyle, setPreviewBgStyle] = useState<BackgroundStyle>('immersive');

  const isRtl = locale === 'ar';
  const t = dictionary[locale].hero;

  const heroRef = useRef<HTMLElement>(null);

  // FR-2.1 Real-time handle validation regex: ^[a-zA-Z0-9_-]{3,30}$
  const handleStatus = useMemo<'empty' | 'available' | 'unavailable' | 'invalid'>(() => {
    const clean = username.trim().toLowerCase();
    if (!clean) return 'empty';
    if (clean.length < 3) return 'invalid';
    const validPattern = /^[a-zA-Z0-9_-]{3,30}$/;
    if (!validPattern.test(clean)) return 'invalid';
    if (RESERVED_HANDLES.has(clean)) return 'unavailable';
    if (apiAvailable === false) return 'unavailable';
    if (apiAvailable === true) return 'available';
    return 'available';
  }, [username, apiAvailable]);

  // FR-2.1 300ms Asynchronous debounce querying GET /api/v1/handles/check?handle={name}
  useEffect(() => {
    const clean = username.trim().toLowerCase();
    const validPattern = /^[a-zA-Z0-9_-]{3,30}$/;

    if (!clean || !validPattern.test(clean) || RESERVED_HANDLES.has(clean)) {
      setApiAvailable(null);
      setIsChecking(false);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      return;
    }

    setIsChecking(true);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/handles/check?handle=${encodeURIComponent(clean)}`);
        if (res.ok) {
          const data = await res.json();
          setApiAvailable(Boolean(data.data?.available));
        } else {
          setApiAvailable(false);
        }
      } catch (_) {
        setApiAvailable(!RESERVED_HANDLES.has(clean));
      } finally {
        setIsChecking(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [username]);

  // Track scroll progress through the hero section with smooth physics
  const { smoothProgress } = useScrollProgress({
    targetRef: heroRef,
    offset: ['start start', 'end start']
  });

  // Parallax and tilt transformations linked to scroll progress
  const phoneY = useTransform(smoothProgress, [0, 1], [0, 85]);
  const phoneRotate = useTransform(smoothProgress, [0, 1], [0, isRtl ? 3.5 : -3.5]);
  const phoneScale = useTransform(smoothProgress, [0, 0.7, 1], [1, 0.98, 0.94]);

  const glowY = useTransform(smoothProgress, [0, 1], [0, 60]);
  const glowScale = useTransform(smoothProgress, [0, 1], [1, 1.15]);

  const validateAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();

    if (!cleanUsername) {
      setError(isRtl ? 'يرجى إدخال اسم المستخدم' : 'Please enter a username');
      return;
    }

    const validPattern = /^[a-zA-Z0-9_-]{3,30}$/;
    if (!validPattern.test(cleanUsername)) {
      setError(
        isRtl
          ? 'يجب أن يتكون الاسم من ٣-٣٠ حرفاً إنجليزياً أو أرقام أو شرطات'
          : 'Username must be 3–30 alphanumeric characters, dashes or underscores'
      );
      return;
    }

    if (handleStatus === 'unavailable' || apiAvailable === false) {
      setError(
        isRtl
          ? 'عذراً، هذا الاسم محجوز بالفعل. يرجى اختيار اسم مستخدم آخر'
          : 'This handle is already reserved. Please choose another username'
      );
      return;
    }

    setError(null);

    // FR-2.1: Clicking "Claim" stores claimed handle in sessionStorage and executes client navigation to /register?handle={name}
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('claimed_handle', cleanUsername);
      sessionStorage.setItem('raloa_claimed_handle', cleanUsername);
      window.history.pushState(null, '', `/register?handle=${encodeURIComponent(cleanUsername)}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }

    onOpenStudio(cleanUsername);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    setUsername(val);
    setApiAvailable(null);
    if (error) setError(null);
  };

  return (
    <section
      ref={heroRef}
      id="hero"
      className="relative isolate pt-[76px] sm:pt-[100px] md:pt-[124px] pb-10 sm:pb-16 md:pb-24 overflow-hidden bg-[#F8FAFC] dark:bg-slate-950 transition-colors duration-200"
    >
      {/* Approved RALOA hero artwork, with a restrained pattern layer for depth. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-[url('/graphics/hero-background-light-1920x1080.jpg')] bg-cover bg-center dark:hidden"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 hidden bg-[url('/graphics/hero-background-dark-1920x1080.webp')] bg-cover bg-center dark:block"
      />

      {/* Decorative ambient subtle glow with scroll parallax */}
      <motion.div
        style={{ y: glowY, scale: glowScale }}
        className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-indigo-200/30 to-purple-200/20 dark:from-indigo-600/10 dark:to-purple-600/10 blur-3xl rounded-full pointer-events-none -z-10"
      />

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 lg:gap-8 items-center lg:min-h-[660px]">
          
          {/* Left Column: 55% split (lg:col-span-7) */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left rtl:lg:text-right">
            
            {/* Headline with staged fade and glide */}
            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="text-[34px] sm:text-[54px] md:text-[62px] lg:text-[70px] font-extrabold text-[#0F172A] dark:text-white tracking-[-0.03em] leading-[1.06] mb-4 sm:mb-6"
            >
              <span>{t.headlineStart}</span>
              <br />
              <span className="bg-gradient-to-r from-[#7C3AED] via-[#5B5CF6] to-[#2563EB] dark:from-[#9061F9] dark:via-[#6366F1] dark:to-[#3B82F6] bg-clip-text text-transparent">
                {t.headlineGradient}
              </span>
            </motion.h1>

            {/* Subheadline with subtle delay */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="text-[16px] sm:text-[19px] lg:text-[20px] text-slate-600 dark:text-slate-300 leading-[1.55] max-w-[560px] mb-6 sm:mb-8 font-normal"
            >
              {t.subheadline}
            </motion.p>

            {/* Handle / CTA Input Bar */}
            <motion.form
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
              onSubmit={validateAndSubmit}
              className="w-full max-w-[530px]"
              noValidate
            >
              <div
                className={`relative flex flex-col sm:flex-row items-stretch sm:items-center bg-white dark:bg-slate-900 rounded-2xl sm:rounded-full p-2 border shadow-[0_12px_36px_rgba(15,23,42,0.08)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.5)] transition-all ${
                  error
                    ? 'border-rose-400 ring-2 ring-rose-200 dark:ring-rose-950'
                    : 'border-slate-200 dark:border-slate-800 focus-within:border-indigo-400 dark:focus-within:border-indigo-500 focus-within:ring-3 focus-within:ring-indigo-100 dark:focus-within:ring-indigo-950/60'
                }`}
              >
                {/* Prefix & Input */}
                <div className="flex items-center flex-1 px-3 py-2 sm:py-0">
                  <span className="text-[15px] font-semibold text-slate-400 dark:text-slate-500 select-none ltr:mr-1 rtl:ml-1">
                    {t.prefix}
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={handleInputChange}
                    placeholder={t.placeholder}
                    className="w-full bg-transparent text-[16px] font-semibold text-[#0F172A] dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                    aria-label="Choose your username handle"
                    autoComplete="off"
                    spellCheck="false"
                  />
                  {/* Status Indicator Pill */}
                  {isChecking && (
                    <span className="ml-2 rtl:mr-2 rtl:ml-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold border border-slate-200 dark:border-slate-700 shrink-0">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                      <span>{isRtl ? 'جارٍ الفحص...' : 'Checking...'}</span>
                    </span>
                  )}
                  {!isChecking && handleStatus === 'available' && (
                    <span className="ml-2 rtl:mr-2 rtl:ml-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{isRtl ? 'متاح' : 'Available'}</span>
                    </span>
                  )}
                  {!isChecking && handleStatus === 'unavailable' && (
                    <span className="ml-2 rtl:mr-2 rtl:ml-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[11px] font-bold border border-amber-200 dark:border-amber-800 shrink-0">
                      <XCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{isRtl ? 'محجوز' : 'Unavailable'}</span>
                    </span>
                  )}
                  {!isChecking && handleStatus === 'invalid' && username.length > 0 && (
                    <span className="ml-2 rtl:mr-2 rtl:ml-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 text-[11px] font-bold border border-rose-200 dark:border-rose-800 shrink-0">
                      <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{isRtl ? 'غير صالح' : 'Invalid'}</span>
                    </span>
                  )}
                </div>

                {/* Primary CTA Submit */}
                <button
                  type="submit"
                  className="mt-2 sm:mt-0 min-h-[48px] px-6 py-3 rounded-xl sm:rounded-full bg-[#0F172A] hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 active:scale-[0.98] text-white font-bold text-[15px] flex items-center justify-center gap-2 shadow-md transition-all whitespace-nowrap cursor-pointer"
                >
                  <span>{t.cta}</span>
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </button>
              </div>

              {/* Validation message if error */}
              {error && (
                <div className="flex items-center gap-1.5 mt-2 text-rose-600 dark:text-rose-400 text-xs font-semibold px-2 animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {!error && handleStatus === 'available' && (
                <div className="flex items-center gap-1.5 mt-2 text-emerald-600 dark:text-emerald-400 text-xs font-medium px-2 animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{isRtl ? `الاسم @${username} متوفر وجاهز للحجز الفوري` : `raloa.app/@${username} is available to claim now!`}</span>
                </div>
              )}

            </motion.form>

            {/* Proof Points with staggered entrance */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.32 }}
              className="w-full max-w-[530px] flex flex-wrap items-center justify-center lg:justify-between gap-y-2 gap-x-3 text-[11px] sm:text-[13px] font-medium text-slate-600 dark:text-slate-400 mt-3 sm:mt-4"
            >
              {t.proof.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.35 + idx * 0.07 }}
                  className="flex items-center gap-1.5 whitespace-nowrap"
                >
                  <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                  </div>
                  <span>{item}</span>
                </motion.div>
              ))}
            </motion.div>

          </div>

          {/* Right Column: 45% split (lg:col-span-5) */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            
            {/* Phone Mockup with scroll-linked parallax, rotation, and gentle float */}
            <motion.div
              style={{
                y: phoneY,
                rotate: phoneRotate,
                scale: phoneScale
              }}
                className="relative z-10 w-full max-w-[292px] sm:max-w-[340px] flex justify-center"
            >
              {/* Dynamic entrance glide + infinite subtle breathing oscillation */}
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: [0, -10, 0]
                }}
                transition={{
                  opacity: { duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] },
                  scale: { duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] },
                  y: {
                    duration: 4.8,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: 1.0
                  }
                }}
                className="w-full flex justify-center"
              >
                <div className="flex flex-col items-center w-full">
                  <PhoneMockup
                    template={heroTemplate}
                    isRtl={isRtl}
                    onOpenAction={onOpenPhoneAction}
                    backgroundStyle={previewBgStyle}
                    themeModeOverride={previewThemeMode}
                  />

                  {/* FR-2.2 Embedded Client-Side Interactive Canvas Preview Controls (No Auth Required) */}
                  <div className="mt-3 max-w-full overflow-x-auto no-scrollbar sm:max-w-none sm:overflow-visible inline-flex items-center gap-1 p-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-md text-xs font-semibold z-20">
                    <span className="px-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
                      {isRtl ? 'المعاينة الحية:' : 'Live Canvas:'}
                    </span>
                    {(['signature', 'minimal', 'gradient', 'immersive', 'banner'] as const).map((bg) => (
                      <button
                        key={bg}
                        type="button"
                        onClick={() => setPreviewBgStyle(bg)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold capitalize transition-all cursor-pointer ${
                          previewBgStyle === bg
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {bg}
                      </button>
                    ))}
                    <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
                    <button
                      type="button"
                      onClick={() => setPreviewThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                      className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                    >
                      {previewThemeMode === 'dark' ? '🌙 Dark' : '☀️ Light'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* Floating Annotation Sticker 1 (Top Left) */}
            <motion.div
              style={{ y: phoneY }}
              initial={{ opacity: 0, scale: 0, rotate: -15 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.55 }}
              className="hidden sm:block absolute top-0 left-0 md:-left-2 z-20 pointer-events-none"
            >
              <div className="flex flex-col items-end">
                <AnnotationCard rotation="-rotate-3">
                  <span>{t.allLinksSticker}</span>
                </AnnotationCard>
                <CurvedArrowDownRight className="mt-1 mr-4" />
              </div>
            </motion.div>

            {/* Floating Annotation Sticker 2 (Bottom Left) */}
            <motion.div
              style={{ y: phoneY }}
              initial={{ opacity: 0, scale: 0, rotate: 15 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.7 }}
              className="hidden sm:block absolute bottom-[-4rem] left-0 md:-left-2 z-20 pointer-events-none"
            >
              <div className="flex flex-col items-end">
                <CurvedArrowUpRight className="mb-1 mr-2" />
                <AnnotationCard rotation="rotate-2">
                  <span>{t.templatesSticker}</span>
                </AnnotationCard>
              </div>
            </motion.div>

            {/* Floating Annotation Sticker 3 (Top Right) */}
            <motion.div
              style={{ y: phoneY }}
              initial={{ opacity: 0, scale: 0, rotate: 20 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.62 }}
              className="hidden sm:block absolute top-4 right-0 md:-right-2 z-20 pointer-events-none"
            >
              <div className="flex flex-col items-start">
                <AnnotationCard rotation="rotate-3">
                  <span>{t.anyDeviceSticker}</span>
                </AnnotationCard>
                <CurvedArrowDownLeft className="mt-1 ml-4" />
              </div>
            </motion.div>

            {/* Floating Metric Badge (+300% More clicks) (Middle Right) */}
            <motion.div
              style={{ y: phoneY }}
              initial={{ opacity: 0, scale: 0.4, x: 25 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.8 }}
              className="hidden sm:block absolute top-[48%] right-0 md:-right-4 -translate-y-1/2 z-20"
            >
              <FloatingMetricBadge
                metric={locale === 'ar' ? '+٣٠٠٪' : '+300%'}
                label={locale === 'ar' ? 'نقرات إضافية' : 'More clicks'}
              />
            </motion.div>

          </div>

        </div>
      </div>
    </section>
  );
};
