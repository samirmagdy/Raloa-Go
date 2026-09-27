export type MigrationPhase =
  | 'planned'
  | 'backfilling'
  | 'reconciling'
  | 'shadow_read'
  | 'dual_write'
  | 'target_authoritative'
  | 'rolled_back'
  | 'completed';

export type MigrationCheckpoint = {
  domain: string;
  phase: MigrationPhase;
  cursor: string | null;
  scanned: number;
  written: number;
  mismatches: number;
  lastError: string | null;
  updatedAt: string;
};

export type MigrationPage<T> = { records: T[]; nextCursor: string | null };

export interface MigrationCheckpointStore {
  get(domain: string): Promise<MigrationCheckpoint | null>;
  save(checkpoint: MigrationCheckpoint): Promise<void>;
}

export interface MigrationSource<T> {
  listPage(cursor: string | null, limit: number): Promise<MigrationPage<T>>;
  getId(record: T): string;
}

export interface MigrationTarget<T> {
  upsert(records: T[]): Promise<void>;
  get(id: string): Promise<T | null>;
  listIds(): Promise<string[]>;
}

export type MigrationPlan<T> = {
  domain: string;
  pageSize: number;
  source: MigrationSource<T>;
  target: MigrationTarget<T>;
  normalize(record: T): unknown;
  writeMode: 'shadow_write' | 'dual_write';
};

export type ReconciliationReport = {
  domain: string;
  scanned: number;
  missingInTarget: string[];
  mismatched: string[];
  extraInTarget: string[];
  equivalent: boolean;
  generatedAt: string;
};

export type ReadMode = 'source' | 'shadow_compare' | 'target';

export type MigrationRouting = {
  domain: string;
  readMode: ReadMode;
  writeMode: 'source_only' | 'shadow_write' | 'dual_write' | 'target_only';
  rollbackEnabled: boolean;
};
