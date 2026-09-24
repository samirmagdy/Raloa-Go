import React, { useEffect, useState } from 'react';
import { X, Gift, Copy, Check, Users, Clock, ShieldCheck, Sparkles, CheckCircle2, Globe } from 'lucide-react';
import { Locale } from '../../types';
import { useModalA11y } from '../../hooks/useModalA11y';
import { PremiumMark } from '../brand/PremiumMark';

interface ReferralModalProps {
  isOpen: boolean;
  locale: Locale;
  onClose: () => void;
}

const TARGET_INVITES = 3;
const REFERRAL_LINK = 'https://raloa.app/join';

export const ReferralModal: React.FC<ReferralModalProps> = ({ isOpen, locale, onClose }) => {
  const isRtl = locale === 'ar';
  const dialogRef = useModalA11y<HTMLDivElement>(isOpen);
  const [copied, setCopied] = useState(false);
  const completedCount = 0;
  const progressPercent = 0;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(REFERRAL_LINK);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  };

  const rewardTiers = [
    {
      invites: 1,
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
      title: isRtl ? 'شارة صانع موثق' : 'Verified Creator Badge',
      desc: isRtl ? 'تظهر على ملفك الشخصي ورابطك' : 'Displayed on your public profile'
    },
    {
      invites: 3,
      icon: <Gift className="w-4 h-4 text-indigo-500" />,
      title: isRtl ? 'شهر Pro مجاناً' : '1 Month Free Pro',
      desc: isRtl ? 'وصول لكافة القوالب والتحليلات' : 'Unlock custom styles & analytics'
    },
    {
      invites: 5,
      icon: <Sparkles className="w-4 h-4 text-violet-500" />,
      title: isRtl ? 'ربط نطاق خاص دائم' : 'Custom Domain Perk',
      desc: isRtl ? 'ربط اسم نطاقك مجاناً' : 'Connect your own custom .com domain'
    }
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="referral-modal-title"
      ref={dialogRef}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl text-slate-900 dark:text-white p-6 sm:p-8 transition-colors duration-200">
        <button
          type="button"
          onClick={onClose}
          aria-label={isRtl ? 'إغلاق' : 'Close'}
          className="absolute top-5 right-5 rtl:right-auto rtl:left-5 w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200/80 dark:border-indigo-800/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs shrink-0">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 mb-1">
              <PremiumMark className="w-3 h-3" />
              <span>{isRtl ? 'برنامج مكافآت رالوا' : 'RALOA Rewards Program'}</span>
            </div>
            <h2 id="referral-modal-title" className="text-xl sm:text-2xl font-extrabold tracking-tight">
              {isRtl ? 'ادعُ أصدقاءك واحصل على شهر Pro مجاناً' : 'Refer Friends, Earn Free Pro'}
            </h2>
          </div>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          {isRtl
            ? 'شارك رابط الإحالة الخاص بك مع زملائك وصناع المحتوى لكسب اشتراكات ومزايا مجانية عند انضمامهم.'
            : 'Share your referral link with creators and friends to unlock free Pro subscription months and domain features.'}
        </p>

        {/* Milestone Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {rewardTiers.map((tier) => (
            <div
              key={tier.invites}
              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-7 h-7 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-2xs border border-slate-200/60 dark:border-slate-700">
                    {tier.icon}
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {tier.invites} {isRtl ? 'دعوات' : 'Invites'}
                  </span>
                </div>
                <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                  {tier.title}
                </h4>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                {tier.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Active Progress Bar */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 mb-6">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-sm font-bold">{isRtl ? 'التقدم نحو الشهر المجاني' : 'Progress to Free Pro Month'}</span>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-md border border-indigo-200/60 dark:border-indigo-800/60">
              {completedCount} / {TARGET_INVITES} {isRtl ? 'دعوات' : 'Invites'}
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Clock className="w-4 h-4" />
              <span>{isRtl ? 'سيظهر التقدم بعد ربط النظام.' : 'Progress will appear once tracking is connected.'}</span>
            </div>
            <span className="font-semibold text-slate-700 dark:text-slate-300">{progressPercent}%</span>
          </div>
        </div>

        {/* Copy Link Input Bar */}
        <div className="mb-6">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
            {isRtl ? 'رابط الإحالة' : 'Referral Link'}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={REFERRAL_LINK}
              aria-label={isRtl ? 'رابط الإحالة' : 'Referral link'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs sm:text-sm text-slate-900 dark:text-slate-100 select-all focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? (isRtl ? 'تم النسخ!' : 'Copied!') : (isRtl ? 'نسخ' : 'Copy')}</span>
            </button>
          </div>
        </div>

        {/* Informational Notice */}
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 mb-6 text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {isRtl
                ? 'برنامج الإحالة قيد التجهيز. لن يتم احتساب الدعوات أو إصدار مكافآت حتى يتم ربط التحقق والدفع بالخادم.'
                : 'The referral program is being prepared. Invites and rewards will not be counted or issued until verification and billing are connected.'}
            </span>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs cursor-pointer transition-colors shadow-2xs"
          >
            {isRtl ? 'تم' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
