import { notFound } from 'next/navigation';

export default async function PublicCreatorPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const normalizedHandle = handle.replace(/^@/, '').trim();
  if (!normalizedHandle) notFound();

  return (
    <main className="raloa-main">
      <article className="raloa-prose" aria-labelledby="creator-title">
        <p className="raloa-status">Public creator page · @{normalizedHandle}</p>
        <h1 id="creator-title">Your public page is ready for its content source.</h1>
        <p>This App Router boundary is intentionally read-only until the existing public renderer is promoted.</p>
      </article>
    </main>
  );
}
