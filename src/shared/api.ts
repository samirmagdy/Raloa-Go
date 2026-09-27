import type { ApiError, ContactRequest, NewsletterRequest, PublicSiteResponse, TelemetryLinkClickRequest, TelemetryPageViewRequest } from '../api/types';

export class SharedApiError extends Error {
  constructor(public readonly status: number, public readonly details: ApiError) {
    super(details.message);
    this.name = 'SharedApiError';
  }
}

export function createPublicApiClient(fetcher: typeof fetch = fetch, baseUrl = '') {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetcher(`${baseUrl}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new SharedApiError(response.status, typeof body.error === 'object' ? body.error : { code: body.code || 'REQUEST_FAILED', message: body.error || body.message || 'Request failed' });
    return body as T;
  }
  return {
    publicSite: <T = Record<string, unknown>>(handle: string) => request<PublicSiteResponse<T>>(`/api/public/sites/${encodeURIComponent(handle)}`),
    contact: (body: ContactRequest) => request<{ id: string }>('/api/v1/public/contact', { method: 'POST', body: JSON.stringify(body) }),
    newsletter: (body: NewsletterRequest) => request<{ id: string }>('/api/v1/public/newsletter', { method: 'POST', body: JSON.stringify(body) }),
    pageView: (body: TelemetryPageViewRequest) => request<{ status: 'accepted' }>('/api/v1/public/telemetry/page-view', { method: 'POST', body: JSON.stringify(body) }),
    linkClick: (body: TelemetryLinkClickRequest) => request<{ status: 'accepted' }>('/api/v1/public/telemetry/link-click', { method: 'POST', body: JSON.stringify(body) })
  };
}
