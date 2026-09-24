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
import { Locale } from '../../types';
import { PremiumMark } from '../brand/PremiumMark';

export interface StudioTopToolbarProps {
  handle: string;
  plan: 'free' | 'pro' | 'studio' | string;
  saveStatus: 'saving' | 'saved' | 'live' | 'error';
  onRetrySave?: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenQr: () => void;
  onClose: () => void;
  locale: Locale;
}

export const StudioTopToolbar: React.FC<StudioTopToolbarProps> = ({
  handle,
  plan = 'free',
  saveStatus,
  onRetrySave,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenQr,
  onClose,
  locale
}) => {
  const [copied, setCopied] = useState(false);
  const [siteSwitcherOpen, setSiteSwitcherOpen] = useState(false);
  const isRtl = locale === 'ar';
  const cleanHandle = handle.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const publicUrl = `https://raloa.app/@${cleanHandle}`;

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
              <div className="p-2">
                <div className="px-2 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 truncate">@{cleanHandle}</p>
                    <p className="text-[10px] text-slate-400 truncate">{publicUrl.replace('https://', '')}</p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                </div>
              </div>
              <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between transition-colors"
                >
                  <span>{isRtl ? 'زيارة الرابط العام' : 'View Public URL'}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center: Save Status Indicators (4 States: Saving, Saved, Live, Save failed) */}
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
            <span className="hidden sm:inline">{isRtl ? 'تم الحفظ' : 'Saved'}</span>
          </div>
        )}

        {saveStatus === 'live' && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <span>{isRtl ? 'مباشر' : 'Live'}</span>
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

      {/* Right: Quick Launch Actions (QR, Copy, View live page) */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
        >
          <span>{isRtl ? 'عرض الصفحة' : 'View live'}</span>
          <ExternalLink className="w-3.5 h-3.5 rtl:rotate-180" />
        </a>
      </div>
    </header>
  );
};
