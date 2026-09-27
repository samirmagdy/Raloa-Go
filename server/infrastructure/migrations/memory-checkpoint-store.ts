import type { MigrationCheckpoint, MigrationCheckpointStore } from './types';

export class MemoryMigrationCheckpointStore implements MigrationCheckpointStore {
  private readonly values = new Map<string, MigrationCheckpoint>();

  async get(domain: string): Promise<MigrationCheckpoint | null> {
    return this.values.get(domain) ?? null;
  }

  async save(checkpoint: MigrationCheckpoint): Promise<void> {
    this.values.set(checkpoint.domain, checkpoint);
  }
}
