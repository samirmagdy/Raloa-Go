import type { Firestore } from 'firebase-admin/firestore';
import type { DomainModule } from '../../core/types';
import { createFirestoreMediaMetadataRepository } from '../../repositories/firestore';
import type { MediaMetadataRepository } from './contracts';
import { createMediaService, type MediaService } from './service';
export interface MediaModule extends DomainModule { repository: MediaMetadataRepository; service: MediaService; }
export function createMediaModule(db: Firestore): MediaModule {
  const repository = createFirestoreMediaMetadataRepository(db);
  return { name: 'media', routes: ['/api/media'], repository, service: createMediaService(repository) };
}
