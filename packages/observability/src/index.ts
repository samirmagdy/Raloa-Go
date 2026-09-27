export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type TelemetryContext = { requestId?: string; tenantId?: string; siteId?: string; userId?: string; jobId?: string };

export interface Logger {
  log(level: LogLevel, message: string, context?: TelemetryContext & Record<string, unknown>): void;
  error(error: unknown, context?: TelemetryContext & Record<string, unknown>): void;
}

export interface ErrorReporter {
  capture(error: unknown, context?: TelemetryContext & Record<string, unknown>): string;
}

export interface Tracer {
  span<T>(name: string, context: TelemetryContext, work: () => Promise<T>): Promise<T>;
}

