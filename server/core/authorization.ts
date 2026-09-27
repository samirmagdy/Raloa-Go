export interface OwnedRecord { userId?: string; creatorId?: string; hostUserId?: string; }

export function isOwner(actorId: string, record: OwnedRecord | null | undefined): boolean {
  return Boolean(record && [record.userId, record.creatorId, record.hostUserId].includes(actorId));
}

export function assertOwner(actorId: string, record: OwnedRecord | null | undefined): void {
  if (!isOwner(actorId, record)) throw new Error('RESOURCE_NOT_FOUND');
}
