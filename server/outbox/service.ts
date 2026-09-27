import crypto from 'node:crypto';
import type { OutboxEvent, OutboxPublisher, OutboxRepository } from './types';

const MAX_ATTEMPTS = 8;

function delay(attempts: number): number {
  return Math.min(6 * 60 * 60 * 1000, 30_000 * (2 ** Math.min(attempts - 1, 8)));
}

export function outboxEventId(idempotencyKey: string): string {
  return crypto.createHash('sha256').update(idempotencyKey).digest('hex');
}

export function createOutboxService(repository: OutboxRepository, publisher: OutboxPublisher) {
  return {
    async publishPending(limit = 100): Promise<{ published: number; failed: number }> {
      const events = await repository.listDue(new Date().toISOString(), limit);
      let published = 0;
      let failed = 0;
      for (const event of events) {
        const claimed = await repository.claim(event.id, new Date(Date.now() + 5 * 60 * 1000).toISOString());
        if (!claimed) continue;
        try {
          await publisher.publish(claimed);
          await repository.markPublished(claimed.id, new Date().toISOString());
          published += 1;
        } catch (error) {
          const attempts = claimed.attempts;
          const deadLetter = attempts >= Math.min(claimed.maxAttempts, MAX_ATTEMPTS);
          await repository.markFailed(claimed.id, error instanceof Error ? error.message : 'OUTBOX_PUBLISH_FAILED', deadLetter ? undefined : new Date(Date.now() + delay(attempts)).toISOString(), deadLetter);
          failed += 1;
        }
      }
      return { published, failed };
    },
    async cleanup(publishedBefore: string, limit = 500): Promise<number> {
      if (!repository.cleanupPublished) return 0;
      return repository.cleanupPublished(publishedBefore, limit);
    }
  };
}
