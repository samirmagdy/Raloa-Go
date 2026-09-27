import type { Firestore } from 'firebase-admin/firestore';
import type { DomainModule } from '../../core/types';
import { createAudienceService, type AudienceService } from './service';
import { createFirestoreAudienceRepository } from '../../repositories/firestore';
import type { AudienceRepository } from '../../repositories/contracts';
export interface AudienceRecord { [key: string]: unknown }
export interface AudienceModule extends DomainModule { repository: AudienceRepository; service: AudienceService; }
export function createAudienceModule(db: Firestore): AudienceModule {
  const repository = createFirestoreAudienceRepository(db);
  return { name: 'audience', routes: ['/api/creator/audience', '/api/v1/public/newsletter', '/api/v1/public/contact'], repository, service: createAudienceService(repository) };
}
