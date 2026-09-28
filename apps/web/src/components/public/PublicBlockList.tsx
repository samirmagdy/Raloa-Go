import Image from 'next/image';
import { normalizeBlocks, type NormalizedBlock } from '@raloa/blocks';
import type { PublicSiteSnapshot } from '@raloa/schemas';

function text(props: Record<string, unknown>, key: string, rtl: boolean) {
  const value = props[rtl ? `${key}Ar` : key] ?? props[key];
  return typeof value === 'string' ? value : '';
}

function safeHref(value: unknown) {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol) ? value : null; } catch { return /^#[a-zA-Z0-9_-]+$/.test(value) ? value : null; }
}

function embedUrl(type: 'video' | 'music', value: string) {
  try {
    const url = new URL(value);
    if (type === 'video') {
      if (url.hostname === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(url.pathname.slice(1))}`;
      if (url.hostname === 'youtube.com' || url.hostname.endsWith('.youtube.com')) { const id = url.searchParams.get('v') || url.pathname.match(/\/embed\/([^/]+)/)?.[1]; return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null; }
      if (url.hostname === 'vimeo.com' || url.hostname.endsWith('.vimeo.com')) { const id = url.pathname.match(/\/(\d+)/)?.[1]; return id ? `https://player.vimeo.com/video/${id}` : null; }
    } else if (url.hostname === 'open.spotify.com') { const match = url.pathname.match(/^\/(track|album|playlist|episode|show)\/([^/]+)/); return match ? `https://open.spotify.com/embed/${match[1]}/${encodeURIComponent(match[2])}` : null; }
  } catch { return null; }
  return null;
}

function Block({ block, rtl }: { block: NormalizedBlock; rtl: boolean }) {
  const props = block.props;
  const title = text(props, 'title', rtl) || 'Open';
  const subtitle = text(props, 'subtitle', rtl);
  const href = safeHref(props.url);
  const analytics = { 'data-block-id': block.id, 'data-block-type': block.type, 'data-analytics-impression': 'block_impression' };
  if (!block.visible) return null;
  if (block.type === 'header') return <div className="public-block-header" {...analytics}><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>;
  if (block.type === 'gallery') return <div className="public-block-gallery" {...analytics} aria-label={title}>{(props.galleryItems as Array<Record<string, unknown>>).map((item, index) => { const src = typeof item.src === 'string' ? item.src : ''; if (!/^https?:\/\//i.test(src)) return null; return <figure key={String(item.id ?? index)}><Image src={src} alt={typeof item.alt === 'string' ? item.alt : title} width={900} height={620} sizes="(max-width: 760px) 92vw, 760px" /><figcaption>{typeof item.caption === 'string' ? item.caption : ''}</figcaption></figure>; })}</div>;
  if ((block.type === 'video' || block.type === 'music') && href) { const source = embedUrl(block.type, href); return source ? <div className="public-block-embed" {...analytics}><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}<iframe title={title} src={source} loading="lazy" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen={block.type === 'video'} /><a href={href} target="_blank" rel="noreferrer">Open source</a></div> : null; }
  const action = block.type === 'contact' ? 'Contact' : block.type === 'newsletter' ? 'Join the newsletter' : block.type === 'booking' ? title : block.type === 'shop' ? title : title;
  if (!href && ['contact', 'newsletter'].includes(block.type)) return <div className="public-block-link" role="group" {...analytics}><span><strong>{action}</strong>{subtitle && <small>{subtitle}</small>}</span></div>;
  return href ? <a className="public-block-link" href={href} target="_blank" rel="noreferrer" {...analytics}><span><strong>{action}</strong>{subtitle && <small>{subtitle}</small>}</span><span aria-hidden="true">↗</span></a> : null;
}

export function PublicBlockList({ site, rtl }: { site: PublicSiteSnapshot; rtl: boolean }) {
  const normalized = normalizeBlocks(site.blocks);
  return <section className="public-block-list" aria-label="Published blocks">{normalized.blocks.map((block) => <Block key={block.id} block={block} rtl={rtl} />)}</section>;
}
