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
import type { UserMiniSite, UserMiniSiteSummary } from '../types';

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

export type StudioApiClient = ReturnType<typeof createStudioApiClient>;

/** Typed authenticated transport used by the shared Studio implementation. */
export function createStudioApiClient(getToken: () => Promise<string>) {
  const authenticatedRequest = async <T>(path: string, init: RequestInit = {}) => {
    const token = await getToken();
    return request<T>(path, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  };
  return {
    listSites: () => authenticatedRequest<{ sites: UserMiniSiteSummary[] }>('/api/sites'),
    getSite: async (siteId: string) => {
      const response = await authenticatedRequest<{ site: UserMiniSite }>(`/api/sites/${encodeURIComponent(siteId)}`);
      return response.site;
    },
    saveSite: async (siteId: string, siteData: Partial<UserMiniSite>) => {
      const response = await authenticatedRequest<{ site: UserMiniSite }>(`/api/sites/${encodeURIComponent(siteId)}`, { method: 'PUT', body: JSON.stringify(siteData) });
      return response.site;
    },
    createSite: async (siteData: Partial<UserMiniSite>, siteId?: string) => {
      const response = await authenticatedRequest<{ site: UserMiniSite }>('/api/sites', { method: 'POST', body: JSON.stringify({ ...(siteId ? { siteId } : {}), ...siteData }) });
      return response.site;
    },
    deleteSite: (siteId: string) => authenticatedRequest<void>(`/api/sites/${encodeURIComponent(siteId)}`, { method: 'DELETE' }),
  };
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
