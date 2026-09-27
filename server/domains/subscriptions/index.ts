import type { Firestore } from 'firebase-admin/firestore';
import type { DomainModule } from '../../core/types';
import { createFirestoreSubscriptionsRepository } from '../../repositories/firestore';
import type { SubscriptionsRepository } from '../../repositories/contracts';
import { createSubscriptionsService, type SubscriptionsService } from './service';

export interface SubscriptionsModule extends DomainModule { repository: SubscriptionsRepository; service: SubscriptionsService; }
export function createSubscriptionsModule(db: Firestore): SubscriptionsModule {
  const repository = createFirestoreSubscriptionsRepository(db);
  return { name: 'subscriptions', routes: ['/api/billing/checkout-session', '/api/billing/portal-session'], repository, service: createSubscriptionsService(repository) };
}
