import type { Firestore } from 'firebase-admin/firestore';
import type { DomainModule } from '../../core/types';
import { createFirestoreSubscriptionsRepository } from '../../repositories/firestore';
import type { SubscriptionsRepository } from '../../repositories/contracts';

export interface SubscriptionsModule extends DomainModule { repository: SubscriptionsRepository; }
export function createSubscriptionsModule(db: Firestore): SubscriptionsModule {
  return { name: 'subscriptions', routes: ['/api/billing/checkout-session', '/api/billing/portal-session'], repository: createFirestoreSubscriptionsRepository(db) };
}
