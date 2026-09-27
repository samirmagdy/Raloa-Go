import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import { initPerformanceTracking } from './utils/performance.ts';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

// Initialize performance tracking for Web Vitals (FCP, LCP)
initPerformanceTracking();

const path = window.location.pathname;
const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
const isPublicProfile = /^\/(?:@|public-render\/)[a-zA-Z0-9._-]+$/.test(path)
  || (!isLocalHost && window.location.hostname !== 'raloa.app' && window.location.hostname !== 'www.raloa.app' && !window.location.hostname.endsWith('.raloa.app') && path === '/');

const appImport = isPublicProfile ? import('./PublicPageApp.tsx') : import('./App.tsx');
if (!isPublicProfile) void import('./observability/sentry.ts').then(({ initializeFrontendSentry }) => initializeFrontendSentry());
appImport.then(({ default: App }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
});
