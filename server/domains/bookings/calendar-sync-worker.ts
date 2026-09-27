import type { Firestore } from 'firebase-admin/firestore';
import type { BackgroundJob } from '../../background-jobs/types';
import { calendarAdapter, type CalendarBookingEvent, type CalendarProvider } from '../../../server-calendar';
import { decryptCalendarTokens, encryptCalendarTokens } from '../../../server-calendar';

const MAX_ATTEMPTS = 8;

function retryDelay(attempts: number): number {
  return Math.min(6 * 60 * 60 * 1000, 30_000 * (2 ** Math.min(attempts - 1, 8)));
}

export function createCalendarSyncWorker(dependencies: { db: Firestore; clock?: () => string }) {
  const clock = dependencies.clock || (() => new Date().toISOString());
  return {
    async run(job: BackgroundJob): Promise<void> {
      const collection = dependencies.db.collection('calendar_jobs');
      const bookingId = typeof job.payload.bookingId === 'string' ? job.payload.bookingId : '';
      let query: FirebaseFirestore.Query = collection.where('status', 'in', ['pending', 'retry', 'processing']).limit(50);
      if (bookingId) query = collection.where('bookingId', '==', bookingId).where('status', 'in', ['pending', 'retry', 'processing']).limit(50);
      const snapshot = await query.get();
      let transientFailure: Error | null = null;

      for (const document of snapshot.docs) {
        const raw = document.data() || {};
        if (raw.nextAttemptAt && Date.parse(String(raw.nextAttemptAt)) > Date.now()) continue;
        if (raw.status === 'processing' && Date.parse(String(raw.updatedAt || 0)) > Date.now() - 10 * 60 * 1000) continue;
        const claimed = await dependencies.db.runTransaction(async (transaction) => {
          const current = await transaction.get(document.ref);
          const data = current.data() || {};
          const currentStatus = String(data.status || '');
          const currentUpdatedAt = Date.parse(String(data.updatedAt || 0));
          if (!current.exists || !['pending', 'retry'].includes(currentStatus) && !(currentStatus === 'processing' && currentUpdatedAt <= Date.now() - 10 * 60 * 1000)) return false;
          transaction.update(document.ref, { status: 'processing', attempts: Number(data.attempts || 0) + 1, updatedAt: clock() });
          return true;
        });
        if (!claimed) continue;

        const attempts = Number(raw.attempts || 0) + 1;
        try {
          const bookingSnapshot = await dependencies.db.collection('bookings').doc(String(raw.bookingId || '')).get();
          if (!bookingSnapshot.exists) throw new Error('BOOKING_NOT_FOUND');
          const booking = bookingSnapshot.data() || {};
          const provider = String(raw.provider || '') as CalendarProvider;
          if (!['google', 'outlook'].includes(provider)) throw new Error('CALENDAR_PROVIDER_NOT_CONFIGURED');
          if (booking.status === 'cancelled' && raw.operation !== 'cancel') throw new Error('BOOKING_NOT_ACTIVE');
          const integrationRef = dependencies.db.collection('calendar_integrations').doc(`${String(booking.hostUserId)}_${provider}`);
          const integrationSnapshot = await integrationRef.get();
          if (!integrationSnapshot.exists) throw new Error('CALENDAR_REAUTH_REQUIRED');
          const integration = integrationSnapshot.data() || {};
          const adapter = calendarAdapter(provider);
          let tokens = await decryptCalendarTokens(String(integration.encryptedTokens || ''));
          const refreshed = await adapter.refresh(tokens);
          if (JSON.stringify(refreshed) !== JSON.stringify(tokens)) {
            tokens = refreshed;
            await integrationRef.set({ encryptedTokens: await encryptCalendarTokens(tokens), expiresAt: tokens.expiresAt, updatedAt: clock(), status: 'connected', lastError: null }, { merge: true });
          }
          if (raw.operation === 'cancel') {
            if (typeof raw.externalEventId === 'string' && raw.externalEventId) await adapter.cancelEvent(tokens, raw.externalEventId);
            await document.ref.update({ status: 'completed', completedAt: clock(), updatedAt: clock(), lastError: null });
          } else {
            if (typeof raw.externalEventId === 'string' && raw.externalEventId) {
              await document.ref.update({ status: 'completed', completedAt: clock(), updatedAt: clock(), lastError: null });
              continue;
            }
            const event: CalendarBookingEvent = { id: String(booking.id), title: `${String(booking.serviceName || 'Appointment')} with ${String(booking.customerName || 'Guest')}`, description: String(booking.notes || ''), start: String(booking.slotStart), end: String(booking.slotEnd), timezone: String(booking.timezone || 'UTC'), attendeeEmail: String(booking.customerEmail) };
            const created = await adapter.createEvent(tokens, event);
            await document.ref.update({ status: 'completed', externalEventId: created.externalEventId, completedAt: clock(), updatedAt: clock(), lastError: null });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'CALENDAR_DELIVERY_FAILED';
          const requiresAuth = message === 'CALENDAR_REAUTH_REQUIRED' || message.includes('401') || message.includes('403');
          const terminal = requiresAuth || attempts >= MAX_ATTEMPTS;
          await document.ref.update({ status: terminal ? (requiresAuth ? 'blocked' : 'failed') : 'retry', lastError: message, nextAttemptAt: terminal ? null : new Date(Date.now() + retryDelay(attempts)).toISOString(), updatedAt: clock() });
          if (!terminal) transientFailure ||= new Error(message);
        }
      }
      if (transientFailure) throw transientFailure;
    },
    async reconcile(limit = 100): Promise<{ inspected: number; requeued: number }> {
      const now = Date.now();
      const snapshot = await dependencies.db.collection('calendar_jobs').where('status', 'in', ['pending', 'retry', 'processing']).limit(limit).get();
      let requeued = 0;
      for (const document of snapshot.docs) {
        const data = document.data() || {};
        const stale = data.status === 'processing' && Date.parse(String(data.updatedAt || 0)) <= now - 10 * 60 * 1000;
        const due = ['pending', 'retry'].includes(String(data.status)) && (!data.nextAttemptAt || Date.parse(String(data.nextAttemptAt)) <= now);
        if (stale || due) { await document.ref.set({ status: 'retry', nextAttemptAt: new Date().toISOString(), lastError: stale ? 'STALE_CALENDAR_JOB_RECONCILED' : data.lastError || null, updatedAt: clock() }, { merge: true }); requeued += 1; }
      }
      return { inspected: snapshot.size, requeued };
    }
  };
}
