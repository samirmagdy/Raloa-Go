import type { MediaMetadataRepository } from './contracts';
export interface MediaService { list(userId: string, siteId: string): Promise<Record<string, unknown>[]>; remove(id: string): Promise<void>; }
export function createMediaService(repository: MediaMetadataRepository): MediaService { return { list: async (userId, siteId) => repository.listOwned(userId, siteId), remove: (id) => repository.remove(id) }; }
