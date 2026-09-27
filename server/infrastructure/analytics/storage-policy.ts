export type AnalyticsStorageLane = 'operational_postgresql' | 'analytical_bigquery' | 'short_lived_buffer';

export type AnalyticsStoragePolicy = {
  lane: AnalyticsStorageLane;
  authoritative: boolean;
  retentionDays: number | null;
  idempotencyKey: string;
  queryWorkload: 'studio' | 'warehouse' | 'ingestion';
  rationale: string;
};

export const ANALYTICS_STORAGE_POLICY = {
  studioDailyRollups: {
    lane: 'operational_postgresql',
    authoritative: true,
    retentionDays: 400,
    idempotencyKey: 'site_id:day',
    queryWorkload: 'studio',
    rationale: 'Small, bounded aggregates power authenticated Studio dashboards and operational decisions.'
  },
  studioVisitorDays: {
    lane: 'operational_postgresql',
    authoritative: true,
    retentionDays: 400,
    idempotencyKey: 'site_id:day:visitor_hash',
    queryWorkload: 'studio',
    rationale: 'Deduplicated daily visitor facts support Studio metrics without retaining every event in PostgreSQL.'
  },
  rawEvents: {
    lane: 'analytical_bigquery',
    authoritative: true,
    retentionDays: null,
    idempotencyKey: 'event_id',
    queryWorkload: 'warehouse',
    rationale: 'High-volume append-only history belongs in partitioned analytical storage, not the OLTP database.'
  },
  postgresEventBuffer: {
    lane: 'short_lived_buffer',
    authoritative: false,
    retentionDays: 7,
    idempotencyKey: 'event_id',
    queryWorkload: 'ingestion',
    rationale: 'Optional retry buffer for export/rollup workers; it must be TTL-cleaned and never treated as a warehouse.'
  }
} as const satisfies Record<string, AnalyticsStoragePolicy>;

export type AnalyticsStoragePolicyName = keyof typeof ANALYTICS_STORAGE_POLICY;
