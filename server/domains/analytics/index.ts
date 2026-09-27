import type { Firestore } from 'firebase-admin/firestore';
import { firestoreRepository } from '../../infrastructure/firestore-repository';
import type { DomainModule, Repository } from '../../core/types';
import { createAnalyticsService, type AnalyticsService } from './service';
export interface AnalyticsEvent { [key: string]: unknown }
export interface AnalyticsModule extends DomainModule { events: Repository<AnalyticsEvent>; service: AnalyticsService; }
export function createAnalyticsModule(db: Firestore): AnalyticsModule {
  const events = firestoreRepository<AnalyticsEvent>(db, 'page_views');
  return { name: 'analytics', routes: ['/api/analytics/platform', '/api/v1/public/telemetry/page-view', '/api/v1/public/telemetry/link-click'], events, service: createAnalyticsService(events) };
}
