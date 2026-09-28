import type { AnalyticsEventV1 } from '../../../src/shared/schema';
import type { AnalyticsRawEventStore } from './pipeline';

/**
 * BigQuery is deliberately represented as a port. The application does not
 * import a BigQuery SDK, so changing warehouse clients cannot leak into the
 * analytics worker or domain services.
 */
export interface BigQueryRawEventWriter {
  insert(event: AnalyticsEventV1): Promise<'inserted' | 'duplicate'>;
}

export function createBigQueryRawEventStore(writer: BigQueryRawEventWriter): AnalyticsRawEventStore {
  return {
    append: (event) => writer.insert(event)
  };
}
