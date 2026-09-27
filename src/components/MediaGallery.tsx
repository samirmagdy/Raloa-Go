import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X, ImageOff, Play } from 'lucide-react';
import { MediaGalleryItem } from '../types';

interface MediaGalleryProps {
  items: MediaGalleryItem[];
  title?: string;
  isRtl?: boolean;
  compact?: boolean;
}

export function optimizedMediaUrl(value: string, width: number): string {
  try {
    const url = new URL(value);
    if (url.hostname.includes('unsplash.com')) {
      url.searchParams.set('auto', 'format');
      url.searchParams.set('fit', 'max');
      url.searchParams.set('w', String(width));
      url.searchParams.set('q', width > 900 ? '85' : '75');
      return url.toString();
    }
  } catch {
    // The API validates persisted URLs; keep malformed values renderable for a graceful failure state.
  }
  return value;
}

const getMediaType = (item: MediaGalleryItem): 'image' | 'video' => item.type === 'video' ? 'video' : 'image';

export const MediaGallery: React.FC<MediaGalleryProps> = ({ items, title, isRtl = false, compact = false }) => {
  const validItems = items.filter((item) => item && typeof item.src === 'string' && item.src.trim());
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [failedItems, setFailedItems] = useState<Set<string>>(new Set());
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (activeIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveIndex(null);
      if (event.key === 'ArrowRight') setActiveIndex((index) => index === null ? null : (index + 1) % validItems.length);
      if (event.key === 'ArrowLeft') setActiveIndex((index) => index === null ? null : (index - 1 + validItems.length) % validItems.length);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeIndex, validItems.length]);

  if (validItems.length === 0) return null;
  const activeItem = activeIndex === null ? null : validItems[activeIndex];
  const markFailed = (id: string) => setFailedItems((current) => new Set(current).add(id));
  const move = (direction: 1 | -1) => setActiveIndex((index) => index === null ? null : (index + direction + validItems.length) % validItems.length);
  const unavailableLabel = isRtl ? 'تعذر تحميل الوسائط' : 'Media unavailable';

  return <section className="w-full" aria-label={title || (isRtl ? 'معرض الوسائط' : 'Media gallery')}>
    {title && <h3 className="mb-3 text-sm font-bold">{title}</h3>}
    <div className={`grid ${compact ? 'grid-cols-2 gap-2' : 'grid-cols-2 sm:grid-cols-3 gap-3'}`}>
      {validItems.map((item, index) => {
        const failed = failedItems.has(item.id);
        return <button key={item.id} type="button" onClick={() => setActiveIndex(index)} className="group relative aspect-square overflow-hidden rounded-2xl border border-white/20 bg-slate-100 text-left shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" aria-label={item.caption || item.alt || `${title || 'Gallery'} item ${index + 1}`}>
          {failed ? <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-400"><ImageOff className="h-6 w-6" /><span className="px-2 text-center text-[10px]">{unavailableLabel}</span></span> : getMediaType(item) === 'video' ? <><video src={item.src} poster={item.thumbnail ? optimizedMediaUrl(item.thumbnail, 600) : undefined} preload="metadata" muted className="h-full w-full object-cover" onError={() => markFailed(item.id)} /><span className="absolute inset-0 flex items-center justify-center"><span className="rounded-full bg-black/60 p-2 text-white"><Play className="h-4 w-4 fill-current" /></span></span></> : <img src={optimizedMediaUrl(item.thumbnail || item.src, 600)} alt={item.alt || item.caption || ''} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" onError={() => markFailed(item.id)} />}
          {item.caption && <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/75 to-transparent px-2 pb-2 pt-5 text-[10px] font-semibold text-white">{item.caption}</span>}
        </button>;
      })}
    </div>

    {activeItem && activeIndex !== null && <div role="dialog" aria-modal="true" aria-label={activeItem.caption || title || 'Media viewer'} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm" onClick={() => setActiveIndex(null)} onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { const start = touchStartX.current; const end = event.changedTouches[0]?.clientX; touchStartX.current = null; if (start !== null && end !== undefined && Math.abs(end - start) > 48) move(end < start ? 1 : -1); }}>
      <button ref={closeButtonRef} type="button" onClick={() => setActiveIndex(null)} className="absolute right-4 top-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label={isRtl ? 'إغلاق المعرض' : 'Close gallery'}><X className="h-5 w-5" /></button>
      <button type="button" onClick={(event) => { event.stopPropagation(); move(-1); }} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label={isRtl ? 'الوسائط السابقة' : 'Previous media'}><ChevronLeft className="h-6 w-6" /></button>
      <button type="button" onClick={(event) => { event.stopPropagation(); move(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label={isRtl ? 'الوسائط التالية' : 'Next media'}><ChevronRight className="h-6 w-6" /></button>
      <div className="flex max-h-[90dvh] max-w-5xl flex-col items-center gap-3" onClick={(event) => event.stopPropagation()}>
        {failedItems.has(activeItem.id) ? <div className="flex min-h-48 min-w-64 flex-col items-center justify-center gap-2 rounded-2xl bg-white/10 px-8 text-center text-sm text-white"><ImageOff className="h-8 w-8" />{isRtl ? 'تعذر تحميل هذه الوسائط.' : 'This media could not be loaded.'}</div> : getMediaType(activeItem) === 'video' ? <video src={activeItem.src} poster={activeItem.thumbnail ? optimizedMediaUrl(activeItem.thumbnail, 1400) : undefined} controls autoPlay className="max-h-[78dvh] max-w-full rounded-xl" onError={() => markFailed(activeItem.id)} /> : <img src={optimizedMediaUrl(activeItem.src, 1800)} alt={activeItem.alt || activeItem.caption || ''} className="max-h-[78dvh] max-w-full rounded-xl object-contain" onError={() => markFailed(activeItem.id)} />}
        <div className="max-w-2xl text-center text-sm text-white">{activeItem.caption || activeItem.alt}</div>
        <span className="text-xs text-white/60">{activeIndex + 1} / {validItems.length}</span>
      </div>
    </div>}
  </section>;
};
