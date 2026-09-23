import React, { useState, useRef, useEffect } from 'react';
import { Instagram, Youtube, Linkedin, Twitter, Keyboard, BarChart3, Link2, Check, Share2, Gift } from 'lucide-react';
import { RaloaLogo } from './brand/RaloaLogo';
import { Locale } from '../types';
import { dictionary } from '../data/content';
import { Tooltip } from './Tooltip';

interface FooterProps {
  locale: Locale;
  onOpenPrivacyTerms?: (type: string) => void;
  onOpenShortcuts?: () => void;
  onOpenStats?: () => void;
  onOpenReferral?: () => void;
  onTriggerNotFound?: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({
  locale,
  onOpenPrivacyTerms,
  onOpenShortcuts,
  onOpenStats,
  onOpenReferral,
  onTriggerNotFound
}) => {
  const isRtl = locale === 'ar';
  const t = dictionary[locale].footer;
  const [copied, setCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const handleShareRaloa = async () => {
    try {
      const url = typeof window !== 'undefined' ? window.location.href : 'https://raloa.app';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setShowToast(true);

      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }

      toastTimeoutRef.current = setTimeout(() => {
        setCopied(false);
        setShowToast(false);
      }, 2600);
    } catch (err) {
      console.error('Failed to copy URL to clipboard:', err);
    }
  };

  const footerLinks = {
    product: {
      title: t.product,
      links: [
        { label: locale === 'ar' ? 'المميزات' : 'Features', href: '#features' },
        { label: locale === 'ar' ? 'القوالب' : 'Templates', href: '#templates' },
        { label: locale === 'ar' ? 'الأسعار' : 'Pricing', href: '#pricing' },
        { label: locale === 'ar' ? 'اكسب رصيداً' : 'Earn Credits', href: '#referral' },
        { label: locale === 'ar' ? 'إحصائيات المشروع' : 'Project Stats', href: '#project-stats' },
        { label: locale === 'ar' ? 'سجل التحديثات' : 'Changelog', href: '#changelog' }
      ]
    },
    company: {
      title: t.company,
      links: [
        { label: locale === 'ar' ? 'عن رالوا' : 'About', href: '#about' },
        { label: locale === 'ar' ? 'المدونة' : 'Blog', href: '#blog' },
        { label: locale === 'ar' ? 'الوظائف' : 'Careers', href: '#careers' },
        { label: locale === 'ar' ? 'تواصل معنا' : 'Contact', href: '#contact' }
      ]
    },
    resources: {
      title: t.resources,
      links: [
        { label: locale === 'ar' ? 'مركز المساعدة' : 'Help Center', href: '#help' },
        { label: locale === 'ar' ? 'أدلة الاستخدام' : 'Guides', href: '#guides' },
        { label: locale === 'ar' ? 'مجتمع المبدعين' : 'Community', href: '#community' },
        { label: locale === 'ar' ? 'حالة الخدمة' : 'Status', href: '#status' },
        { label: locale === 'ar' ? 'صفحة 404 (معاينة)' : '404 Demo Page', href: '/404' }
      ]
    },
    legal: {
      title: t.legal,
      links: [
        { label: locale === 'ar' ? 'سياسة الخصوصية' : 'Privacy', href: '#privacy' },
        { label: locale === 'ar' ? 'الشروط والأحكام' : 'Terms', href: '#terms' },
        { label: locale === 'ar' ? 'سياسة ملفات تعريف الارتباط' : 'Cookie Policy', href: '#cookies' }
      ]
    }
  };

  const handleLinkClick = (e: React.MouseEvent, label: string, href: string) => {
    if (label === 'Privacy' || label === 'Terms' || label === 'Cookie Policy' || label === 'سياسة الخصوصية' || label === 'الشروط والأحكام') {
      e.preventDefault();
      if (onOpenPrivacyTerms) onOpenPrivacyTerms(label);
    } else if (label === 'Project Stats' || label === 'إحصائيات المشروع') {
      e.preventDefault();
      if (onOpenStats) onOpenStats();
    } else if (label === 'Earn Credits' || label === 'اكسب رصيداً') {
      e.preventDefault();
      if (onOpenReferral) onOpenReferral();
    } else if (href === '/404' || href === '#404') {
      e.preventDefault();
      if (onTriggerNotFound) onTriggerNotFound('/404');
    } else if (href.startsWith('#')) {
      const targetId = href.replace('#', '');
      const el = document.getElementById(targetId);
      if (!el && onTriggerNotFound) {
        e.preventDefault();
        onTriggerNotFound(href);
      }
    }
  };

  return (
    <footer className="bg-white dark:bg-slate-950 border-t border-slate-200/90 dark:border-slate-850 pt-16 pb-12 text-slate-600 dark:text-slate-400 transition-colors duration-200">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Footer Row */}
        <div className="grid grid-cols-2 md:grid-cols-12 gap-8 lg:gap-12 pb-12 border-b border-slate-100 dark:border-slate-800/80">
          
          {/* Brand Info (4 cols) */}
          <div className="col-span-2 md:col-span-4 flex flex-col items-start">
            <RaloaLogo isRtl={isRtl} size="md" />
            <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-4 max-w-xs leading-relaxed">
              {isRtl
                ? 'المنصة الرائدة لبناء المواقع المصغرة الأنيقة لصناع المحتوى والمستقلين وأصحاب الأعمال.'
                : 'A fast, design-first mini-site builder for creators, freelancers and businesses.'}
            </p>

            <div className="mt-6 flex items-center gap-3">
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="RALOA on X"
                className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-colors border border-slate-200 dark:border-slate-800 shadow-2xs"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="RALOA on Instagram"
                className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-colors border border-slate-200 dark:border-slate-800 shadow-2xs"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="RALOA on YouTube"
                className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-colors border border-slate-200 dark:border-slate-800 shadow-2xs"
              >
                <Youtube className="w-4 h-4" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="RALOA on LinkedIn"
                className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-colors border border-slate-200 dark:border-slate-800 shadow-2xs"
              >
                <Linkedin className="w-4 h-4" />
              </a>
            </div>

            {/* Quick Share / Copy URL button & Earn Credits */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {onOpenReferral && (
                <button
                  type="button"
                  onClick={onOpenReferral}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/70 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/90 dark:border-indigo-800/90 transition-all cursor-pointer shadow-2xs group"
                  title={isRtl ? 'اكسب رصيداً - برنامج الإحالة' : 'Earn Credits - Referral Program'}
                  aria-label={isRtl ? 'اكسب رصيداً' : 'Earn Credits'}
                >
                  <Gift className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
                  <span>{isRtl ? 'اكسب رصيداً (شهر Pro)' : 'Earn Credits (Free Pro)'}</span>
                </button>
              )}

              <button
                type="button"
                id="share-raloa-button"
                onClick={handleShareRaloa}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-bold bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 transition-all cursor-pointer shadow-2xs group"
                title={isRtl ? 'مشاركة RALOA (نسخ الرابط)' : 'Share RALOA (Copy link)'}
                aria-label={isRtl ? 'مشاركة RALOA' : 'Share RALOA'}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      {isRtl ? 'تم النسخ!' : 'Copied!'}
                    </span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
                    <span>{isRtl ? 'مشاركة RALOA' : 'Share RALOA'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Navigation Links Columns (8 cols) */}
          <div className="col-span-2 md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
            {Object.entries(footerLinks).map(([key, group]) => (
              <div key={key}>
                <h4 className="font-extrabold text-[13px] text-[#0F172A] dark:text-white uppercase tracking-wider mb-4">
                  {group.title}
                </h4>
                <ul className="space-y-2.5">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        onClick={(e) => handleLinkClick(e, link.label, link.href)}
                        className="text-[13px] text-slate-500 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white transition-colors"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

        </div>

        {/* Bottom Bar: Copyright & Attribution */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-slate-400 dark:text-slate-500">
          <p>{t.copyright}</p>
          <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-6">
            <button
              type="button"
              id="share-raloa-bottom-button"
              onClick={handleShareRaloa}
              className="flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer group"
              title={isRtl ? 'مشاركة RALOA (نسخ الرابط)' : 'Share RALOA (Copy link)'}
              aria-label={isRtl ? 'مشاركة RALOA' : 'Share RALOA'}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {isRtl ? 'تم النسخ!' : 'Copied!'}
                  </span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                  <span>{isRtl ? 'مشاركة RALOA' : 'Share RALOA'}</span>
                </>
              )}
            </button>
            {onOpenReferral && (
              <button
                type="button"
                onClick={onOpenReferral}
                className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold transition-colors cursor-pointer group"
                title={isRtl ? 'اكسب رصيداً - برنامج الإحالة' : 'Earn Credits - Referral Program'}
                aria-label={isRtl ? 'اكسب رصيداً' : 'Earn Credits'}
              >
                <Gift className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                <span>{isRtl ? 'اكسب رصيداً' : 'Earn Credits'}</span>
              </button>
            )}
            {onOpenStats && (
              <Tooltip
                content={isRtl ? 'إحصائيات المشروع' : 'Project Stats'}
                description={isRtl ? 'عرض أرقام ونمو مجتمع مبدعي RALOA' : 'Explore platform metrics & creator community growth'}
                position="top"
              >
                <button
                  type="button"
                  onClick={onOpenStats}
                  className="flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer group"
                  aria-label={isRtl ? 'عرض إحصائيات المشروع' : 'View Project Stats'}
                >
                  <BarChart3 className="w-3.5 h-3.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                  <span>{isRtl ? 'إحصائيات المشروع' : 'Project Stats'}</span>
                </button>
              </Tooltip>
            )}
            {onOpenShortcuts && (
              <Tooltip
                content={isRtl ? 'اختصارات المفاتيح' : 'Keyboard Shortcuts'}
                description={isRtl ? 'استعراض جميع مفاتيح التحكم السريع' : 'View accessibility key bindings and controls'}
                shortcut="?"
                position="top"
              >
                <button
                  type="button"
                  onClick={onOpenShortcuts}
                  className="flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer group"
                  aria-label={isRtl ? 'عرض اختصارات لوحة المفاتيح' : 'Show Keyboard Shortcuts'}
                >
                  <Keyboard className="w-3.5 h-3.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                  <span>{isRtl ? 'اختصارات المفاتيح' : 'Shortcuts'}</span>
                  <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-500 dark:text-slate-400">
                    ?
                  </kbd>
                </button>
              </Tooltip>
            )}
            <span>{isRtl ? 'الرياض · لندن · سان فرانسيسكو' : 'London · Riyadh · San Francisco'}</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-slate-600 dark:text-slate-400 font-medium">{isRtl ? 'جميع الأنظمة تعمل' : 'All systems operational'}</span>
            </div>
          </div>
        </div>

        {/* Small 'Copied!' Toast Notification */}
        {showToast && (
          <aside
            id="share-raloa-toast"
            role="status"
            aria-live="polite"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2 bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 rounded-full shadow-2xl backdrop-blur-md border border-slate-700/60 dark:border-slate-300 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200 select-none print:hidden pointer-events-none"
          >
            <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 dark:text-emerald-600 flex items-center justify-center shrink-0">
              <Check className="w-3 h-3 stroke-[3]" />
            </span>
            <span className="font-bold">{isRtl ? 'تم النسخ!' : 'Copied!'}</span>
            <span className="text-[11px] text-slate-300 dark:text-slate-600 font-normal">
              {isRtl ? 'تم نسخ رابط RALOA إلى الحافظة' : 'RALOA landing page link copied to clipboard'}
            </span>
          </aside>
        )}

      </div>
    </footer>
  );
};
