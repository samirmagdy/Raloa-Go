import type { DocumentSnapshot } from 'firebase-admin/firestore';
import type { OwnedResourceRepository } from './types';

export async function ownedDocument<T extends Record<string, unknown>>(
  repository: OwnedResourceRepository<T>, userId: string, id: string
): Promise<DocumentSnapshot<T> | null> {
  const snapshot = await repository.getOwned(userId, id);
  return snapshot.exists ? snapshot : null;
}

export function ownsDocument(snapshot: { data(): Record<string, unknown> | undefined } | null, userId: string): boolean {
  return snapshot?.data()?.userId === userId;
}
