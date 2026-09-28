import type { ReactNode } from 'react';
import { webConfig } from '../env';
import './globals.css';
import '../../../../src/index.css';

export const metadata = {
  title: { default: 'Raloa', template: '%s · Raloa' },
  description: 'A focused home for your work, links, and audience.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={webConfig.defaultLocale} dir={webConfig.defaultLocale === 'ar' ? 'rtl' : 'ltr'}>
      <body>{children}</body>
    </html>
  );
}
