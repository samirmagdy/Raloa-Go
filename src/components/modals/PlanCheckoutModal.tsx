import React, { useState, useEffect } from 'react';
import { X, Check, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { PremiumMark } from '../brand/PremiumMark';
import { Locale, PricingPlan } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { useModalA11y } from '../../hooks/useModalA11y';

interface PlanCheckoutModalProps {
  plan: PricingPlan | null;
  isYearly: boolean;
  locale: Locale;
  onClose: () => void;
  onConfirmPlan: (plan: PricingPlan) => void;
}

export const PlanCheckoutModal: React.FC<PlanCheckoutModalProps> = ({
  plan,
  isYearly,
  locale,
  onClose,
  onConfirmPlan
}) => {
  if (!plan) return null;
  const { user, updatePlan } = useAuth();
  const isRtl = locale === 'ar';
  const price = plan.priceMonthly === 0 ? 0 : isYearly ? plan.priceYearly : plan.priceMonthly;
  const [email, setEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useModalA11y<HTMLDivElement>();

  useEffect(() => {
    if (user?.email && !email) {
      setEmail(user.email);
    }
  }, [user, email]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!user) {
      setError(
        isRtl
          ? 'يرجى تسجيل الدخول أولاً لتفعيل وربط هذه الباقة بحسابك.'
          : 'Please sign in first to activate and attach this plan to your account.'
      );
      setLoading(false);
      return;
    }

    try {
      const planTier = (plan.id.toLowerCase() as 'free' | 'pro' | 'studio') || 'free';
      await updatePlan(planTier, isYearly);
      setSuccess(true);
      setTimeout(() => {
        onConfirmPlan(plan);
      }, 1000);
    } catch (err) {
      console.error('Error updating plan:', err);
      setError(
        err instanceof Error && err.message === 'AUTH_REQUIRED'
          ? (isRtl ? 'يرجى تسجيل الدخول أولاً.' : 'Please sign in before activating a plan.')
          : (isRtl ? 'تعذر تفعيل الباقة. حاول مرة أخرى.' : 'We could not activate this plan. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-dialog-title"
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50">
          <div className="flex items-center gap-2">
            <PremiumMark className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span id="plan-dialog-title" className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              {isRtl ? 'اختيار باقة الاشتراك' : 'Plan Selection & Activation'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isRtl ? 'إغلاق' : 'Close'}
            className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {success ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 rounded-full mx-auto flex items-center justify-center">
                <Check className="w-7 h-7 stroke-[3]" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                {isRtl ? 'تم تفعيل باقتك بنجاح!' : 'Plan Activated Successfully!'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {isRtl
                  ? `أنت الآن مشترك في باقة ${plan.nameAr}. جاري نقلك إلى الاستوديو...`
                  : `You are now on the ${plan.name} plan. Redirecting to your Studio...`}
              </p>
            </div>
          ) : (
            <form onSubmit={handleCheckout} className="space-y-5">
              <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-lg text-slate-900 dark:text-white">
                    {isRtl ? plan.nameAr : plan.name}
                  </h4>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300">
                    {isYearly ? (isRtl ? 'الفاتورة تُدفع سنوياً (وفرت ٢٠٪)' : 'Billed annually (Saved 20%)') : (isRtl ? 'الفاتورة شهرية' : 'Billed monthly')}
                  </p>
                </div>
                <div className="text-right rtl:text-left">
                  <span className="text-2xl font-black text-[#0F172A] dark:text-white">
                    {plan.priceMonthly === 0 ? '$0' : `$${price.toFixed(price % 1 === 0 ? 0 : 2)}`}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    / {isYearly ? (isRtl ? 'سنوياً' : 'year') : (isRtl ? plan.periodAr : plan.period)}
                  </span>
                </div>
              </div>

              {/* Feature summary */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  {isRtl ? 'المزايا المشمولة' : 'Included in this plan'}
                </span>
                {(isRtl ? plan.featuresAr : plan.features).slice(0, 4).map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              {/* Email field */}
              <div>
                <label htmlFor="plan-email" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {isRtl ? 'بريدك الإلكتروني للحساب' : 'Account Email'}
                </label>
                <input
                  id="plan-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                  required
                />
              </div>

              {plan.priceMonthly > 0 && (
                <div className="p-3 bg-indigo-50/80 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-900/60 text-[11px] text-indigo-900 dark:text-indigo-200 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <span>
                    {isRtl
                      ? 'تفعيل فوري مرتبط مباشرة بحسابك وقاعدة البيانات. سيتم تطبيق كافة مزايا باقة ' + plan.nameAr + ' على الفور.'
                      : `Instant activation attached directly to your account. All ${plan.name} features will be unlocked immediately.`}
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 disabled:opacity-60 text-white dark:text-slate-900 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isRtl ? 'جاري تفعيل الباقة وتحديث الحساب...' : 'Activating Plan & Syncing Account...'}</span>
                  </>
                ) : (
                  <>
                    <span>
                      {plan.priceMonthly === 0
                        ? isRtl ? 'ابدأ مجاناً الآن' : 'Start Free Now'
                        : isRtl ? `تفعيل باقة ${plan.nameAr} الآن` : `Activate ${plan.name} Plan Now`}
                    </span>
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                  </>
                )}
              </button>
              {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>}
            </form>
          )}
        </div>

      </div>
    </div>
  );
};
