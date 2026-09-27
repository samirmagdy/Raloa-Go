import type { Firestore } from 'firebase-admin/firestore';
import type { OAuthConnection, OAuthConnectionRepository } from '../domains/integrations/oauth-service';

function record(document: any): OAuthConnection {
  const value = document.data() || {};
  return { id: document.id, ...value } as OAuthConnection;
}

export function createFirestoreOAuthRepository(db: Firestore): OAuthConnectionRepository {
  const collection = db.collection('oauth_connections');
  return {
    async get(userId, provider, siteId) {
      const snapshot = await collection.where('userId', '==', userId).where('provider', '==', provider).limit(20).get();
      const document = snapshot.docs.find((candidate) => (siteId ? candidate.data()?.siteId === siteId : !candidate.data()?.siteId));
      return document ? record(document) : null;
    },
    save: async (connection) => { await collection.doc(connection.id).set(connection, { merge: true }); },
    async claimRefreshLock(id, lockUntil) {
      const reference = collection.doc(id);
      let claimed = false;
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reference);
        const current = snapshot.data() || {};
        if (current.refreshLockUntil && Number(current.refreshLockUntil) > Date.now()) return;
        transaction.set(reference, { state: 'refreshing', refreshLockUntil: lockUntil, updatedAt: new Date().toISOString() }, { merge: true });
        claimed = true;
      });
      return claimed;
    },
    releaseRefreshLock: async (id) => { await collection.doc(id).set({ refreshLockUntil: null, updatedAt: new Date().toISOString() }, { merge: true }); },
    revoke: async (id, updatedAt) => { await collection.doc(id).set({ state: 'revoked', encryptedAccessToken: null, encryptedRefreshToken: null, revokedAt: updatedAt, updatedAt }, { merge: true }); }
  };
}
