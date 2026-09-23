import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { PremiumMark } from '../brand/PremiumMark';
import { Locale } from '../../types';
import { useModalA11y } from '../../hooks/useModalA11y';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  locale: Locale;
  onClose: () => void;
  onTriggerEasterEgg?: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  locale,
  onClose,
  onTriggerEasterEgg
}) => {
  if (!isOpen) return null;

  const isRtl = locale === 'ar';
  const dialogRef = useModalA11y<HTMLDivElement>(isOpen);
  const isMac = typeof navigator !== 'undefined' && /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent || navigator.platform);

  const shortcuts = [
    {
      keys: [isMac ? '⌘' : 'Ctrl', 'K'],
      description: isRtl ? 'فتح لوحة الأوامر والبحث الفوري عن الأقسام والقوالب' : 'Open command palette & quick search for sections/templates'
    },
    {
      keys: ['Esc'],
      description: isRtl ? 'إغلاق أي نافذة أو نموذج مفتوح' : 'Close any open modal or dialog'
    },
    {
      keys: ['T'],
      description: isRtl ? 'التبديل بين الوضع الداكن والفاتح' : 'Toggle dark / light theme'
    },
    {
      keys: ['M'],
      description: isRtl ? 'تشغيل أو كتم الصوت المحيطي' : 'Enable / mute ambient sound'
    },
    {
      keys: ['V'],
      description: isRtl ? 'تشغيل أو إيقاف الجولة الصوتية التعريفية' : 'Toggle voice-over tour narration'
    },
    {
      keys: ['L'],
      description: isRtl ? 'التبديل بين اللغتين الإنجليزية والعربية' : 'Toggle language (EN / AR)'
    },
    {
      keys: ['H'],
      description: isRtl ? 'العودة إلى أعلى الصفحة (البداية)' : 'Scroll to top (Hero section)'
    },
    {
      keys: ['?'],
      description: isRtl ? 'عرض أو إخفاء دليل اختصارات لوحة المفاتيح' : 'Show or hide this keyboard shortcuts guide'
    }
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-dialog-title"
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="shortcuts-dialog-title"
                className="text-sm font-bold text-slate-900 dark:text-white"
              >
                {isRtl ? 'اختصارات لوحة المفاتيح' : 'Keyboard Shortcuts'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isRtl ? 'للتنقل والوصول السريع' : 'Fast navigation & accessibility'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label={isRtl ? 'إغلاق' : 'Close'}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="p-6 divide-y divide-slate-100 dark:divide-slate-800/80">
          {shortcuts.map((item, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between py-3 ${
                idx === 0 ? 'pt-0' : ''
              } ${idx === shortcuts.length - 1 ? 'pb-0' : ''}`}
            >
              <span className="text-[13px] text-slate-700 dark:text-slate-300 font-medium">
                {item.description}
              </span>
              <div className="flex items-center gap-1.5 shrink-0 ltr:ml-3 rtl:mr-3">
                {item.keys.map((k, kIdx) => (
                  <kbd
                    key={kIdx}
                    className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 text-[12px] font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg shadow-2xs font-mono select-none"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Secret Easter Egg Hint */}
        <div className="px-6 py-3 bg-amber-500/10 dark:bg-amber-950/30 border-t border-amber-500/20 flex items-center justify-between text-[11px] text-amber-700 dark:text-amber-300">
          <div className="flex items-center gap-1.5 min-w-0">
            <PremiumMark className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">
              {isRtl ? 'سر خفي: اكتب "RALOA" أو كود كونامي' : 'Secret: Type "RALOA" or Konami Code'}
            </span>
          </div>
          {onTriggerEasterEgg && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onTriggerEasterEgg();
              }}
              className="px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer shrink-0"
            >
              {isRtl ? 'تجربة' : 'Try'}
            </button>
          )}
        </div>

        {/* Footer tip */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>{isRtl ? 'اضغط Esc للإغلاق في أي وقت' : 'Press Esc to dismiss anytime'}</span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            Esc
          </span>
        </div>

      </div>
    </div>
  );
};
