import 'dotenv/config';
import { adminDb, adminAuth, isAdminConfigured } from '../server-services';

export interface CleanupResult {
  processed: number;
  deleted: number;
  skipped: number;
  errors: Array<{ uid: string; error: string }>;
}

/**
 * Permanently cleans up accounts that requested deletion >= 14 days ago.
 * Retention window: 14 days grace period for recovery/verification.
 */
export async function cleanupDeletedAccounts(retentionDays = 14): Promise<CleanupResult> {
  const result: CleanupResult = {
    processed: 0,
    deleted: 0,
    skipped: 0,
    errors: []
  };

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  if (!isAdminConfigured()) {
    console.log('[Account Cleanup] Firebase Admin not configured, running in local/dry-run mode.');
    return result;
  }

  try {
    const snapshot = await adminDb
      .collection('account_deletion_requests')
      .where('status', '==', 'requested')
      .where('requestedAt', '<=', cutoff)
      .limit(100)
      .get();

    for (const doc of snapshot.docs) {
      result.processed++;
      const data = doc.data();
      const uid = data.uid || doc.id;

      try {
        console.log(`[Account Cleanup] Permanently purging user ${uid}...`);

        // 1. Delete user subcollections (sites, referrals, etc.)
        const userRef = adminDb.collection('users').doc(uid);
        const sitesSnapshot = await userRef.collection('sites').get();
        for (const siteDoc of sitesSnapshot.docs) {
          await siteDoc.ref.delete();
        }

        const referralsSnapshot = await userRef.collection('referrals').get();
        for (const refDoc of referralsSnapshot.docs) {
          await refDoc.ref.delete();
        }

        // 2. Delete user active sessions
        const sessionsSnapshot = await adminDb.collection('sessions').where('userId', '==', uid).get();
        for (const sessionDoc of sessionsSnapshot.docs) {
          await sessionDoc.ref.delete();
        }

        // 3. Delete user document from users collection
        await userRef.delete();

        // 4. Delete Firebase Auth user if it exists
        try {
          await adminAuth.deleteUser(uid);
        } catch (authError: any) {
          if (authError.code !== 'auth/user-not-found') {
            console.warn(`[Account Cleanup] Auth deletion notice for ${uid}:`, authError.message);
          }
        }

        // 5. Update deletion request status to completed
        await doc.ref.set(
          {
            status: 'completed',
            completedAt: new Date().toISOString()
          },
          { merge: true }
        );

        result.deleted++;
      } catch (err: any) {
        console.error(`[Account Cleanup] Error purging user ${uid}:`, err);
        result.errors.push({ uid, error: err.message || String(err) });
      }
    }
  } catch (error: any) {
    console.error('[Account Cleanup] Query failed:', error);
    throw error;
  }

  return result;
}

// Standalone execution support
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupDeletedAccounts()
    .then((res) => {
      console.log('[Account Cleanup] Completed successfully:', JSON.stringify(res, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Account Cleanup] Fatal error:', err);
      process.exit(1);
    });
}
