import type { Firestore } from 'firebase-admin/firestore';
import { firestoreRepository } from '../../infrastructure/firestore-repository';
import type { DomainModule, Repository } from '../../core/types';
export interface AudienceRecord { [key: string]: unknown }
export interface AudienceModule extends DomainModule { repository: Repository<AudienceRecord>; }
export function createAudienceModule(db: Firestore): AudienceModule {
  return { name: 'audience', routes: ['/api/creator/audience', '/api/v1/public/newsletter', '/api/v1/public/contact'], repository: firestoreRepository(db, 'audience_subscribers') };
}
