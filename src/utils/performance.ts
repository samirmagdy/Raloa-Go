/**
 * RALOA Web Vitals & Performance Tracking Utility
 *
 * Captures Core Web Vitals:
 * - First Contentful Paint (FCP)
 * - Largest Contentful Paint (LCP)
 *
 * Logs metric benchmarks to the console in development,
 * and reports them via Beacon API or keepalive fetch in production.
 */

export type MetricRating = 'good' | 'needs-improvement' | 'poor';

export interface PerformanceMetric {
  name: 'FCP' | 'LCP';
  value: number; // in milliseconds
  rating: MetricRating;
  timestamp: number;
  elementSelector?: string;
  navigationType?: string;
}

export interface PerformanceTrackerConfig {
  /**
   * Whether to log metrics to the browser console.
   * Defaults to true in development or when `?perf=true` query parameter is present.
   */
  enableConsoleLogging?: boolean;

  /**
   * Analytics endpoint URL to receive performance metrics in production.
   * Defaults to import.meta.env.VITE_ANALYTICS_ENDPOINT.
   */
  analyticsEndpoint?: string;

  /**
   * Callback fired whenever a metric is captured and rated.
   */
  onMetric?: (metric: PerformanceMetric) => void;

  /**
   * Whether to send payloads to the analytics endpoint.
   * Defaults to true in production if an endpoint is provided.
   */
  enableReporting?: boolean;
}

// Global state holding captured metrics
const metricsStore: {
  fcp: PerformanceMetric | null;
  lcp: PerformanceMetric | null;
} = {
  fcp: null,
  lcp: null,
};

let isInitialized = false;
let activeConfig: PerformanceTrackerConfig = {};

/**
 * Determine Google Core Web Vitals rating for First Contentful Paint (FCP)
 * Good: <= 1.8s, Needs Improvement: <= 3.0s, Poor: > 3.0s
 */
export function getFcpRating(durationMs: number): MetricRating {
  if (durationMs <= 1800) return 'good';
  if (durationMs <= 3000) return 'needs-improvement';
  return 'poor';
}

/**
 * Determine Google Core Web Vitals rating for Largest Contentful Paint (LCP)
 * Good: <= 2.5s, Needs Improvement: <= 4.0s, Poor: > 4.0s
 */
export function getLcpRating(durationMs: number): MetricRating {
  if (durationMs <= 2500) return 'good';
  if (durationMs <= 4000) return 'needs-improvement';
  return 'poor';
}

/**
 * Generate a friendly CSS selector for the LCP target element
 */
function getElementSelector(element: Element | null): string | undefined {
  if (!element) return undefined;
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const className = element.className && typeof element.className === 'string'
    ? `.${element.className.trim().split(/\s+/).slice(0, 2).join('.')}`
    : '';
  return `${tag}${id}${className}`;
}

/**
 * Formats and logs the metric to the browser console with distinct status colors
 */
function logMetricToConsole(metric: PerformanceMetric): void {
  const ratingColors: Record<MetricRating, { badge: string; text: string }> = {
    'good': {
      badge: 'background: #059669; color: #ffffff; font-weight: bold; border-radius: 4px; padding: 2px 6px;',
      text: 'color: #059669; font-weight: bold;'
    },
    'needs-improvement': {
      badge: 'background: #d97706; color: #ffffff; font-weight: bold; border-radius: 4px; padding: 2px 6px;',
      text: 'color: #d97706; font-weight: bold;'
    },
    'poor': {
      badge: 'background: #dc2626; color: #ffffff; font-weight: bold; border-radius: 4px; padding: 2px 6px;',
      text: 'color: #dc2626; font-weight: bold;'
    }
  };

  const style = ratingColors[metric.rating];
  const prefixStyle = 'background: #4f46e5; color: #ffffff; font-weight: bold; border-radius: 4px; padding: 2px 6px; margin-right: 4px;';
  const labelStyle = 'font-weight: bold; color: #1e293b;';

  /* eslint-disable no-console */
  console.groupCollapsed?.(
    `%cRALOA Perf%c %c${metric.name}%c ${metric.value.toFixed(1)}ms (%c${metric.rating}%c)`,
    prefixStyle,
    '',
    style.badge,
    labelStyle,
    style.text,
    labelStyle
  );

  console.log(`Metric: ${metric.name}`);
  console.log(`Value: ${metric.value.toFixed(2)} ms (${(metric.value / 1000).toFixed(2)} s)`);
  console.log(`Rating: ${metric.rating}`);
  if (metric.elementSelector) {
    console.log(`Target Element: ${metric.elementSelector}`);
  }
  console.log(`Timestamp: ${new Date(metric.timestamp).toISOString()}`);
  console.groupEnd?.();
  /* eslint-enable no-console */
}

/**
 * Send performance metric payload to analytics endpoint in production
 */
export async function sendMetricToEndpoint(
  metric: PerformanceMetric,
  endpointUrl: string
): Promise<boolean> {
  if (!endpointUrl || typeof window === 'undefined') return false;

  const payload = {
    metric: metric.name,
    value: metric.value,
    rating: metric.rating,
    element: metric.elementSelector,
    timestamp: metric.timestamp,
    url: window.location.href,
    pathname: window.location.pathname,
    navigationType: metric.navigationType,
    connection: (navigator as unknown as { connection?: { effectiveType?: string; downlink?: number; rtt?: number } })?.connection
      ? {
          effectiveType: (navigator as unknown as { connection?: { effectiveType?: string } }).connection?.effectiveType,
        }
      : undefined
  };

  try {
    const jsonString = JSON.stringify(payload);

    // Prefer navigator.sendBeacon for non-blocking telemetry transmission
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const queued = navigator.sendBeacon(endpointUrl, blob);
      if (queued) return true;
    }

    // Fallback to fetch with keepalive
    await fetch(endpointUrl, {
      method: 'POST',
      body: jsonString,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true
    });
    return true;
  } catch (err) {
    // Fail silently in telemetry to never impact UX
    if (import.meta.env.DEV) {
      console.warn('[RALOA Perf] Failed to send metric to endpoint:', err);
    }
    return false;
  }
}

