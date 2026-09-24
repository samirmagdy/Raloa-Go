import React from 'react';
import { X, Shield } from 'lucide-react';
import { Locale } from '../../types';
import { useModalA11y } from '../../hooks/useModalA11y';

interface LegalModalProps {
  title: string;
  locale: Locale;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ title, locale, onClose }) => {
  const isRtl = locale === 'ar';
  const dialogRef = useModalA11y<HTMLDivElement>();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-dialog-title"
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh] transition-colors duration-200">
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span id="legal-dialog-title" className="text-xs font-bold text-slate-800 dark:text-slate-200">{title}</span>
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

        <div className="p-6 overflow-y-auto text-xs text-slate-600 dark:text-slate-300 space-y-3 leading-relaxed">
          <p className="font-bold text-slate-900 dark:text-white text-sm">
            {isRtl ? 'التزام رالوا بالخصوصية والأمان' : 'RALOA Data Privacy & Integrity Commitment'}
          </p>
          <p>
            {isRtl
              ? 'نحن في رالوا نلتزم بأعلى معايير حماية البيانات والخصوصية لكافة مستخدمينا وصناع المحتوى وزوار صفحاتهم. لا نقوم ببيع بياناتك الشخصية لأي طرف ثالث، وتظل كافة حقوق ملكية محتواك وتصاميمك ملكاً حصرياً لك.'
              : 'At RALOA, your mini-site data, subscriber records, bookings, and creative assets remain 100% your property. We never sell your personal data or your visitors’ analytical interactions to data brokers.'}
          </p>
          <p>
            {isRtl
              ? 'تتم استضافة جميع الروابط عبر شبكة توزيع محتوى مشفرة بروتوكول TLS 1.3 مع شهادات أمان معتمدة. يمكنك طلب تصدير بياناتك أو حذف حسابك بشكل دائم في أي وقت.'
              : 'All mini-sites and custom domains are encrypted in transit with TLS 1.3 certificates and distributed globally on high-availability edge nodes with 99.99% uptime.'}
          </p>
          <p className="pt-2 text-slate-400 dark:text-slate-500 text-[11px]">
            {isRtl ? 'آخر تحديث: سبتمبر ٢٠٢٤ · رالوا للتقنية المحدودة' : 'Last updated: September 2024 · RALOA Platforms Ltd.'}
          </p>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#0F172A] hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            {isRtl ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
