import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="raloa-main"><section className="raloa-card" style={{ maxWidth: '32rem', margin: 'clamp(3rem, 12vh, 8rem) auto', padding: 'clamp(1.5rem, 5vw, 3rem)' }}>{children}</section></main>;
}