/**
 * Internal handler for newly computed metrics
 */
function handleMetricCaptured(metric: PerformanceMetric): void {
  if (metric.name === 'FCP') {
    metricsStore.fcp = metric;
  } else if (metric.name === 'LCP') {
    metricsStore.lcp = metric;
  }

  // Invoke custom subscriber callback
  if (activeConfig.onMetric) {
    try {
      activeConfig.onMetric(metric);
    } catch (err) {
      console.error('[RALOA Perf] Error in onMetric callback:', err);
    }
  }

  // Determine whether to log to console
  const shouldLog = activeConfig.enableConsoleLogging !== undefined
    ? activeConfig.enableConsoleLogging
    : (import.meta.env.DEV || (typeof window !== 'undefined' && window.location.search.includes('perf=true')));

  if (shouldLog) {
    logMetricToConsole(metric);
  }

  // Determine whether to report to production endpoint
  const endpoint = activeConfig.analyticsEndpoint || import.meta.env.VITE_ANALYTICS_ENDPOINT;
  const isProd = import.meta.env.PROD;
  const shouldReport = activeConfig.enableReporting !== undefined
    ? activeConfig.enableReporting
    : (Boolean(endpoint) && isProd);

  if (shouldReport && endpoint) {
    sendMetricToEndpoint(metric, endpoint);
  }
}

/**
 * Initialize performance tracking for First Contentful Paint (FCP) and Largest Contentful Paint (LCP)
 */
export function initPerformanceTracking(config: PerformanceTrackerConfig = {}): () => void {
  activeConfig = { ...config };

  if (typeof window === 'undefined') {
    return () => {};
  }

  // Idempotent safeguard
  if (isInitialized) {
    return () => {};
  }
  isInitialized = true;

  // Expose store to window for manual devtools inspection
  if (typeof window !== 'undefined') {
    (window as unknown as { __RALOA_PERFORMANCE__?: typeof metricsStore }).__RALOA_PERFORMANCE__ = metricsStore;
  }

  const cleanups: Array<() => void> = [];

  // Check if PerformanceObserver is available
  if (typeof PerformanceObserver === 'undefined') {
    // Fallback: check paint entries once window loads
    const handleLoad = () => {
      setTimeout(() => {
        try {
          const paintEntries = performance.getEntriesByType('paint');
          const fcpEntry = paintEntries.find(e => e.name === 'first-contentful-paint');
          if (fcpEntry && !metricsStore.fcp) {
            handleMetricCaptured({
              name: 'FCP',
              value: fcpEntry.startTime,
              rating: getFcpRating(fcpEntry.startTime),
              timestamp: Date.now()
            });
          }
        } catch {
          // Ignore
        }
      }, 0);
    };

    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad, { once: true });
    }
    return () => {};
  }

  // 1. Observe First Contentful Paint (FCP)
  try {
    const fcpObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          handleMetricCaptured({
            name: 'FCP',
            value: entry.startTime,
            rating: getFcpRating(entry.startTime),
            timestamp: Date.now()
          });
          fcpObserver.disconnect();
          break;
        }
      }
    });

    fcpObserver.observe({ type: 'paint', buffered: true });
    cleanups.push(() => fcpObserver.disconnect());
  } catch {
    // Browser may not support 'paint' observer type
  }

  // 2. Observe Largest Contentful Paint (LCP)
  try {
    let latestLcpEntry: PerformanceEntry | null = null;
    let lcpFinalized = false;

    const finalizeLcp = () => {
      if (lcpFinalized || !latestLcpEntry) return;
      lcpFinalized = true;

      const duration = latestLcpEntry.startTime;
      const element = (latestLcpEntry as unknown as { element?: Element }).element || null;

      handleMetricCaptured({
        name: 'LCP',
        value: duration,
        rating: getLcpRating(duration),
        timestamp: Date.now(),
        elementSelector: getElementSelector(element)
      });
    };

    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      if (entries.length > 0) {
        latestLcpEntry = entries[entries.length - 1];
      }
    });

    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    cleanups.push(() => lcpObserver.disconnect());

    // Finalize LCP on user interaction (scroll, click, keydown) or visibility state change
    const interactionEvents = ['click', 'keydown', 'scroll'];
    const handleInteraction = () => {
      finalizeLcp();
      cleanupListeners();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        finalizeLcp();
      }
    };

    interactionEvents.forEach((event) => {
      window.addEventListener(event, handleInteraction, { once: true, passive: true });
    });
    window.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });

    // Fallback timer: in development, finalize LCP after page load + 3.5s so developers see it without needing to click
    const devTimer = setTimeout(() => {
      if (latestLcpEntry && !lcpFinalized) {
        finalizeLcp();
      }
    }, 3500);

    const cleanupListeners = () => {
      clearTimeout(devTimer);
      interactionEvents.forEach((event) => {
        window.removeEventListener(event, handleInteraction);
      });
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };

    cleanups.push(cleanupListeners);
  } catch {
    // Browser may not support 'largest-contentful-paint' observer type
  }

  return () => {
    cleanups.forEach((cleanup) => cleanup());
    isInitialized = false;
  };
}

/**
 * Access the current captured performance metrics
 */
export function getPerformanceMetrics(): {
  fcp: PerformanceMetric | null;
  lcp: PerformanceMetric | null;
} {
  return { ...metricsStore };
}
