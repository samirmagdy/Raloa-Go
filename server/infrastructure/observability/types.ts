export type TelemetryContext = {
  requestId?: string;
  traceId?: string;
  userId?: string;
  tenantId?: string;
  siteId?: string;
  jobId?: string;
  webhookId?: string;
  provider?: string;
};

export type MetricLabels = Record<string, string | number | boolean>;

export interface ObservabilityMetrics {
  increment(name: string, labels?: MetricLabels, value?: number): void;
  observe(name: string, valueMs: number, labels?: MetricLabels): void;
}
