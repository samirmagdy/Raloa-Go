import React, { useState, useRef } from 'react';
import { X, ArrowRight, CheckCircle2, Copy, Check, Share2, Link2 } from 'lucide-react';
import { PremiumMark } from '../brand/PremiumMark';
import { Locale, TemplateItem, BackgroundStyle } from '../../types';
import { PhoneMockup } from '../PhoneMockup';
import { Tooltip } from '../Tooltip';
import { getTemplateBackgroundContainerProperties } from '../../utils/templateThemes';
import { useModalA11y } from '../../hooks/useModalA11y';

interface TemplatePreviewModalProps {
  template: TemplateItem | null;
  locale: Locale;
  onClose: () => void;
  onUseTemplate: (template: TemplateItem) => void;
}

export const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({
  template,
  locale,
  onClose,
  onUseTemplate
}) => {
  if (!template) return null;
  const isRtl = locale === 'ar';
  const dialogRef = useModalA11y<HTMLDivElement>();

  const [copied, setCopied] = useState(false);
  const [activeBgStyle, setActiveBgStyle] = useState<BackgroundStyle>('signature');
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const bgContainerProps = getTemplateBackgroundContainerProperties(
    template,
    activeBgStyle
  );

  // Compute the direct canonical preview URL for this template
  const getTemplateUrl = () => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      return `${origin}/?template=${encodeURIComponent(template.id)}`;
    }
    return `https://raloa.me/?template=${encodeURIComponent(template.id)}`;
  };

  const templateUrl = getTemplateUrl();
  const displayUrl = `raloa.app/?template=${template.id}`;

  const handleCopyUrl = async () => {
    const url = getTemplateUrl();
    let succeeded = false;

    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        succeeded = true;
      } catch {
        succeeded = false;
      }
    }

    // Fallback using temporary textarea
    if (!succeeded && typeof document !== 'undefined') {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        succeeded = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch {
        succeeded = false;
      }
    }

    if (succeeded) {
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-preview-title"
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col md:flex-row max-h-[92vh] transition-colors duration-200">
        
        {/* Floating Success Notification Toast */}
        {copied && (
          <div
            role="status"
            aria-live="polite"
            className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-none"
          >
            <Check className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
            <span>{isRtl ? 'تم نسخ رابط القالب إلى الحافظة بنجاح!' : 'Template preview URL copied to clipboard!'}</span>
          </div>
        )}

        {/* Left Side: Mobile Phone Device Preview */}
        <div
          className="md:w-1/2 p-4 sm:p-6 flex flex-col items-center justify-center overflow-y-auto transition-all duration-500"
          style={bgContainerProps.stageContainerStyle}
        >
          <div className="w-full max-w-[280px] sm:max-w-[300px]">
            <PhoneMockup
              template={template}
              isRtl={isRtl}
              backgroundStyle={activeBgStyle}
            />
          </div>

          {/* Quick Background Theme Switcher */}
          <div className="mt-3.5 flex items-center gap-1 p-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs text-[11px]">
            <button
              type="button"
              onClick={() => setActiveBgStyle('signature')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                activeBgStyle === 'signature'
                  ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isRtl ? 'المظهر الأساسي' : 'Signature'}
            </button>
            <button
              type="button"
              onClick={() => setActiveBgStyle('immersive')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                activeBgStyle === 'immersive'
                  ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isRtl ? 'خلفية كاملة' : 'Immersive'}
            </button>
            <button
              type="button"
              onClick={() => setActiveBgStyle('gradient')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                activeBgStyle === 'gradient'
                  ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isRtl ? 'تدرج لوني' : 'Gradient'}
            </button>
          </div>
        </div>

        {/* Right Side: Template Details & Action */}
        <div className="md:w-1/2 p-6 sm:p-8 flex flex-col justify-between overflow-y-auto bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
          <div>
            {/* Top Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/50">
                  {template.category}
                </span>
                <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                  ID: #{template.id}
                </span>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Header Compact Share Button */}
                <Tooltip
                  content={isRtl ? 'مشاركة رابط القالب' : 'Share Template URL'}
                  description={isRtl ? 'نسخ رابط المعاينة المباشر' : 'Copy direct link to this preview'}
                  position="bottom"
                >
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                    aria-label={isRtl ? 'مشاركة رابط القالب' : 'Share template preview link'}
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Share2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </Tooltip>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Template Identity */}
            <div className="mt-6">
              <h2 id="template-preview-title" className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {template.name}
              </h2>
              <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mt-1">
                {template.role}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">
                {isRtl ? template.bioAr : template.bio}
              </p>
            </div>

            {/* Quick Share URL Strip */}
            <div className="mt-5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-850/70 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Link2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="text-xs font-mono text-slate-600 dark:text-slate-400 truncate select-all">
                  {displayUrl}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer group"
                aria-label={isRtl ? 'نسخ رابط القالب' : 'Copy template URL'}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{isRtl ? 'تم النسخ!' : 'Copied!'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
                    <span>{isRtl ? 'نسخ الرابط' : 'Copy'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Highlights Feature Checklist */}
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3">
                {isRtl ? 'الميزات المتضمنة في هذا القالب' : 'Template Highlights'}
              </h4>
              <div className="space-y-2.5">
                {[
                  isRtl ? 'تصميم مخصص لزيادة معدل النقر والتحويل' : 'Conversion-focused visual layout',
                  isRtl ? 'دعم متكامل لبطاقات المواعيد والمنتجات' : 'Integrated booking and product cards',
                  isRtl ? 'متجاوب تماماً مع الهواتف والكمبيوتر' : 'Fully responsive on all mobile viewports',
                  isRtl ? 'دعم كامل للخطوط العربية والإنجليزية' : 'Native English and Arabic typography'
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons Section with 'Copy Template URL' button */}
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-3">
            {/* Primary 'Use this template' CTA */}
            <button
              type="button"
              onClick={() => onUseTemplate(template)}
              className="w-full sm:flex-1 py-3.5 px-6 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <PremiumMark className="w-4 h-4 text-indigo-400 dark:text-indigo-600" />
              <span>{isRtl ? 'استخدم هذا القالب الآن' : 'Use this template'}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>

            {/* Dedicated 'Copy Template URL' Button */}
            <button
              id="copy-template-url-btn"
              type="button"
              onClick={handleCopyUrl}
              className="w-full sm:w-auto px-5 py-3.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label={isRtl ? 'نسخ رابط القالب' : 'Copy Template URL'}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {isRtl ? 'تم نسخ الرابط!' : 'URL Copied!'}
                  </span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
                  <span>{isRtl ? 'نسخ رابط القالب' : 'Copy Template URL'}</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-3.5 rounded-full border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {isRtl ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
