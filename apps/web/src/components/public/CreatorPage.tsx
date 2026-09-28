import Image from 'next/image';
import type { CSSProperties } from 'react';
import type { PublicSiteSnapshot } from '@raloa/schemas';
import { PublicBlockList } from './PublicBlockList';

export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => ({ '<': '\\u003c', '>': '\\u003e', '&': '\\u0026', '\u2028': '\\u2028', '\u2029': '\\u2029' }[character] || character));
}

function token(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function label(item: Record<string, unknown>, fallback: string) {
  return String(item.title ?? item.label ?? item.name ?? fallback);
}

function href(item: Record<string, unknown>) {
  const value = item.url ?? item.href ?? item.link;
  return typeof value === 'string' && /^https?:\/\//i.test(value) ? value : null;
}

function RemoteImage({ src, alt, className, priority = false }: { src: string; alt: string; className?: string; priority?: boolean }) {
  if (!/^https?:\/\//i.test(src)) return null;
  return <Image src={src} alt={alt} fill priority={priority} sizes="(max-width: 760px) 92vw, 760px" className={className} />;
}

export function CreatorPage({ site, origin }: { site: PublicSiteSnapshot; origin: string }) {
  const direction = site.locale === 'ar' ? 'rtl' : 'ltr';
  const colors = site.designTokens;
  const socials = site.socials.map((item, index) => ({ item, url: href(item), key: `${label(item, 'Social')}-${index}` })).filter((item) => item.url);
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'ProfilePage', name: site.displayName,
    url: `${origin}/@${site.handle}`, description: site.metaDescription || site.bio || undefined,
    image: site.avatar || undefined, mainEntity: { '@type': 'Person', name: site.displayName, jobTitle: site.role || undefined, sameAs: socials.map((item) => item.url), image: site.avatar || undefined },
  };
  return (
    <main className="public-page" dir={direction} style={{ '--public-accent': token(colors.accentColor, '#5541f5'), '--public-background': token(colors.backgroundColor, '#f6f5f1'), '--public-ink': token(colors.textColor, '#101828') } as CSSProperties}>
      <a className="public-skip-link" href="#creator-content">Skip to content</a>
      <article className="public-stage" id="creator-content">
        <div className="public-cover" aria-hidden={!site.coverImage}>
          <RemoteImage src={site.coverImage} alt="" className="public-cover-image" priority />
        </div>
        <section className="public-profile" aria-labelledby="creator-name">
          <div className="public-avatar-wrap">{site.avatar ? <RemoteImage src={site.avatar} alt={`${site.displayName} profile`} className="public-avatar" priority /> : <span aria-hidden="true">{site.displayName.slice(0, 1)}</span>}</div>
          <p className="public-eyebrow">{site.role || 'Creator'}</p>
          <h1 id="creator-name">{site.displayName}</h1>
          {site.bio && <p className="public-bio">{direction === 'rtl' && site.bioAr ? site.bioAr : site.bio}</p>}
          {socials.length > 0 && <nav aria-label="Social links" className="public-socials">{socials.map(({ item, url, key }) => <a key={key} href={url!} target="_blank" rel="noreferrer" aria-label={label(item, 'Social link')}>{label(item, 'Visit')}</a>)}</nav>}
        </section>
        <PublicBlockList site={site} rtl={direction === 'rtl'} />
        <footer className="public-footer"><a href={origin}>raloa</a><span>Published profile</span></footer>
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
    </main>
  );
}
