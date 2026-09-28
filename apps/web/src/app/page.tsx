import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CreatorPage } from '@/components/public/CreatorPage';
import { loadPublicSiteByHostname } from '@/server/public-sites';
import { getRequestHost, isCustomPublicHost, publicOrigin } from '@/server/public-request';

export const dynamic = 'force-dynamic';

export default async function WebHomePage() {
  const host = await getRequestHost();
  if (isCustomPublicHost(host)) {
    const site = await loadPublicSiteByHostname(host);
    if (!site) notFound();
    return <CreatorPage site={site} origin={publicOrigin(host)} />;
  }
  return (
    <div className="raloa-shell">
      <header className="raloa-header">
        <nav className="raloa-nav" aria-label="Primary navigation">
          <Link className="raloa-brand" href="/">raloa</Link>
          <div className="raloa-nav-links">
            <Link href="/auth/login">Sign in</Link>
            <Link className="raloa-button" href="/auth/register">Create your page</Link>
          </div>
        </nav>
      </header>
      <main className="raloa-main">
        <section className="raloa-prose" aria-labelledby="home-title">
          <p className="raloa-status">The public web foundation</p>
          <h1 id="home-title">Make your work easy to find.</h1>
          <p>Raloa gives creators one calm, expressive place for their profile, work, links, and next conversation.</p>
          <div className="raloa-actions">
            <Link className="raloa-button" href="/auth/register">Start building</Link>
            <Link className="raloa-button" data-variant="quiet" href="/studio">Open Studio</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
