import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CreatorPage } from '@/components/public/CreatorPage';
import { loadPublicSiteByHandle } from '@/server/public-sites';
import { getRequestHost, publicOrigin } from '@/server/public-request';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ handle: string }> };

async function siteFor({ params }: Props) {
  const { handle } = await params;
  const site = await loadPublicSiteByHandle(handle);
  if (!site) notFound();
  return site;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await siteFor({ params });
  const origin = publicOrigin(await getRequestHost());
  const title = site.metaTitle || `${site.displayName} (@${site.handle})`;
  const description = site.metaDescription || site.bio || `Discover ${site.displayName}'s work and links.`;
  const canonical = `${origin}/@${site.handle}`;
  const image = site.avatar || site.coverImage;
  return { metadataBase: new URL(origin), title, description, alternates: { canonical }, robots: { index: true, follow: true }, openGraph: { type: 'profile', title, description, url: canonical, siteName: 'Raloa', locale: site.locale === 'ar' ? 'ar_SA' : 'en_US', images: image ? [{ url: image, alt: site.displayName }] : undefined }, twitter: { card: 'summary_large_image', title, description, images: image ? [image] : undefined } };
}

export default async function PublicCreatorPage({ params }: Props) {
  const site = await siteFor({ params });
  return <CreatorPage site={site} origin={publicOrigin(await getRequestHost())} />;
}
