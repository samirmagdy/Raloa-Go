export type UiAsyncState<T> =
  | { status: 'idle' | 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string };

export type UiAction = { label: string; href?: string; disabled?: boolean };

