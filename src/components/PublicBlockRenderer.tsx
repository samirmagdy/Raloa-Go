import React, { useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Calendar, Mail, MessageSquare, Music2, Play, ShoppingBag } from 'lucide-react';
import type { MediaGalleryItem, TemplateItem, TemplateThemeConfig, DesignTokens } from '../shared/rendering';
import { designCardStyle, designTypographyStyle } from '../shared/rendering';
import { MediaGallery } from './MediaGallery';
import { SafeImage } from './SafeImage';
import { normalizeBlock } from '@raloa/blocks';

type PublicBlock = TemplateItem['sampleLinks'][number];

interface PublicBlockRendererProps {
  block: PublicBlock;
  isRtl: boolean;
  themeConfig: TemplateThemeConfig;
  designTokens: DesignTokens;
  onActivate: (block: PublicBlock) => void;
  onAudience: (kind: 'contact' | 'newsletter') => void;
}

function videoEmbedUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.hostname === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(url.pathname.slice(1))}`;
    if (url.hostname.endsWith('youtube.com')) {
      const id = url.searchParams.get('v') || url.pathname.match(/\/embed\/([^/]+)/)?.[1];
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
    }
    if (url.hostname === 'vimeo.com' || url.hostname.endsWith('.vimeo.com')) {
      const id = url.pathname.match(/\/(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch (_) {
    return null;
  }
  return null;
}

function musicEmbedUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.hostname === 'open.spotify.com') {
      const match = url.pathname.match(/^\/(track|album|playlist|episode|show)\/([^/]+)/);
      return match ? `https://open.spotify.com/embed/${match[1]}/${encodeURIComponent(match[2])}` : null;
    }
    if (url.hostname === 'soundcloud.com' || url.hostname === 'www.soundcloud.com') {
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.toString())}&color=%234f46e5&auto_play=false&hide_related=true`;
    }
  } catch (_) {
    return null;
  }
  return null;
}

const MissingBlock: React.FC<{ label: string; isRtl: boolean }> = ({ label, isRtl }) => (
  <div role="status" className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
    <span>{isRtl ? `هذا المحتوى غير متاح حالياً: ${label}` : `${label} is unavailable right now.`}</span>
  </div>
);

export const PublicBlockRenderer: React.FC<PublicBlockRendererProps> = ({
  block: rawBlock,
  isRtl,
  themeConfig,
  designTokens,
  onActivate,
  onAudience
}) => {
  const [mediaError, setMediaError] = useState(false);
  const normalized = normalizeBlock(rawBlock);
  if (!normalized.block) return <MissingBlock label={isRtl ? 'نوع كتلة غير مدعوم' : 'Unsupported block type'} isRtl={isRtl} />;
  const block = { ...rawBlock, ...normalized.block.props, type: normalized.block.type } as PublicBlock;
  const title = isRtl ? block.titleAr : block.title;
  const subtitle = isRtl ? block.subtitleAr : block.subtitle;
  const cardStyle = {
    ...designCardStyle(designTokens, themeConfig.mode === 'dark', designTokens.accentColor),
    color: themeConfig.cardText
  };

  if (block.type === 'header') {
    return (
      <div className="w-full border-b border-current/20 pb-2 pt-3 text-left rtl:text-right" role="heading" aria-level={2}>
        <h2 className="font-extrabold" style={{ ...designTypographyStyle(designTokens, 'heading'), color: themeConfig.textColor }}>{title}</h2>
        {subtitle && <p className="mt-1 text-xs opacity-70" style={{ color: themeConfig.bioColor }}>{subtitle}</p>}
      </div>
    );
  }

  if (block.type === 'gallery') {
    if (!block.galleryItems?.length) return <MissingBlock label={isRtl ? 'المعرض' : 'Gallery'} isRtl={isRtl} />;
    return (
      <div className="w-full" onClick={() => onActivate(block)}>
        <MediaGallery items={block.galleryItems as MediaGalleryItem[]} title={title} isRtl={isRtl} />
      </div>
    );
  }

  if (block.type === 'video' || block.type === 'music') {
    const embedUrl = block.type === 'video' ? videoEmbedUrl(block.url) : musicEmbedUrl(block.url);
    if (!embedUrl || mediaError) return <MissingBlock label={block.type === 'video' ? (isRtl ? 'الفيديو' : 'Video') : (isRtl ? 'الموسيقى' : 'Music')} isRtl={isRtl} />;
    return (
      <article className="w-full overflow-hidden" style={cardStyle}>
        <div className="flex items-center gap-2 px-4 pt-4" style={{ color: designTokens.accentColor }}>
          {block.type === 'video' ? <Play className="h-4 w-4" aria-hidden="true" /> : <Music2 className="h-4 w-4" aria-hidden="true" />}
          <h2 className="font-bold" style={designTypographyStyle(designTokens, 'body')}>{title}</h2>
        </div>
        {subtitle && <p className="px-4 pt-1 text-xs opacity-75">{subtitle}</p>}
        <iframe
          title={title}
          src={embedUrl}
          className="mt-3 aspect-video w-full border-0"
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen={block.type === 'video'}
          onError={() => setMediaError(true)}
        />
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onActivate(block)}
          className="m-3 inline-flex items-center justify-center rounded-xl border border-current/20 px-3 py-2 text-xs font-bold transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        >
          {isRtl ? 'فتح المصدر' : 'Open source'}
        </a>
      </article>
    );
  }

  if (block.type === 'contact' || block.type === 'newsletter') {
    const isContact = block.type === 'contact';
    return (
      <button
        type="button"
        onClick={() => { onActivate(block); onAudience(block.type as 'contact' | 'newsletter'); }}
        className="group flex w-full items-center gap-3.5 p-3.5 text-left transition-transform hover:scale-[1.01] active:scale-[0.99] rtl:text-right"
        style={cardStyle}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/5 dark:bg-white/10" style={{ color: designTokens.accentColor }}>
          {isContact ? <MessageSquare className="h-5 w-5" aria-hidden="true" /> : <Mail className="h-5 w-5" aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold" style={designTypographyStyle(designTokens, 'body')}>{title}</span>
          {subtitle && <span className="mt-0.5 block truncate text-xs opacity-75">{subtitle}</span>}
        </span>
        {isRtl ? <ArrowLeft className="h-4 w-4 opacity-60" aria-hidden="true" /> : <ArrowRight className="h-4 w-4 opacity-60" aria-hidden="true" />}
      </button>
    );
  }

  if (block.type === 'booking' || block.type === 'shop') {
    const isShop = block.type === 'shop';
    return (
      <button type="button" onClick={() => onActivate(block)} className="group flex w-full items-center gap-3.5 p-3.5 text-left transition-transform hover:scale-[1.01] active:scale-[0.99] rtl:text-right" style={cardStyle}>
        {block.thumbnail ? <SafeImage src={block.thumbnail} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/5 dark:bg-white/10" style={{ color: designTokens.accentColor }}>{isShop ? <ShoppingBag className="h-5 w-5" aria-hidden="true" /> : <Calendar className="h-5 w-5" aria-hidden="true" />}</span>}
        <span className="min-w-0 flex-1"><span className="block font-bold" style={designTypographyStyle(designTokens, 'body')}>{title}</span>{subtitle && <span className="mt-0.5 block truncate text-xs opacity-75">{subtitle}</span>}</span>
        {isRtl ? <ArrowLeft className="h-4 w-4 opacity-60" aria-hidden="true" /> : <ArrowRight className="h-4 w-4 opacity-60" aria-hidden="true" />}
      </button>
    );
  }

  if (block.type === 'link' || !block.type) {
    return (
      <button type="button" onClick={() => onActivate(block)} className="group flex w-full items-center gap-3.5 p-3.5 text-left transition-transform hover:scale-[1.01] active:scale-[0.99] rtl:text-right" style={cardStyle}>
        {block.thumbnail && <SafeImage src={block.thumbnail} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />}
        <span className="min-w-0 flex-1"><span className="block truncate font-bold" style={designTypographyStyle(designTokens, 'body')}>{title}</span>{subtitle && <span className="mt-0.5 block truncate text-xs opacity-75">{subtitle}</span>}</span>
        {isRtl ? <ArrowLeft className="h-4 w-4 opacity-60" aria-hidden="true" /> : <ArrowRight className="h-4 w-4 opacity-60" aria-hidden="true" />}
      </button>
    );
  }

  return <MissingBlock label={title || (isRtl ? 'نوع كتلة غير مدعوم' : 'Unsupported block type')} isRtl={isRtl} />;
};
