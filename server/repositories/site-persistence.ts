import type { Firestore } from 'firebase-admin/firestore';

export type SitePersistenceRepository = {
  listOwned(userId: string, limit?: number): Promise<Array<{ id: string; data: Record<string, any> }>>;
  getProfile(userId: string): Promise<Record<string, any> | null>;
  getOwned(userId: string, siteId: string): Promise<{ id: string; data: Record<string, any> } | null>;
  isHandleTaken(handle: string, userId: string, siteId?: string): Promise<boolean>;
  create(userId: string, siteId: string, site: Record<string, any>): Promise<void>;
  delete(userId: string, siteId: string): Promise<{ site: Record<string, any>; deleted: boolean }>;
  saveVersioned(input: {
    userId: string;
    siteId: string;
    site: Record<string, any>;
    previousHandle: string;
    nextHandle: string;
    expectedRevision?: number;
  }): Promise<{ status: 'saved' | 'site_not_found' | 'version_conflict' | 'handle_redirect_conflict'; site?: Record<string, any> }>;
};

export function createFirestoreSitePersistenceRepository(db: Firestore): SitePersistenceRepository {
  const sites = (userId: string) => db.collection('users').doc(userId).collection('sites');

  return {
    async listOwned(userId, limit = 100) {
      const snapshot = await sites(userId).limit(limit).get();
      return snapshot.docs.map((document) => ({ id: document.id, data: document.data() as Record<string, any> }));
    },
    async getProfile(userId) {
      const snapshot = await db.collection('users').doc(userId).get();
      return snapshot.exists ? snapshot.data() as Record<string, any> : null;
    },
    async getOwned(userId, siteId) {
      const snapshot = await sites(userId).doc(siteId).get();
      return snapshot.exists ? { id: snapshot.id, data: snapshot.data() as Record<string, any> } : null;
    },
    async isHandleTaken(handle, userId, siteId) {
      const [snapshot, redirect] = await Promise.all([
        db.collectionGroup('sites').where('username', '==', handle).limit(100).get(),
        db.collection('site_slug_redirects').doc(handle).get()
      ]);
      if (redirect.exists) return true;
      return snapshot.docs.some((document) => document.ref.parent.parent?.id !== userId || document.id !== siteId);
    },
    async create(userId, siteId, site) {
      await sites(userId).doc(siteId).create(site);
    },
    async delete(userId, siteId) {
      const reference = sites(userId).doc(siteId);
      const snapshot = await reference.get();
      if (!snapshot.exists) return { site: {}, deleted: false };
      const redirects = await db.collection('site_slug_redirects').where('siteId', '==', siteId).where('userId', '==', userId).limit(100).get();
      const batch = db.batch();
      redirects.docs.forEach((document) => batch.delete(document.ref));
      batch.delete(reference);
      await batch.commit();
      return { site: snapshot.data() as Record<string, any>, deleted: true };
    },
    async saveVersioned({ userId, siteId, site, previousHandle, nextHandle, expectedRevision }) {
      const reference = sites(userId).doc(siteId);
      const redirectReference = previousHandle && previousHandle !== nextHandle
        ? db.collection('site_slug_redirects').doc(previousHandle)
        : null;
      try {
        await db.runTransaction(async (transaction) => {
          const currentSnapshot = await transaction.get(reference);
          if (!currentSnapshot.exists) throw new Error('SITE_NOT_FOUND');
          const currentRevision = Number(currentSnapshot.data()?.revision || 0);
          if (expectedRevision !== undefined && currentRevision !== expectedRevision) throw new Error('SITE_VERSION_CONFLICT');
          if (redirectReference) {
            const redirectSnapshot = await transaction.get(redirectReference);
            if (redirectSnapshot.exists && String(redirectSnapshot.data()?.siteId || '') !== siteId) throw new Error('HANDLE_REDIRECT_CONFLICT');
            transaction.set(redirectReference, {
              oldSlug: previousHandle,
              newSlug: nextHandle,
              siteId,
              userId,
              createdAt: redirectSnapshot.data()?.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }, { merge: true });
          }
          transaction.set(reference, site, { merge: true });
        });
        return { status: 'saved' as const, site };
      } catch (error) {
        const code = error instanceof Error ? error.message : '';
        if (code === 'SITE_NOT_FOUND') return { status: 'site_not_found' as const };
        if (code === 'HANDLE_REDIRECT_CONFLICT') return { status: 'handle_redirect_conflict' as const };
        if (code === 'SITE_VERSION_CONFLICT') {
          const latest = await reference.get();
          return { status: 'version_conflict' as const, site: latest.data() as Record<string, any> || {} };
        }
        throw error;
      }
    }
  };
}

