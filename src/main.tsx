import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initPerformanceTracking } from './utils/performance.ts';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

// Initialize performance tracking for Web Vitals (FCP, LCP)
initPerformanceTracking();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

