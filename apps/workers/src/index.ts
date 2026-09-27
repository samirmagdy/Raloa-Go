import type { TaskQueueProvider } from '@raloa/providers';

export type WorkerHandler<T = unknown> = (payload: T) => Promise<void>;

export type WorkerRuntime = {
  queue: TaskQueueProvider;
  handlers: Record<string, WorkerHandler>;
};

/** Composition root for Cloud Tasks handlers; provider and database implementations are injected. */
export function createWorkerRuntime(queue: TaskQueueProvider, handlers: Record<string, WorkerHandler>): WorkerRuntime {
  return { queue, handlers };
}

