import type { SubscriptionRecord, SubscriptionsRepository } from '../../repositories/contracts';

export interface SubscriptionsService {
  getByUser(userId: string): Promise<SubscriptionRecord | null>;
  save(userId: string, subscription: Partial<SubscriptionRecord>): Promise<void>;
}

export function createSubscriptionsService(repository: SubscriptionsRepository): SubscriptionsService {
  return {
    getByUser: (userId) => repository.getByUser(userId),
    save: (userId, subscription) => repository.save(userId, subscription)
  };
}
