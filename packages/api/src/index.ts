import type { ApplicationContext } from '@raloa/domain';
import type { TenantContext } from '@raloa/auth';

export type ApiRequest<TBody = unknown, TParams = Record<string, string>, TQuery = Record<string, string>> = {
  body: TBody;
  params: TParams;
  query: TQuery;
  context: ApplicationContext;
  tenant?: TenantContext;
};

export type ApiResponse<T> = { data: T; requestId: string };
export type ApiError = { error: { code: string; message: string; requestId: string } };

export interface Controller<TRequest, TResult> {
  handle(request: TRequest): Promise<ApiResponse<TResult>>;
}

