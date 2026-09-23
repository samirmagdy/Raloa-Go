import React from 'react';
import { ExternalLink, Globe } from 'lucide-react';
import { PremiumMark } from './brand/PremiumMark';
import { Locale, TemplateItem } from '../types';

interface TemplateSnapshotPopoverProps {
  template: TemplateItem | null;
  anchorRect: DOMRect | null;
  locale: Locale;
  visible: boolean;
}

export const TemplateSnapshotPopover: React.FC<TemplateSnapshotPopoverProps> = ({
  template,
  anchorRect,
  locale,
  visible
}) => {
  if (!template || !anchorRect || !visible) return null;

  const isRtl = locale === 'ar';
  const handle = template.name.toLowerCase().replace(/\s+/g, '');
  const popoverWidth = 240;
  const popoverHeight = 350;

  // Calculate position avoiding screen edge clipping
  let left = anchorRect.left + anchorRect.width / 2 - popoverWidth / 2;
  // Bound to viewport horizontal margins
  if (typeof window !== 'undefined') {
    left = Math.max(16, Math.min(window.innerWidth - popoverWidth - 16, left));
  }

  // Determine whether to place above or below card
  const spaceAbove = anchorRect.top;
  const placeAbove = spaceAbove >= popoverHeight + 90;
  const top = placeAbove
    ? anchorRect.top - popoverHeight - 12
    : anchorRect.bottom + 12;

  return (
    <div
      style={{
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${popoverWidth}px`,
        zIndex: 50
      }}
      className="pointer-events-none transition-all duration-200 ease-out animate-in fade-in zoom-in-95"
      role="tooltip"
      aria-hidden="true"
    >
      {/* Miniature Phone Frame */}
      <div className="relative rounded-[26px] bg-slate-950 text-white p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.1)] border border-slate-700/80 backdrop-blur-xl">
        
        {/* Device Notch & URL header */}
        <div className="flex items-center justify-between px-2 pt-1 pb-2 border-b border-slate-800/80 mb-2">
          <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-mono truncate">
            <Globe className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
            <span className="truncate">raloa.app/@{handle}</span>
          </div>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>

        {/* Miniature Mock Site Canvas */}
        <div className="rounded-[18px] bg-slate-900 border border-slate-800 overflow-hidden text-center pb-3">
          
          {/* Header Banner */}
          <div className="relative h-14 w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 overflow-hidden">
            <img
              src={template.coverImage || template.avatar}
              alt=""
              className="w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
          </div>

          {/* Centered Avatar */}
          <div className="relative -mt-6 mx-auto w-11 h-11 rounded-full border-2 border-slate-900 overflow-hidden shadow-md bg-slate-800">
            <img
              src={template.avatar}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>

          {/* Title & Role */}
          <div className="px-2 mt-1">
            <div className="flex items-center justify-center gap-1">
              <span className="text-[11px] font-bold text-white truncate max-w-[150px]">
                {template.name}
              </span>
              <span className="w-1 h-1 rounded-full bg-indigo-400" />
            </div>
            <span className="text-[9px] font-medium text-slate-400 block truncate">
              {template.role}
            </span>
          </div>

          {/* Mini Links / Sections Layout */}
          <div className="px-3 mt-2.5 space-y-1.5">
            {template.sampleLinks.slice(0, 3).map((link, idx) => (
              <div
                key={link.id || idx}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 shadow-2xs text-left rtl:text-right"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: template.themeColor || '#6366f1' }}
                  />
                  <span className="text-[9px] font-medium text-slate-200 truncate">
                    {isRtl ? (link.titleAr || link.title) : link.title}
                  </span>
                </div>
                <ExternalLink className="w-2.5 h-2.5 text-slate-500 shrink-0 rtl:rotate-180" />
              </div>
            ))}
          </div>

          {/* Mini Social Icons Row */}
          <div className="flex items-center justify-center gap-1.5 mt-2.5 pt-2 border-t border-slate-800/60 text-slate-400">
            <span className="w-3.5 h-3.5 rounded-full bg-slate-800 flex items-center justify-center text-[7px]">ig</span>
            <span className="w-3.5 h-3.5 rounded-full bg-slate-800 flex items-center justify-center text-[7px]">x</span>
            <span className="w-3.5 h-3.5 rounded-full bg-slate-800 flex items-center justify-center text-[7px]">yt</span>
          </div>
        </div>

        {/* Footer Snapshot Badge */}
        <div className="mt-2 flex items-center justify-between px-1 text-[9px] text-slate-400">
          <span className="flex items-center gap-1 font-medium text-indigo-300">
            <PremiumMark className="w-2.5 h-2.5 text-indigo-400" />
            <span>{isRtl ? 'معاينة مصغرة' : 'Site Snapshot'}</span>
          </span>
          <span className="text-slate-500 text-[8.5px]">
            {isRtl ? 'انقر للفتح الكامل' : 'Click to preview'}
          </span>
        </div>

      </div>
    </div>
  );
};
