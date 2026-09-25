import type { HandleCheckResponse, HealthResponse, PlatformMetrics } from '../types';

export const mockApiFixtures = {
  health: { status: 'ok', service: 'raloa', timestamp: '2026-01-01T00:00:00.000Z' } satisfies HealthResponse,
  availableHandle: { status: 'success', handle: 'creator', available: true } satisfies HandleCheckResponse,
  platformMetrics: { totalVisits: 0, totalClicks: 0, activeSitesCount: 0 } satisfies PlatformMetrics
};
