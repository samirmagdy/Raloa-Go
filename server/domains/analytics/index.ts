import type { Firestore } from 'firebase-admin/firestore';
import type { DomainModule } from '../../core/types';
import { createAnalyticsService, type AnalyticsService } from './service';
import { createFirestoreAnalyticsRollupsRepository } from '../../repositories/firestore';
import type { AnalyticsRollupsRepository } from '../../repositories/contracts';
export interface AnalyticsEvent { [key: string]: unknown }
export interface AnalyticsModule extends DomainModule { rollups: AnalyticsRollupsRepository; service: AnalyticsService; }
export function createAnalyticsModule(db: Firestore): AnalyticsModule {
  const rollups = createFirestoreAnalyticsRollupsRepository(db);
  return { name: 'analytics', routes: ['/api/analytics/platform', '/api/v1/public/telemetry/page-view', '/api/v1/public/telemetry/link-click'], rollups, service: createAnalyticsService(rollups) };
}
