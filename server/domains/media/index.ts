import type { Firestore } from 'firebase-admin/firestore';
import { firestoreRepository } from '../../infrastructure/firestore-repository';
import type { DomainModule, Repository } from '../../core/types';
export interface MediaAsset { [key: string]: unknown }
export interface MediaModule extends DomainModule { repository: Repository<MediaAsset>; }
export function createMediaModule(db: Firestore): MediaModule {
  return { name: 'media', routes: ['/api/media'], repository: firestoreRepository(db, 'media_assets') };
}
