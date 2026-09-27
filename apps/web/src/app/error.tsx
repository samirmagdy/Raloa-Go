'use client';

import { useEffect } from 'react';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { /* Sentry wiring is injected at the app composition boundary. */ }, []);
  return (
    <main className="raloa-main" role="alert">
      <section className="raloa-card raloa-prose" style={{ padding: '2rem', marginBlock: '4rem' }}>
        <p className="raloa-status">Something needs another try.</p>
        <h1>We couldn’t load this page.</h1>
        <div className="raloa-actions"><button className="raloa-button" onClick={reset}>Try again</button></div>
      </section>
    </main>
  );
}
