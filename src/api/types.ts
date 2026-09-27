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
  totalPageViews: number;
  uniqueVisitors: number;
  totalClicks: number;
  ctr: number | null;
  activeSitesCount: number;
  capped?: boolean;
  dateRange?: { from: string; to: string };
  timeline: Array<{ date: string; views: number; clicks: number; uniqueVisitors: number }>;
  links: Array<{ linkId: string; title: string; url: string; blockType?: string; clicks: number; share: number }>;
  utmSources: Array<{ source: string; medium: string; campaign: string; views: number; clicks: number; uniqueVisitors: number }>;
  referrers: Array<{ name: string; count: number }>;
  devices: Array<{ name: string; count: number }>;
  browsers: Array<{ name: string; count: number }>;
  countries: Array<{ name: string; count: number }>;
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
  eventId?: string;
  visitorId?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
};

export type TelemetryLinkClickRequest = {
  linkId: string;
  url: string;
  siteHandle?: string;
  eventId?: string;
  visitorId?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
};
