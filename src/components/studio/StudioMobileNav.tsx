import React, { useState } from 'react';
import {
  Layers,
  Palette,
  BarChart3,
  MoreHorizontal,
  Users,
  Settings,
  X,
  Smartphone,
  Edit3
} from 'lucide-react';
import { Locale } from '../../types';

export type StudioTab = 'content' | 'design' | 'audience' | 'analytics' | 'settings';

interface StudioMobileNavProps {
  activeTab: StudioTab;
  onSelectTab: (tab: StudioTab) => void;
  mobileViewMode: 'editor' | 'preview';
  onToggleMobileViewMode: () => void;
  locale: Locale;
}

export const StudioMobileNav: React.FC<StudioMobileNavProps> = ({
  activeTab,
  onSelectTab,
  mobileViewMode,
  onToggleMobileViewMode,
  locale
}) => {
  const isRtl = locale === 'ar';
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);

  const handleTabClick = (tab: StudioTab) => {
    onSelectTab(tab);
    setMoreDrawerOpen(false);
  };

  return (
    <>
      {/* Floating Mobile Switcher: Editor vs Live Preview */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 lg:hidden shadow-xl">
        <button
          type="button"
          onClick={onToggleMobileViewMode}
          className="px-4 py-2.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs flex items-center gap-2 border border-slate-700/60 dark:border-slate-200/60 shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          {mobileViewMode === 'editor' ? (
            <>
              <Smartphone className="w-4 h-4 text-indigo-400 dark:text-indigo-600" />
              <span>{isRtl ? 'معاينة الموقع' : 'Show Live Preview'}</span>
            </>
          ) : (
            <>
              <Edit3 className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
              <span>{isRtl ? 'العودة للمحرر' : 'Back to Editor'}</span>
            </>
          )}
        </button>
      </div>

      {/* Bottom Sticky Navigation Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 lg:hidden h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 select-none"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* 1. Content */}
        <button
          type="button"
          onClick={() => handleTabClick('content')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-colors cursor-pointer ${
            activeTab === 'content'
              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span className="text-[10px]">{isRtl ? 'المحتوى' : 'Content'}</span>
        </button>

        {/* 2. Design */}
        <button
          type="button"
          onClick={() => handleTabClick('design')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-colors cursor-pointer ${
            activeTab === 'design'
              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span className="text-[10px]">{isRtl ? 'التصميم' : 'Design'}</span>
        </button>

        {/* 3. Stats (Analytics) */}
        <button
          type="button"
          onClick={() => handleTabClick('analytics')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-colors cursor-pointer ${
            activeTab === 'analytics'
              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span className="text-[10px]">{isRtl ? 'الإحصائيات' : 'Stats'}</span>
        </button>

        {/* 4. More (Audience & Settings) */}
        <button
          type="button"
          onClick={() => setMoreDrawerOpen(true)}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-colors cursor-pointer ${
            activeTab === 'audience' || activeTab === 'settings'
              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <MoreHorizontal className="w-4 h-4" />
          <span className="text-[10px]">{isRtl ? 'المزيد' : 'More'}</span>
        </button>
      </nav>

      {/* Inside More: Bottom Drawer for Audience & Settings */}
      {moreDrawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-slate-950/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-200"
          onClick={() => setMoreDrawerOpen(false)}
        >
          <div
            className="w-full bg-white dark:bg-slate-900 rounded-t-3xl p-6 shadow-2xl border-t border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom duration-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {isRtl ? 'المزيد من الأدوات' : 'More Tools'}
              </span>
              <button
                type="button"
                onClick={() => setMoreDrawerOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleTabClick('audience')}
                className={`w-full p-3.5 rounded-2xl border text-left rtl:text-right flex items-center justify-between transition-colors cursor-pointer ${
                  activeTab === 'audience'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold'
                    : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-indigo-500" />
                  <div>
                    <p className="text-xs font-bold">{isRtl ? 'الجمهور والمشتركون' : 'Audience & Leads'}</p>
                    <p className="text-[10px] text-slate-400">{isRtl ? 'المشتركون بالبريد ورسائل النماذج' : 'Newsletter subscribers & form submissions'}</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleTabClick('settings')}
                className={`w-full p-3.5 rounded-2xl border text-left rtl:text-right flex items-center justify-between transition-colors cursor-pointer ${
                  activeTab === 'settings'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold'
                    : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-slate-500" />
                  <div>
                    <p className="text-xs font-bold">{isRtl ? 'إعدادات الموقع والنطاق' : 'Site Settings & Domain'}</p>
                    <p className="text-[10px] text-slate-400">{isRtl ? 'النطاق المخصص، SEO، والربط' : 'Custom domain, SEO tags, analytics integrations'}</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
