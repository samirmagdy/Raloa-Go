import React, { useState } from 'react';
import { Mail, CheckCircle2, AlertCircle, Loader2, Sparkles, ShieldCheck, BellRing, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Locale } from '../types';
import { saveNewsletterSubscription } from '../lib/firebase';

interface NewsletterProps {
  locale: Locale;
}

export const Newsletter: React.FC<NewsletterProps> = ({ locale }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [subscribedEmail, setSubscribedEmail] = useState('');
  const isRtl = locale === 'ar';

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim()) {
      setStatus('error');
      setErrorMessage(
        isRtl ? 'يرجى إدخال عنوان بريدك الإلكتروني' : 'Please enter your email address'
      );
      return;
    }

    if (!validateEmail(email)) {
      setStatus('error');
      setErrorMessage(
        isRtl ? 'صيغة البريد الإلكتروني غير صحيحة' : 'Please enter a valid email address'
      );
      return;
    }

    setStatus('loading');

    try {
      await saveNewsletterSubscription(email);
      setSubscribedEmail(email.trim());
      setStatus('success');
      setEmail('');
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 }, colors: ['#4F46E5', '#06B6D4', '#10B981'] });
    } catch {
      setStatus('error');
      setErrorMessage(isRtl ? 'تعذر إتمام الاشتراك. حاول مرة أخرى.' : 'We could not complete your subscription. Please try again.');
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setEmail('');
    setErrorMessage('');
  };

  return (
    <section
      id="newsletter"
      className="py-20 md:py-28 relative overflow-hidden transition-colors duration-200"
      aria-label={isRtl ? 'النشرة البريدية' : 'Product Updates Newsletter'}
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl bg-slate-900 dark:bg-slate-900/90 text-white border border-slate-800 shadow-xl overflow-hidden p-8 sm:p-12 md:p-16">
          
          {/* Subtle Ambient Background Gradients */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto text-center">
            
            {/* Pill Header Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-300 text-xs font-bold tracking-wide uppercase mb-6 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>{isRtl ? 'النشرة الأسبوعية للمبدعين' : 'Weekly Creator Digest'}</span>
            </div>

            {/* Main Title & Subtitle */}
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-4 leading-tight">
              {isRtl
                ? 'كن أول من يعلم بجديد المنتجات وأسرار التفاعل'
                : 'Stay ahead with the latest product updates & tips'}
            </h2>
            <p className="text-sm sm:text-base text-slate-300 dark:text-slate-400 max-w-2xl mx-auto mb-8 leading-relaxed">
              {isRtl
                ? 'اشترك ليصلك أحدث القوالب المجانية، استراتيجيات مضاعفة المبيعات، ومميزات رالوا الحصرية مباشرة في بريدك.'
                : 'Join 15,000+ creators receiving our curated dispatch on mini-site growth, new high-converting templates, and product releases.'}
            </p>

            {/* Form / Success View */}
            {status === 'success' ? (
              <div className="p-6 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 max-w-lg mx-auto text-center animate-in fade-in zoom-in-95 duration-200">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-xs">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">
                  {isRtl ? 'تم الاشتراك بنجاح!' : 'Welcome aboard!'}
                </h3>
                <p className="text-xs text-slate-300 mb-4">
                  {isRtl
                    ? `تم حفظ ${subscribedEmail} لتحديثات رالوا.`
                    : `${subscribedEmail} is saved for RALOA product updates.`}
                </p>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs font-semibold text-indigo-300 hover:text-white underline underline-offset-4 cursor-pointer transition-colors"
                >
                  {isRtl ? 'تسجيل بريد إلكتروني آخر' : 'Subscribe another address'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="max-w-md mx-auto mb-6">
                <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 pl-3.5 rtl:pl-0 rtl:pr-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (status === 'error') setStatus('idle');
                      }}
                      placeholder={isRtl ? 'أدخل بريدك الإلكتروني...' : 'Enter your email address...'}
                      disabled={status === 'loading'}
                      className="w-full pl-10 rtl:pl-3.5 rtl:pr-10 pr-3.5 py-3 rounded-xl bg-slate-800/80 border border-slate-700/80 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-inner disabled:opacity-50"
                      aria-label={isRtl ? 'عنوان البريد الإلكتروني' : 'Email address'}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-md hover:shadow-indigo-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {status === 'loading' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{isRtl ? 'جارٍ الاشتراك...' : 'Subscribing...'}</span>
                      </>
                    ) : (
                      <>
                        <span>{isRtl ? 'اشترك الآن' : 'Subscribe'}</span>
                        <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                      </>
                    )}
                  </button>
                </div>

                {/* Error Banner */}
                {status === 'error' && (
                  <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-rose-400 font-medium animate-in fade-in duration-150">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </form>
            )}

            {/* Micro-Features / Trust Badges */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-3 text-[12px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{isRtl ? 'بدون أي رسائل مزعجة' : 'Zero spam policy'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <BellRing className="w-4 h-4 text-indigo-400" />
                <span>{isRtl ? 'إشعار فوري بالتحديثات' : 'Instant product release alerts'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>{isRtl ? 'إلغاء الاشتراك بنقرة واحدة' : 'Unsubscribe at any time'}</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};
