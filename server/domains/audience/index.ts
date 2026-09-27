import type { Firestore } from 'firebase-admin/firestore';
import { firestoreRepository } from '../../infrastructure/firestore-repository';
import type { DomainModule, Repository } from '../../core/types';
import { createAudienceService, type AudienceService } from './service';
export interface AudienceRecord { [key: string]: unknown }
export interface AudienceModule extends DomainModule { repository: Repository<AudienceRecord>; service: AudienceService; }
export function createAudienceModule(db: Firestore): AudienceModule {
  const repository = firestoreRepository<AudienceRecord>(db, 'audience_subscribers');
  return { name: 'audience', routes: ['/api/creator/audience', '/api/v1/public/newsletter', '/api/v1/public/contact'], repository, service: createAudienceService(repository) };
}
