import type { ReactNode } from 'react';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <div className="raloa-shell"><header className="raloa-header"><nav className="raloa-nav"><a className="raloa-brand" href="/">raloa</a><span className="raloa-status">Public</span></nav></header>{children}</div>;
}
