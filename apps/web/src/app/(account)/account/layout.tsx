import type { ReactNode } from 'react';

export default function AccountLayout({ children }: { children: ReactNode }) {
  return <div className="raloa-shell"><main className="raloa-main">{children}</main></div>;
}
