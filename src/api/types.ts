export type ApiError = {
  code: string;
  message: string;
  fields?: Record<string, string>;
};

export type HealthResponse = {
  status: 'ok';
  service: string;
  timestamp: string;
};

export type HandleCheckResponse = {
  status: 'success';
  handle: string;
  available: boolean;
};

export type PlatformMetrics = {
  totalVisits: number;
  totalClicks: number;
  activeSitesCount: number;
  capped?: boolean;
};

export type PublicSiteResponse<T = Record<string, unknown>> = { site: T };

export type ContactRequest = {
  name: string;
  email: string;
  message: string;
};

export type NewsletterRequest = { email: string };

export type TelemetryPageViewRequest = {
  path: string;
  userAgent?: string;
};

export type TelemetryLinkClickRequest = {
  linkId: string;
  url: string;
  siteHandle?: string;
};
