import React, { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  QrCode as QrIcon,
  CheckCircle2,
  AlertCircle,
  Undo2,
  Redo2,
  Globe,
  ChevronDown,
  ArrowLeft
} from 'lucide-react';
import { Locale, UserMiniSiteSummary } from '../../types';
import { PremiumMark } from '../brand/PremiumMark';
import { normalizeSiteSlug } from '../../lib/siteSlug';

export interface StudioTopToolbarProps {
  handle: string;
  plan: 'free' | 'pro' | 'studio' | string;
  saveStatus: 'saving' | 'saved' | 'error' | 'recovery';
  publicationState: PublicationState;
  isPublished: boolean;
  onPublishToggle: () => void;
  onRetrySave?: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenQr: () => void;
  onClose: () => void;
  locale: Locale;
  sites: UserMiniSiteSummary[];
  activeSiteId: string;
  onSiteSelect: (siteId: string) => void;
  onCreateSite: () => void;
  onDeleteSite: () => void;
}

export type PublicationState = 'draft' | 'publishing' | 'published' | 'unpublishing' | 'failed';

export const StudioTopToolbar: React.FC<StudioTopToolbarProps> = ({
  handle,
  plan = 'free',
  saveStatus,
  publicationState,
  isPublished,
  onPublishToggle,
  onRetrySave,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenQr,
  onClose,
  locale,
  sites,
  activeSiteId,
  onSiteSelect,
  onCreateSite,
  onDeleteSite
}) => {
  const [copied, setCopied] = useState(false);
  const [siteSwitcherOpen, setSiteSwitcherOpen] = useState(false);
  const isRtl = locale === 'ar';
  const cleanHandle = normalizeSiteSlug(handle);
  const publicUrl = cleanHandle ? `https://raloa.app/@${cleanHandle}` : 'https://raloa.app/';

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="h-16 px-4 sm:px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 z-30 select-none">
      {/* Left: Site Switcher / Handle & Plan Badge */}
      <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
        <button
          type="button"
          onClick={onClose}
          className="p-2 -ml-1 rtl:-ml-0 rtl:-mr-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          aria-label={isRtl ? 'العودة إلى لوحة التحكم' : 'Back to Dashboard'}
          title={isRtl ? 'العودة' : 'Exit Studio'}
        >
          {isRtl ? <ArrowLeft className="w-5 h-5 rotate-180" /> : <ArrowLeft className="w-5 h-5" />}
        </button>

        <div className="relative">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setSiteSwitcherOpen(!siteSwitcherOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 border border-slate-200/80 dark:border-slate-700 max-w-[180px] sm:max-w-[240px] cursor-pointer transition-colors"
              title={isRtl ? 'تبديل الموقع أو الرابط' : 'Current Site / Switcher'}
            >
              <Globe className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="font-mono text-xs font-bold text-slate-800 dark:text-white truncate">
                @{cleanHandle}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>

            {/* Plan Indicator Badge */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 shrink-0">
              <PremiumMark className="w-2.5 h-2.5" />
              <span>{plan}</span>
            </span>
          </div>

          {/* Site Switcher Dropdown */}
          {siteSwitcherOpen && (
            <div className={`absolute top-full mt-2 ${isRtl ? 'right-0' : 'left-0'} w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100`}>
              <div className="px-3.5 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {isRtl ? 'الموقع النشط' : 'Active Site'}
              </div>
              <div className="max-h-52 overflow-y-auto p-2">
                {sites.map((site) => (
                  <button key={site.id} type="button" onClick={() => { onSiteSelect(site.id); setSiteSwitcherOpen(false); }} className={`w-full px-2 py-1.5 rounded-xl flex items-center justify-between text-left transition-colors ${site.id === activeSiteId ? 'bg-indigo-50 dark:bg-indigo-950/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <span className="min-w-0"><span className="block text-xs font-bold text-slate-800 dark:text-white truncate">@{site.username}</span><span className="block text-[10px] text-slate-400 truncate">{site.displayName || site.id}</span></span>
                    {site.id === activeSiteId && <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />}
                  </button>
                ))}
                {sites.length === 0 && <p className="px-2 py-2 text-xs text-slate-500">{isRtl ? 'لا توجد مواقع بعد.' : 'No sites yet.'}</p>}
              </div>
              <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => { onCreateSite(); setSiteSwitcherOpen(false); }} className="w-full px-3.5 py-1.5 text-left text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40">{isRtl ? '+ موقع جديد' : '+ New site'}</button>
                {sites.length > 1 && <button type="button" onClick={() => { onDeleteSite(); setSiteSwitcherOpen(false); }} className="w-full px-3.5 py-1.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">{isRtl ? 'حذف الموقع الحالي' : 'Delete current site'}</button>}
                {publicationState === 'published' ? <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between transition-colors"
                >
                  <span>{isRtl ? 'زيارة الرابط العام' : 'View Public URL'}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a> : <span
                  className="w-full px-3.5 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center justify-between"
                  title={isRtl ? 'انشر الموقع أولاً' : 'Publish the site first'}
                >
                  <span>{isRtl ? 'الرابط غير منشور' : 'Public URL unavailable'}</span>
                </span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center: persistence and publication state are intentionally separate */}
      <div className="flex items-center gap-2">
        {saveStatus === 'saving' && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-900/60 text-xs font-medium animate-pulse">
            <div className="w-2.5 h-2.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="hidden sm:inline">{isRtl ? 'جارِ الحفظ...' : 'Saving...'}</span>
          </div>
        )}

        {saveStatus === 'saved' && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="hidden sm:inline">{isRtl ? 'تم الحفظ على الخادم' : 'Saved to server'}</span>
          </div>
        )}

        {saveStatus === 'error' && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 text-xs font-medium">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{isRtl ? 'فشل الحفظ' : 'Save failed'}</span>
            {onRetrySave && (
              <button
                type="button"
                onClick={onRetrySave}
                className="underline text-[11px] font-bold hover:text-rose-700 cursor-pointer"
              >
                {isRtl ? 'إعادة المحاولة' : 'Retry'}
              </button>
            )}
          </div>
        )}

        {saveStatus === 'recovery' && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">{isRtl ? 'نسخة استرداد محلية' : 'Local recovery available'}</span>
          </div>
        )}

        <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${
          publicationState === 'published'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
            : publicationState === 'failed'
            ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300'
            : publicationState === 'publishing' || publicationState === 'unpublishing'
            ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
            : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
        }`}>
          <span className={`h-2 w-2 rounded-full ${publicationState === 'published' ? 'bg-emerald-500' : publicationState === 'failed' ? 'bg-rose-500' : publicationState === 'draft' ? 'bg-slate-400' : 'animate-pulse bg-amber-500'}`} />
          <span>{publicationState === 'published' ? (isRtl ? 'منشور' : 'Published') : publicationState === 'publishing' ? (isRtl ? 'جارٍ النشر...' : 'Publishing...') : publicationState === 'unpublishing' ? (isRtl ? 'جارٍ إلغاء النشر...' : 'Unpublishing...') : publicationState === 'failed' ? (isRtl ? 'فشل النشر' : 'Publish failed') : (isRtl ? 'مسودة' : 'Draft')}</span>
        </div>

        {/* Undo / Redo Controls */}
        <div className="hidden md:flex items-center gap-0.5 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:hover:text-slate-500 transition-colors cursor-pointer disabled:cursor-not-allowed"
            title={isRtl ? 'تراجع (Cmd+Z)' : 'Undo (Cmd+Z)'}
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:hover:text-slate-500 transition-colors cursor-pointer disabled:cursor-not-allowed"
            title={isRtl ? 'إعادة (Cmd+Shift+Z)' : 'Redo (Cmd+Shift+Z)'}
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right: publication and quick launch actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          type="button"
          onClick={onPublishToggle}
          disabled={publicationState === 'publishing' || publicationState === 'unpublishing'}
          className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap disabled:cursor-wait disabled:opacity-60 ${isPublished ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
        >
          <span>{isPublished ? (isRtl ? 'إلغاء النشر' : 'Unpublish') : publicationState === 'failed' ? (isRtl ? 'إعادة المحاولة' : 'Retry publish') : (isRtl ? 'نشر' : 'Publish')}</span>
        </button>
        {/* QR Code Modal Trigger */}
        <button
          type="button"
          onClick={onOpenQr}
          className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          title={isRtl ? 'رمز QR' : 'QR Code'}
        >
          <QrIcon className="w-4 h-4 text-indigo-500" />
          <span className="hidden md:inline">{isRtl ? 'رمز QR' : 'QR Code'}</span>
        </button>

        {/* Copy Link Button */}
        <button
          type="button"
          onClick={handleCopyLink}
          className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          title={isRtl ? 'نسخ الرابط المباشر' : 'Copy live link'}
        >
          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
          <span className="hidden sm:inline">
            {copied ? (isRtl ? 'تم النسخ!' : 'Copied!') : isRtl ? 'نسخ الرابط' : 'Copy link'}
          </span>
        </button>

        {/* View Live Page Button */}
        {publicationState === 'published' ? <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
          >
            <span>{isRtl ? 'عرض الصفحة' : 'View live'}</span>
            <ExternalLink className="w-3.5 h-3.5 rtl:rotate-180" />
          </a> : <span className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 font-bold text-xs whitespace-nowrap" title={isRtl ? 'انشر الموقع أولاً' : 'Publish the site first'}>{isRtl ? 'غير منشور' : 'Not live'}</span>}
      </div>
    </header>
  );
};
