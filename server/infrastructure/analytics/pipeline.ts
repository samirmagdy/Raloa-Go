import { analyticsEventSchemaV1, type AnalyticsEventV1 } from '../../../src/shared/schema';

export interface AnalyticsEventQueue {
  enqueue(event: AnalyticsEventV1): Promise<void>;
}

export interface AnalyticsEventDeduplicator {
  claim(eventId: string): Promise<boolean>;
}

export interface AnalyticsRawEventStore {
  append(event: AnalyticsEventV1): Promise<'inserted' | 'duplicate'>;
}

export interface AnalyticsRollupWriter {
  update(events: readonly AnalyticsEventV1[]): Promise<void>;
}

export interface AnalyticsDashboardReader<T> {
  listRollups(input: { siteOwnerId: string; siteId?: string; from: string; to: string; limit: number }): Promise<T[]>;
}

export type AnalyticsPipeline = {
  ingest(input: unknown): Promise<{ accepted: boolean; duplicate: boolean; eventId?: string }>;
  process(event: unknown): Promise<{ inserted: boolean; rolledUp: boolean }>;
};

export function createAnalyticsPipeline(dependencies: {
  queue: AnalyticsEventQueue;
  deduplicator: AnalyticsEventDeduplicator;
  rawStore: AnalyticsRawEventStore;
  rollups: AnalyticsRollupWriter;
}): AnalyticsPipeline {
  return {
    async ingest(input) {
      const event = analyticsEventSchemaV1.parse(input);
      const claimed = await dependencies.deduplicator.claim(event.eventId);
      if (!claimed) return { accepted: false, duplicate: true, eventId: event.eventId };
      await dependencies.queue.enqueue(event);
      return { accepted: true, duplicate: false, eventId: event.eventId };
    },
    async process(input) {
      const event = analyticsEventSchemaV1.parse(input);
      const result = await dependencies.rawStore.append(event);
      if (result === 'duplicate') return { inserted: false, rolledUp: false };
      await dependencies.rollups.update([event]);
      return { inserted: true, rolledUp: true };
    }
  };
}
