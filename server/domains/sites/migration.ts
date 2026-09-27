import { createHash } from 'node:crypto';

export type SiteProjection = {
  legacySiteId: string;
  handle: string;
  isPublished: boolean;
  revision: number;
  contentHash: string;
};

export function normalizeSiteProjection(input: { id?: unknown; legacySiteId?: unknown; username?: unknown; handle?: unknown; isPublished?: unknown; revision?: unknown; content?: unknown }): SiteProjection {
  const content = input.content && typeof input.content === 'object' ? input.content : input;
  const serialized = JSON.stringify(content, Object.keys(content as Record<string, unknown>).sort());
  return {
    legacySiteId: String(input.legacySiteId || input.id || ''),
    handle: String(input.handle || input.username || '').trim().toLowerCase(),
    isPublished: input.isPublished === true,
    revision: Number.isFinite(Number(input.revision)) ? Number(input.revision) : 0,
    contentHash: createHash('sha256').update(serialized).digest('hex'),
  };
}

export function reconcileSiteProjection(expected: SiteProjection, actual: SiteProjection): { equal: boolean; differences: string[] } {
  const differences: string[] = [];
  for (const key of ['legacySiteId', 'handle', 'isPublished', 'revision', 'contentHash'] as const) {
    if (expected[key] !== actual[key]) differences.push(key);
  }
  return { equal: differences.length === 0, differences };
}

