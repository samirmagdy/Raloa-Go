import crypto from 'node:crypto';

export type MigrationRecord = { id: string; ownerId?: string | null; payload: Record<string, unknown> };
export type MigrationDifference = { id: string; kind: 'missing_target' | 'unexpected_target' | 'ownership_mismatch' | 'semantic_mismatch'; details?: string[] };

export function buildMigrationPlan(source: MigrationRecord[], target: MigrationRecord[], normalize: (payload: Record<string, unknown>) => Record<string, unknown> = (payload) => payload) {
  const sourceById = new Map(source.map((record) => [record.id, record]));
  const targetById = new Map(target.map((record) => [record.id, record]));
  const differences: MigrationDifference[] = [];
  for (const record of source) {
    const targetRecord = targetById.get(record.id);
    if (!targetRecord) { differences.push({ id: record.id, kind: 'missing_target' }); continue; }
    if ((record.ownerId || null) !== (targetRecord.ownerId || null)) differences.push({ id: record.id, kind: 'ownership_mismatch' });
    if (JSON.stringify(normalize(record.payload)) !== JSON.stringify(normalize(targetRecord.payload))) differences.push({ id: record.id, kind: 'semantic_mismatch' });
  }
  for (const record of target) if (!sourceById.has(record.id)) differences.push({ id: record.id, kind: 'unexpected_target' });
  return { sourceCount: source.length, targetCount: target.length, differences, canCutover: differences.length === 0 };
}

export function migrationReportHash(report: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(report)).digest('hex');
}

export function isImmutableArchiveUri(value: string): boolean {
  try {
    const uri = new URL(value);
    return ['gs:', 's3:', 'r2:', 'https:'].includes(uri.protocol) && uri.pathname.length > 1;
  } catch {
    return false;
  }
}
