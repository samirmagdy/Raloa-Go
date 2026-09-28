import type { MetricLabels, ObservabilityMetrics, TelemetryContext } from './types';

const SENSITIVE_KEY = /(authorization|cookie|token|secret|password|credential|raw.?event|payload|body|email)/i;
const SECRET_VALUE = /(sk_(?:live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|AIza[A-Za-z0-9_-]+|-----BEGIN [A-Z ]+ PRIVATE KEY-----)/g;

function redactText(value: string): string {
  return value.replace(SECRET_VALUE, '[REDACTED]');
}

function safeValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY.test(key)) return '[REDACTED]';
  if (value instanceof Error) return { name: value.name, message: redactText(value.message), stack: value.stack ? redactText(value.stack) : undefined };
  if (typeof value === 'string' && value.length > 500) return `${redactText(value.slice(0, 500))}…`;
  if (typeof value === 'string') return redactText(value);
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
  readonly gauges = new Map<string, number>();

  increment(name: string, labels: MetricLabels = {}, value = 1): void {
    this.counters.set(`${name}:${JSON.stringify(labels)}`, (this.counters.get(`${name}:${JSON.stringify(labels)}`) || 0) + value);
  }

  observe(name: string, valueMs: number, labels: MetricLabels = {}): void {
    this.observations.push({ name, valueMs, labels });
  }

  setGauge(name: string, value: number, labels: MetricLabels = {}): void {
    this.gauges.set(`${name}:${JSON.stringify(labels)}`, value);
  }

  snapshot() {
    return { counters: Object.fromEntries(this.counters), gauges: Object.fromEntries(this.gauges), observations: this.observations.slice(-1000) };
  }

  toPrometheus(): string {
    const lines: string[] = [];
    for (const [key, value] of this.counters) lines.push(`${metricLine(key, value, 'counter')}`);
    for (const [key, value] of this.gauges) lines.push(`${metricLine(key, value, 'gauge')}`);
    const aggregates = new Map<string, { count: number; sum: number }>();
    for (const observation of this.observations) {
      const key = `${observation.name}:${JSON.stringify(observation.labels)}`;
      const current = aggregates.get(key) || { count: 0, sum: 0 };
      current.count += 1;
      current.sum += observation.valueMs;
      aggregates.set(key, current);
    }
    for (const [key, value] of aggregates) {
      const separator = key.indexOf(':');
      const base = separator === -1 ? key : key.slice(0, separator);
      const labels = separator === -1 ? '' : key.slice(separator);
      lines.push(metricLine(`${base}_count${labels}`, value.count, 'counter'));
      lines.push(metricLine(`${base}_sum${labels}`, value.sum, 'counter'));
    }
    return `${lines.join('\n')}\n`;
  }
}

function metricLine(key: string, value: number, type: 'counter' | 'gauge'): string {
  const separator = key.indexOf(':');
  const name = (separator === -1 ? key : key.slice(0, separator)).replace(/[^a-zA-Z0-9_]/g, '_');
  let labels = '';
  if (separator !== -1) {
    try {
      const parsed = JSON.parse(key.slice(separator + 1)) as Record<string, unknown>;
      labels = Object.entries(parsed).map(([label, labelValue]) => `${label.replace(/[^a-zA-Z0-9_]/g, '_')}="${String(labelValue).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',');
    } catch { labels = ''; }
  }
  return `# TYPE ${name} ${type}\n${name}${labels ? `{${labels}}` : ''} ${value}`;
}

export function traceIdFromHeaders(headers: Record<string, string | string[] | undefined>): string | undefined {
  const traceparent = Array.isArray(headers.traceparent) ? headers.traceparent[0] : headers.traceparent;
  if (traceparent && /^[\da-f]{2}-([\da-f]{32})-[\da-f]{16}-[\da-f]{2}$/i.test(traceparent)) return traceparent.split('-')[1];
  const cloudTrace = Array.isArray(headers['x-cloud-trace-context']) ? headers['x-cloud-trace-context'][0] : headers['x-cloud-trace-context'];
  return cloudTrace?.split('/')[0] || undefined;
}
