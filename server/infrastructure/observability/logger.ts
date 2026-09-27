import type { MetricLabels, ObservabilityMetrics, TelemetryContext } from './types';

const SENSITIVE_KEY = /(authorization|cookie|token|secret|password|credential|raw.?event|payload|body|email)/i;

function safeValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY.test(key)) return '[REDACTED]';
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  if (typeof value === 'string' && value.length > 500) return `${value.slice(0, 500)}…`;
  return value;
}

export function redactFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, safeValue(key, value)]));
}

export function createStructuredLogger(base: TelemetryContext = {}) {
  const write = (level: 'info' | 'warn' | 'error', event: string, fields: Record<string, unknown> = {}) => {
    const line = { timestamp: new Date().toISOString(), level, event, ...base, ...redactFields(fields) };
    (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(JSON.stringify(line));
  };
  return { info: (event: string, fields?: Record<string, unknown>) => write('info', event, fields), warn: (event: string, fields?: Record<string, unknown>) => write('warn', event, fields), error: (event: string, fields?: Record<string, unknown>) => write('error', event, fields) };
}

export class InMemoryMetrics implements ObservabilityMetrics {
  readonly counters = new Map<string, number>();
  readonly observations: Array<{ name: string; valueMs: number; labels: MetricLabels }> = [];

  increment(name: string, labels: MetricLabels = {}, value = 1): void {
    this.counters.set(`${name}:${JSON.stringify(labels)}`, (this.counters.get(`${name}:${JSON.stringify(labels)}`) || 0) + value);
  }

  observe(name: string, valueMs: number, labels: MetricLabels = {}): void {
    this.observations.push({ name, valueMs, labels });
  }
}

export function traceIdFromHeaders(headers: Record<string, string | string[] | undefined>): string | undefined {
  const traceparent = Array.isArray(headers.traceparent) ? headers.traceparent[0] : headers.traceparent;
  if (traceparent && /^[\da-f]{2}-([\da-f]{32})-[\da-f]{16}-[\da-f]{2}$/i.test(traceparent)) return traceparent.split('-')[1];
  const cloudTrace = Array.isArray(headers['x-cloud-trace-context']) ? headers['x-cloud-trace-context'][0] : headers['x-cloud-trace-context'];
  return cloudTrace?.split('/')[0] || undefined;
}
