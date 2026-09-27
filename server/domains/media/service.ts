import type { Repository } from '../../core/types';
export interface MediaService { list(userId: string, siteId: string): Promise<Record<string, unknown>[]>; remove(id: string): Promise<void>; }
export function createMediaService(repository: Repository): MediaService { return { list: async (userId, siteId) => (await repository.query().where('userId', '==', userId).where('siteId', '==', siteId).limit(500).get()).docs.map((doc) => doc.data()), remove: (id) => repository.delete(id) }; }
