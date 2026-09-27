import type { Firestore } from 'firebase-admin/firestore';
import type { BackgroundJob } from '../../background-jobs/types';

type VerificationResult = { verified: boolean; certificateStatus: 'pending' | 'active' | 'failed' };
const MAX_ATTEMPTS = 8;

function retryDelay(attempts: number): number {
  return Math.min(6 * 60 * 60 * 1000, 30_000 * (2 ** Math.min(attempts - 1, 8)));
}

export function createDomainVerificationWorker(dependencies: { db: Firestore; verify: (providerHostnameId: string) => Promise<VerificationResult>; onVerified?: (domain: Record<string, unknown>) => Promise<void>; clock?: () => string }) {
  const clock = dependencies.clock || (() => new Date().toISOString());
  return {
    async run(job: BackgroundJob): Promise<void> {
      const collection = dependencies.db.collection('custom_domains');
      const requestedId = typeof job.payload.domainId === 'string' ? job.payload.domainId : '';
      const documents = requestedId ? [await collection.doc(requestedId).get()] : (await collection.where('verificationStatus', '==', 'pending').limit(50).get()).docs;
      let transientFailure: Error | null = null;
      for (const document of documents) {
        if (!document.exists) continue;
        const raw = document.data() || {};
        if (!raw.cloudflareHostnameId || raw.provisioningState === 'deleted') continue;
        const claimed = await dependencies.db.runTransaction(async (transaction) => {
          const current = await transaction.get(document.ref);
          const data = current.data() || {};
          const updatedAt = Date.parse(String(data.verificationUpdatedAt || data.updatedAt || 0));
          if (!current.exists || data.provisioningState === 'deleted' || (data.verificationState === 'processing' && updatedAt > Date.now() - 10 * 60 * 1000)) return false;
          transaction.set(document.ref, { verificationState: 'processing', verificationAttempts: Number(data.verificationAttempts || 0) + 1, verificationUpdatedAt: clock(), updatedAt: clock() }, { merge: true });
          return true;
        });
        if (!claimed) continue;
        const attempts = Number(raw.verificationAttempts || 0) + 1;
        try {
          const result = await dependencies.verify(String(raw.cloudflareHostnameId));
          const verified = result.verified && result.certificateStatus === 'active';
          const next = { verificationState: 'idle', verificationStatus: result.verified ? 'verified' : 'pending', sslStatus: result.certificateStatus, provisioningState: verified ? 'verified' : 'pending', lastError: result.certificateStatus === 'failed' || !result.verified ? 'Cloudflare DNS or SSL verification is still pending.' : null, nextVerificationAt: verified ? null : new Date(Date.now() + retryDelay(attempts)).toISOString(), updatedAt: clock() };
          await document.ref.set(next, { merge: true });
          if (verified) await dependencies.onVerified?.({ id: document.id, ...raw, ...next });
          else if (attempts < MAX_ATTEMPTS) transientFailure ||= new Error('DOMAIN_VERIFICATION_PENDING');
        } catch (error) {
          const message = error instanceof Error ? error.message : 'DOMAIN_VERIFICATION_FAILED';
          const terminal = attempts >= MAX_ATTEMPTS;
          await document.ref.set({ verificationState: 'idle', verificationStatus: terminal ? 'failed' : 'pending', sslStatus: terminal ? 'failed' : 'pending', provisioningState: terminal ? 'failed' : 'pending', lastError: message, nextVerificationAt: terminal ? null : new Date(Date.now() + retryDelay(attempts)).toISOString(), updatedAt: clock() }, { merge: true });
          if (!terminal) transientFailure ||= new Error(message);
        }
      }
      if (transientFailure) throw transientFailure;
    },
    async reconcile(limit = 100): Promise<{ inspected: number; requeued: number }> {
      const snapshot = await collectionQuery(dependencies.db, limit);
      let requeued = 0;
      for (const document of snapshot.docs) {
        const data = document.data() || {};
        const due = data.nextVerificationAt && Date.parse(String(data.nextVerificationAt)) <= Date.now();
        const stale = data.verificationState === 'processing' && Date.parse(String(data.verificationUpdatedAt || 0)) <= Date.now() - 10 * 60 * 1000;
        if (due || stale) { await document.ref.set({ verificationState: 'idle', nextVerificationAt: new Date().toISOString(), lastError: stale ? 'STALE_DOMAIN_VERIFICATION_RECONCILED' : data.lastError || null, updatedAt: clock() }, { merge: true }); requeued += 1; }
      }
      return { inspected: snapshot.size, requeued };
    }
  };
}

async function collectionQuery(db: Firestore, limit: number): Promise<FirebaseFirestore.QuerySnapshot> {
  return db.collection('custom_domains').where('verificationStatus', '==', 'pending').limit(limit).get();
}
