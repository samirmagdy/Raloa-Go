import React from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, RefreshCw, ExternalLink, HelpCircle, CheckCircle2 } from 'lucide-react';
import { RaloaLogo } from './brand/RaloaLogo';
import { Locale } from '../types';

interface InvalidSslFallbackProps {
  hostname?: string;
  locale?: Locale;
  onRetry?: () => void;
  onReturnHome?: () => void;
}

export const InvalidSslFallback: React.FC<InvalidSslFallbackProps> = ({
  hostname = typeof window !== 'undefined' ? window.location.hostname : 'customdomain.com',
  locale = 'en',
  onRetry = () => {
    if (typeof window !== 'undefined') window.location.reload();
  },
  onReturnHome = () => {
    if (typeof window !== 'undefined') window.location.href = 'https://raloa.app/';
  },
}) => {
  const isRtl = locale === 'ar';

  const t = {
    badge: isRtl ? 'رمز الخطأ: 526 · شهادة SSL قيد المعالجة' : 'HTTP Error 526 · Invalid SSL / Configuration Pending',
    title: isRtl ? 'شهادة الأمان غير صالحة أو قيد التفعيل' : 'SSL Certificate Handshake Pending',
    description: isRtl
      ? `النطاق المخصص (${hostname}) مرتبط بمنصة رالوا، ولكن عملية إصدار شهادة الأمان (TLS/SSL) التلقائية لم تكتمل بعد أو أن سجلات DNS ما زالت قيد الانتشار.`
      : `The custom domain (${hostname}) is routed to the RALOA Edge Network, but the automated TLS/SSL certificate handshake has not yet completed or DNS records are still propagating.`,
    checklistTitle: isRtl ? 'خطوات التحقق من الإعداد:' : 'Verification Checklist:',
    step1: isRtl
      ? 'تحقق من توجيه سجل CNAME إلى cname.raloa.app أو سجل A إلى عناوين Anycast IP المحددة.'
      : 'Verify your CNAME record points to cname.raloa.app or your A record targets RALOA Anycast IPs.',
    step2: isRtl
      ? 'تأكد من عدم وجود تضارب في سجلات CAA تمنع Let\'s Encrypt / ZeroSSL من إصدار الشهادة.'
      : 'Ensure no conflicting CAA DNS records prevent Let\'s Encrypt / ZeroSSL issuance.',
    step3: isRtl
      ? 'قد يستغرق انتشار سجلات DNS عالمياً ما بين 5 دقائق وحتى 24 ساعة.'
      : 'Allow 5 minutes to 24 hours for global DNS propagation to settle.',
    retryButton: isRtl ? 'إعادة فحص الاتصال' : 'Retry SSL Handshake',
    docsButton: isRtl ? 'دليل إعداد النطاق المخصص' : 'Custom Domain Setup Guide',
    returnHome: isRtl ? 'الذهاب إلى raloa.app' : 'Go to raloa.app',
    supportNote: isRtl
      ? 'هل أنت صاحب هذا الموقع؟ تحقق من لوحة التحكم في رالوا لمتابعة حالة التحقق من النطاق.'
      : 'Are you the domain owner? Check your RALOA Studio dashboard to monitor domain verification status.',
  };

  return (
    <div
      id="ssl-fallback-page"
      className="min-h-[100dvh] flex flex-col justify-between bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors duration-200 relative overflow-hidden"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Decorative ambient gradient backdrop */}
      <div
        aria-hidden="true"
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-amber-500/10 via-rose-500/10 to-indigo-500/5 dark:from-amber-600/15 dark:via-rose-600/15 dark:to-indigo-600/10 rounded-full blur-3xl pointer-events-none"
      />

      {/* Header bar */}
      <header className="relative z-10 w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onReturnHome}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl"
        >
          <RaloaLogo isRtl={isRtl} size="md" />
        </button>
        <span className="text-xs font-mono font-medium px-3 py-1 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          EDGE_SSL_526
        </span>
      </header>

      {/* Main card */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-10 max-w-2xl mx-auto text-center">
        {/* Status Icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-20 h-20 rounded-3xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center mb-6 shadow-lg shadow-amber-500/5"
        >
          <ShieldAlert className="w-10 h-10" />
        </motion.div>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-300/80 dark:border-amber-800/60 mb-4"
        >
          <span>{t.badge}</span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-3"
        >
          {t.title}
        </motion.h1>

        {/* Hostname callout */}
        <div className="font-mono text-xs sm:text-sm px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 font-bold mb-4">
          {hostname}
        </div>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed mb-6"
        >
          {t.description}
        </motion.p>

        {/* Checklist */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="w-full text-left bg-white dark:bg-slate-900/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm mb-8"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-indigo-500" />
            <span>{t.checklistTitle}</span>
          </div>
          <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{t.step1}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{t.step2}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{t.step3}</span>
            </li>
          </ul>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="flex flex-wrap items-center justify-center gap-3 w-full"
        >
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{t.retryButton}</span>
          </button>

          <a
            href="https://raloa.app/#faq"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold border border-slate-200 dark:border-slate-800 transition-colors shadow-2xs"
          >
            <span>{t.docsButton}</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
        </motion.div>

        {/* Footer note */}
        <p className="mt-6 text-xs text-slate-500 dark:text-slate-400 max-w-md">
          {t.supportNote}
        </p>
      </main>

      {/* Bottom Footer */}
      <footer className="relative z-10 w-full py-6 text-center text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-900">
        <p>© {new Date().getFullYear()} RALOA Edge Proxy · Cloudflare SNI / ACME HTTP-01 Automated</p>
      </footer>
    </div>
  );
};
