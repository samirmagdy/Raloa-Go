import type { DocumentData, Query, QueryDocumentSnapshot, DocumentSnapshot } from 'firebase-admin/firestore';
import type { AuthenticatedUser } from '../../server-services';

export type EntityId = string;

export interface Repository<T extends DocumentData = DocumentData> {
  get(id: EntityId): Promise<DocumentSnapshot<T>>;
  create(id: EntityId, value: T): Promise<void>;
  save(id: EntityId, value: Partial<T>): Promise<void>;
  delete(id: EntityId): Promise<void>;
  query(): Query<T>;
}

export interface OwnedResourceRepository<T extends DocumentData = DocumentData> extends Repository<T> {
  getOwned(userId: string, id: EntityId): Promise<DocumentSnapshot<T>>;
  listOwned(userId: string, limit?: number): Promise<QueryDocumentSnapshot<T>[]>;
}

export interface DomainContext {
  readonly actor: AuthenticatedUser | null;
  readonly isProduction: boolean;
}

export interface DomainModule {
  readonly name: string;
  readonly routes: string[];
}

export type ServiceResult<T> = { ok: true; value: T } | { ok: false; code: string; message: string };
