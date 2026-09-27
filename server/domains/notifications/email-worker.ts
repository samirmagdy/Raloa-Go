import type { Firestore } from 'firebase-admin/firestore';
import type { EmailProvider } from '../../core/providers';
import type { BackgroundJob } from '../../background-jobs/types';

type EmailNotification = {
  id: string;
  bookingId?: string;
  email?: string;
  type?: string;
  status?: string;
  attempts?: number;
  updatedAt?: string;
};

const MAX_ATTEMPTS = 8;

function escapeEmailText(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
}

function retryDelay(attempts: number): number {
  return Math.min(6 * 60 * 60 * 1000, 30_000 * (2 ** Math.min(attempts - 1, 8)));
}

export function createFirestoreEmailDeliveryWorker(dependencies: { db: Firestore; provider: EmailProvider; clock?: () => string }) {
  const clock = dependencies.clock || (() => new Date().toISOString());
  return {
    async run(job: BackgroundJob): Promise<void> {
      const collection = dependencies.db.collection('notification_jobs');
      let query: FirebaseFirestore.Query = collection.where('status', 'in', ['pending', 'retry', 'processing']).limit(50);
      const bookingId = typeof job.payload.bookingId === 'string' ? job.payload.bookingId : '';
      if (bookingId) query = collection.where('bookingId', '==', bookingId).where('status', 'in', ['pending', 'retry', 'processing']).limit(50);
      const snapshot = await query.get();
      let failure: Error | null = null;

      for (const document of snapshot.docs) {
        const raw = document.data() || {};
        const notification: EmailNotification = { id: document.id, ...raw };
        const updatedAt = Date.parse(String(notification.updatedAt || 0));
        if (notification.status === 'processing' && updatedAt > Date.now() - 10 * 60 * 1000) continue;
        if (notification.status === 'retry' && raw.nextAttemptAt && Date.parse(String(raw.nextAttemptAt)) > Date.now()) continue;

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

        try {
          const bookingSnapshot = await dependencies.db.collection('bookings').doc(String(notification.bookingId || '')).get();
          if (!bookingSnapshot.exists) throw new Error('BOOKING_NOT_FOUND');
          const booking = bookingSnapshot.data() || {};
          const recipient = typeof notification.email === 'string' ? notification.email : '';
          if (!recipient) throw new Error('NOTIFICATION_RECIPIENT_MISSING');
          const subject = notification.type === 'booking_request' ? 'New booking request received'
            : notification.type === 'booking_confirmed' ? 'Booking confirmed'
              : notification.type === 'booking_cancelled' ? 'Booking cancelled' : 'Booking request received';
          const html = `<p>${subject}</p><p>Service: ${escapeEmailText(String(booking.serviceName || 'Appointment'))}</p><p>When: ${escapeEmailText(String(booking.localDate || ''))} ${escapeEmailText(String(booking.localTime || ''))} (${escapeEmailText(String(booking.timezone || 'UTC'))})</p>`;
          await dependencies.provider.send({ to: recipient, subject, text: `${subject}\nService: ${String(booking.serviceName || 'Appointment')}`, html, idempotencyKey: `notification:${document.id}` });
          await document.ref.update({ status: 'sent', sentAt: clock(), updatedAt: clock(), lastError: null, nextAttemptAt: null });
        } catch (error) {
          const attempts = Number(notification.attempts || 0) + 1;
          const terminal = attempts >= MAX_ATTEMPTS;
          const message = error instanceof Error ? error.message : 'DELIVERY_FAILED';
          await document.ref.update({ status: terminal ? 'failed' : 'retry', lastError: message, nextAttemptAt: terminal ? null : new Date(Date.now() + retryDelay(attempts)).toISOString(), updatedAt: clock() });
          failure ||= new Error(message);
        }
      }
      if (failure) throw failure;
    }
  };
}
