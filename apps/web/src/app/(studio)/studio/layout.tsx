import type { ReactNode } from 'react';

export default function StudioLayout({ children }: { children: ReactNode }) {
  return <div className="raloa-shell"><header className="raloa-header"><nav className="raloa-nav"><a className="raloa-brand" href="/">raloa</a><span className="raloa-status">Studio boundary</span></nav></header>{children}</div>;
}
