import type {
  ApiError,
  ContactRequest,
  HandleCheckResponse,
  HealthResponse,
  NewsletterRequest,
  PlatformMetrics,
  PublicSiteResponse,
  TelemetryLinkClickRequest,
  TelemetryPageViewRequest
} from './types';

export class ApiClientError extends Error {
  constructor(public readonly status: number, public readonly details: ApiError) {
    super(details.message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details: ApiError = typeof body.error === 'object'
      ? body.error
      : { code: body.code || 'REQUEST_FAILED', message: body.error || body.message || 'Request failed' };
    throw new ApiClientError(response.status, details);
  }
  return body as T;
}

export const api = {
  health: () => request<HealthResponse>('/api/health'),
  readiness: () => request<Record<string, unknown>>('/api/readiness'),
  checkHandle: (handle: string) => request<HandleCheckResponse>(`/api/v1/handles/check?handle=${encodeURIComponent(handle)}`),
  publicSite: <T = Record<string, unknown>>(handle: string) => request<PublicSiteResponse<T>>(`/api/public/sites/${encodeURIComponent(handle)}`),
  platformMetrics: () => request<PlatformMetrics>('/api/analytics/platform'),
  contact: (body: ContactRequest) => request<{ id: string }>('/api/v1/public/contact', { method: 'POST', body: JSON.stringify(body) }),
  newsletter: (body: NewsletterRequest) => request<{ id: string }>('/api/v1/public/newsletter', { method: 'POST', body: JSON.stringify(body) }),
  pageView: (body: TelemetryPageViewRequest) => request<{ status: 'accepted' }>('/api/v1/public/telemetry/page-view', { method: 'POST', body: JSON.stringify(body) }),
  linkClick: (body: TelemetryLinkClickRequest) => request<{ status: 'accepted' }>('/api/v1/public/telemetry/link-click', { method: 'POST', body: JSON.stringify(body) })
};
