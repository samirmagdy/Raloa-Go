import type {
  MigrationCheckpoint,
  MigrationCheckpointStore,
  MigrationPage,
  MigrationPlan,
  MigrationRouting,
  MigrationPhase,
  ReconciliationReport
} from './types';

const now = (): string => new Date().toISOString();

const initialCheckpoint = (domain: string): MigrationCheckpoint => ({
  domain,
  phase: 'planned',
  cursor: null,
  scanned: 0,
  written: 0,
  mismatches: 0,
  lastError: null,
  updatedAt: now()
});

const allowedTransitions: Record<MigrationPhase, MigrationPhase[]> = {
  planned: ['backfilling', 'rolled_back'],
  backfilling: ['backfilling', 'reconciling', 'rolled_back'],
  reconciling: ['reconciling', 'shadow_read', 'rolled_back'],
  shadow_read: ['shadow_read', 'dual_write', 'rolled_back'],
  dual_write: ['dual_write', 'target_authoritative', 'rolled_back'],
  target_authoritative: ['completed', 'rolled_back'],
  rolled_back: ['backfilling', 'shadow_read', 'dual_write'],
  completed: []
};

export class MigrationRunner<T> {
  constructor(private readonly checkpoints: MigrationCheckpointStore) {}

  async getCheckpoint(domain: string): Promise<MigrationCheckpoint> {
    return (await this.checkpoints.get(domain)) ?? initialCheckpoint(domain);
  }

  async transition(domain: string, phase: MigrationPhase): Promise<MigrationCheckpoint> {
    const current = await this.getCheckpoint(domain);
    if (!allowedTransitions[current.phase].includes(phase)) {
      throw new Error(`Invalid migration transition ${current.phase} -> ${phase} for ${domain}`);
    }
    const next = { ...current, phase, lastError: null, updatedAt: now() };
    await this.checkpoints.save(next);
    return next;
  }

  async backfill(plan: MigrationPlan<T>): Promise<MigrationCheckpoint> {
    let checkpoint = await this.getCheckpoint(plan.domain);
    if (checkpoint.phase === 'planned' || checkpoint.phase === 'rolled_back') {
      checkpoint = await this.transition(plan.domain, 'backfilling');
    } else if (checkpoint.phase !== 'backfilling') {
      throw new Error(`Cannot backfill ${plan.domain} from ${checkpoint.phase}`);
    }

    try {
      const page: MigrationPage<T> = await plan.source.listPage(checkpoint.cursor, plan.pageSize);
      if (page.records.length > 0) {
        await plan.target.upsert(page.records);
      }
      checkpoint = {
        ...checkpoint,
        cursor: page.nextCursor,
        scanned: checkpoint.scanned + page.records.length,
        written: checkpoint.written + page.records.length,
        updatedAt: now()
      };
      await this.checkpoints.save(checkpoint);
      if (page.nextCursor === null) {
        await this.transition(plan.domain, 'reconciling');
      }
      return checkpoint;
    } catch (error) {
      const failed = { ...checkpoint, lastError: error instanceof Error ? error.message : String(error), updatedAt: now() };
      await this.checkpoints.save(failed);
      throw error;
    }
  }

  async reconcile(plan: MigrationPlan<T>): Promise<ReconciliationReport> {
    let checkpoint = await this.getCheckpoint(plan.domain);
    if (checkpoint.phase === 'backfilling') {
      throw new Error(`Cannot reconcile ${plan.domain} before backfill completes`);
    }
    if (checkpoint.phase === 'planned' || checkpoint.phase === 'rolled_back') {
      checkpoint = await this.transition(plan.domain, 'reconciling');
    }

    const missingInTarget: string[] = [];
    const mismatched: string[] = [];
    const sourceIds = new Set<string>();
    let cursor: string | null = null;
    let scanned = 0;
    do {
      const page = await plan.source.listPage(cursor, plan.pageSize);
      for (const sourceRecord of page.records) {
        const id = plan.source.getId(sourceRecord);
        sourceIds.add(id);
        const targetRecord = await plan.target.get(id);
        if (!targetRecord) {
          missingInTarget.push(id);
        } else if (JSON.stringify(plan.normalize(sourceRecord)) !== JSON.stringify(plan.normalize(targetRecord))) {
          mismatched.push(id);
        }
      }
      scanned += page.records.length;
      cursor = page.nextCursor;
    } while (cursor !== null);

    const extraInTarget = (await plan.target.listIds()).filter((id) => !sourceIds.has(id));
    const report: ReconciliationReport = {
      domain: plan.domain,
      scanned,
      missingInTarget,
      mismatched,
      extraInTarget,
      equivalent: missingInTarget.length === 0 && mismatched.length === 0 && extraInTarget.length === 0,
      generatedAt: now()
    };
    checkpoint = {
      ...checkpoint,
      phase: report.equivalent ? 'shadow_read' : 'reconciling',
      mismatches: missingInTarget.length + mismatched.length + extraInTarget.length,
      updatedAt: now()
    };
    await this.checkpoints.save(checkpoint);
    return report;
  }

  async enableDualWrite(domain: string): Promise<MigrationCheckpoint> {
    return this.transition(domain, 'dual_write');
  }

  async switchToTarget(domain: string): Promise<MigrationCheckpoint> {
    const checkpoint = await this.getCheckpoint(domain);
    if (checkpoint.phase !== 'dual_write') {
      throw new Error(`Cannot switch ${domain} to target from ${checkpoint.phase}`);
    }
    if (checkpoint.mismatches !== 0) {
      throw new Error(`Cannot switch ${domain} with ${checkpoint.mismatches} reconciliation mismatches`);
    }
    return this.transition(domain, 'target_authoritative');
  }

  async rollback(domain: string): Promise<MigrationCheckpoint> {
    const checkpoint = await this.getCheckpoint(domain);
    if (!checkpoint.phase || checkpoint.phase === 'completed') {
      throw new Error(`Cannot roll back completed migration ${domain}`);
    }
    return this.transition(domain, 'rolled_back');
  }
}

export const routingForPhase = (domain: string, phase: MigrationPhase): MigrationRouting => {
  if (phase === 'target_authoritative' || phase === 'completed') {
    return { domain, readMode: 'target', writeMode: 'target_only', rollbackEnabled: true };
  }
  if (phase === 'dual_write') {
    return { domain, readMode: 'shadow_compare', writeMode: 'dual_write', rollbackEnabled: true };
  }
  if (phase === 'shadow_read' || phase === 'reconciling') {
    return { domain, readMode: 'shadow_compare', writeMode: 'shadow_write', rollbackEnabled: true };
  }
  return { domain, readMode: 'source', writeMode: 'source_only', rollbackEnabled: phase !== 'planned' };
};
