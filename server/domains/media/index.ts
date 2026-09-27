import type { Firestore } from 'firebase-admin/firestore';
import { firestoreRepository } from '../../infrastructure/firestore-repository';
import type { DomainModule, Repository } from '../../core/types';
import { createMediaService, type MediaService } from './service';
export interface MediaAsset { [key: string]: unknown }
export interface MediaModule extends DomainModule { repository: Repository<MediaAsset>; service: MediaService; }
export function createMediaModule(db: Firestore): MediaModule {
  const repository = firestoreRepository<MediaAsset>(db, 'media_assets');
  return { name: 'media', routes: ['/api/media'], repository, service: createMediaService(repository) };
}
