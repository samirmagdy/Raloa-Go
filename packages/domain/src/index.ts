export type EntityId = string;
export type TenantId = string;
export type SiteId = string;

export type DomainErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'EXTERNAL_PROVIDER_ERROR';

export class DomainError extends Error {
  constructor(public readonly code: DomainErrorCode, message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
  }
}

export type Clock = { now(): Date };

export type DomainEvent<TName extends string = string, TPayload = unknown> = {
  id: EntityId;
  name: TName;
  version: 1;
  aggregateType: string;
  aggregateId: EntityId;
  tenantId?: TenantId;
  occurredAt: string;
  payload: TPayload;
};

export type ApplicationContext = {
  actorId?: EntityId;
  tenantId?: TenantId;
  requestId: string;
};

export interface UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
}

export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
}

export interface ApplicationService<TCommand, TResult> {
  execute(command: TCommand, context: ApplicationContext): Promise<TResult>;
}

