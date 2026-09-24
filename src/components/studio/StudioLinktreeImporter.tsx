import React, { useState } from 'react';
import { X, Sparkles, ArrowRight, Download, Check, AlertCircle, Link2, ExternalLink } from 'lucide-react';
import { Locale } from '../../types';
import { StudioBlockItem } from './SortableBlockList';

interface StudioLinktreeImporterProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (importedData: {
    displayName?: string;
    bio?: string;
    links: StudioBlockItem[];
  }) => void;
  locale: Locale;
}

export const StudioLinktreeImporter: React.FC<StudioLinktreeImporterProps> = ({
  isOpen,
  onClose,
  onImport,
  locale
}) => {
  const [inputUrl, setInputUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRtl = locale === 'ar';

  if (!isOpen) return null;

  const handleSimulatedImport = (usernameOrUrl: string) => {
    setError(null);
    setIsProcessing(true);

    const cleanInput = usernameOrUrl
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/^linktr\.ee\//i, '')
      .replace(/^@/, '')
      .toLowerCase();

    if (!cleanInput) {
      setError(isRtl ? 'يرجى إدخال اسم مستخدم أو رابط Linktree صالح' : 'Please enter a valid Linktree username or URL');
      setIsProcessing(false);
      return;
    }

    setTimeout(() => {
      // Generate parsed links based on username
      const sampleNames: Record<string, { name: string; bio: string; links: StudioBlockItem[] }> = {
        alex: {
          name: 'Alex Parks',
          bio: 'Building indie software tools & sharing creative product ideas.',
          links: [
            { id: 'lt-1', title: 'My Latest Podcast Episode', url: 'https://open.spotify.com/episode/sample', subtitle: 'Episode #42 on Product Design', type: 'link' },
            { id: 'lt-2', title: 'Read My Substack Newsletter', url: 'https://substack.com/@alex', subtitle: 'Weekly articles on creator economy', type: 'link' },
            { id: 'lt-3', title: 'Book a 1:1 Strategy Call', url: 'https://cal.com/alex/30min', subtitle: '30-minute founder consultation', type: 'booking' },
            { id: 'lt-4', title: 'Support My Open-Source Work', url: 'https://buymeacoffee.com/alex', subtitle: 'Tips & community support', type: 'link' }
          ]
        },
        elena: {
          name: 'Elena Rostova',
          bio: 'Minimalist product designer & architectural photographer based in Berlin.',
          links: [
            { id: 'lt-1', title: '2026 Architectural Photography Portfolio', url: 'https://behance.net/elena', subtitle: 'Monochrome and brutalist designs', type: 'gallery' },
            { id: 'lt-2', title: 'Fine Art Print Shop', url: 'https://gumroad.com/elena/prints', subtitle: 'Limited edition museum grade prints', type: 'shop' },
            { id: 'lt-3', title: 'Lightroom Film Presets Pack', url: 'https://gumroad.com/elena/presets', subtitle: '12 vintage film color grades', type: 'shop' },
            { id: 'lt-4', title: 'Commercial Inquiries & Booking', url: 'mailto:contact@elena.design', subtitle: 'Direct email for campaigns', type: 'booking' }
          ]
        }
      };

      const matched = sampleNames[cleanInput] || {
        name: cleanInput.charAt(0).toUpperCase() + cleanInput.slice(1),
        bio: `Creator profile imported from Linktree (@${cleanInput}).`,
        links: [
          { id: `lt-${Date.now()}-1`, title: 'Official Website', url: `https://${cleanInput}.com`, subtitle: 'Portfolio & About', type: 'link' },
          { id: `lt-${Date.now()}-2`, title: 'Instagram Feed', url: `https://instagram.com/${cleanInput}`, subtitle: 'Daily stories & highlights', type: 'link' },
          { id: `lt-${Date.now()}-3`, title: 'YouTube Channel', url: `https://youtube.com/@${cleanInput}`, subtitle: 'Video essays & tutorials', type: 'link' },
          { id: `lt-${Date.now()}-4`, title: 'Get in Touch', url: `mailto:hello@${cleanInput}.com`, subtitle: 'Business partnerships', type: 'link' }
        ]
      };

      onImport({
        displayName: matched.name,
        bio: matched.bio,
        links: matched.links
      });

      setIsProcessing(false);
      onClose();
    }, 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isRtl ? 'استيراد فوري من Linktree' : 'Instant Linktree Importer'}
              </h3>
              <p className="text-xs text-slate-500">
                {isRtl ? 'انقل روابطك ومعلوماتك بنقرة واحدة إلى رالوا' : 'Migrate your existing bio links to RALOA in one click'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="my-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isRtl ? 'رابط Linktree أو اسم المستخدم' : 'Linktree URL or Username'}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 pl-3.5 rtl:pl-0 rtl:pr-3.5 flex items-center pointer-events-none text-xs font-mono text-slate-400">
                linktr.ee/
              </span>
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => {
                  setInputUrl(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSimulatedImport(inputUrl);
                  }
                }}
                placeholder="yourhandle"
                className="w-full pl-22 rtl:pl-3.5 rtl:pr-22 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900 text-xs text-rose-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Demo Shortcuts */}
          <div className="pt-2">
            <p className="text-[11px] text-slate-400 mb-2">
              {isRtl ? 'أو جرب نماذج استيراد جاهزة:' : 'Or try sample creator accounts:'}
            </p>
            <div className="flex flex-wrap gap-2">
              {['alex', 'elena', 'sarah', 'traveler'].map((demo) => (
                <button
                  key={demo}
                  type="button"
                  onClick={() => {
                    setInputUrl(demo);
                    handleSimulatedImport(demo);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono cursor-pointer transition-colors"
                >
                  @{demo}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-[11px] text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              {isRtl ? 'ما الذي سيتم استيراده؟' : 'What gets imported?'}
            </p>
            <ul className="list-disc list-inside space-y-0.5 text-slate-500 dark:text-slate-400">
              <li>{isRtl ? 'جميع الروابط وعناوينها ونصوصها الفرعية' : 'All link titles, destinations, and subtitles'}</li>
              <li>{isRtl ? 'الملف الشخصي والنبذة التعريفية' : 'Profile display name and biography'}</li>
              <li>{isRtl ? 'الحفاظ على ترتيب الروابط في رالوا' : 'Preserves current block sequence'}</li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {isRtl ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handleSimulatedImport(inputUrl)}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {isProcessing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{isRtl ? 'جارِ الاستيراد...' : 'Importing...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isRtl ? 'بدء الاستيراد' : 'Import Links'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
