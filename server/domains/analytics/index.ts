import type { Firestore } from 'firebase-admin/firestore';
import { firestoreRepository } from '../../infrastructure/firestore-repository';
import type { DomainModule, Repository } from '../../core/types';
export interface AnalyticsEvent { [key: string]: unknown }
export interface AnalyticsModule extends DomainModule { events: Repository<AnalyticsEvent>; }
export function createAnalyticsModule(db: Firestore): AnalyticsModule {
  return { name: 'analytics', routes: ['/api/analytics/platform', '/api/v1/public/telemetry/page-view', '/api/v1/public/telemetry/link-click'], events: firestoreRepository(db, 'page_views') };
}
