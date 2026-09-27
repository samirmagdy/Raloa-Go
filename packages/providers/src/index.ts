export type ProviderResult<T> = { value: T; providerRequestId?: string };

export type StripeCheckoutRequest = { orderId: string; amountMinor: number; currency: string; idempotencyKey: string };
export type StripeCheckout = { id: string; url?: string; status: 'open' | 'complete' | 'expired' };
export interface PaymentsProvider {
  createCheckout(request: StripeCheckoutRequest): Promise<ProviderResult<StripeCheckout>>;
  getCheckout(id: string): Promise<ProviderResult<StripeCheckout>>;
}

export type ObjectUpload = { key: string; contentType: string; bytes: Uint8Array; metadata?: Record<string, string> };
export interface ObjectStorageProvider {
  put(upload: ObjectUpload): Promise<ProviderResult<{ key: string; url?: string }>>;
  remove(key: string): Promise<void>;
  signedUrl(key: string, expiresInSeconds: number): Promise<string>;
}

export interface DomainProvider {
  provision(hostname: string, siteId: string): Promise<ProviderResult<{ providerId: string }>>;
  verify(hostname: string): Promise<ProviderResult<{ verified: boolean; certificateReady: boolean }>>;
  remove(providerId: string): Promise<void>;
}

export interface CalendarProvider {
  createEvent(input: { externalCalendarId: string; startsAt: string; endsAt: string; title: string }): Promise<ProviderResult<{ eventId: string }>>;
  cancelEvent(eventId: string): Promise<void>;
}

export interface EmailProvider {
  send(input: { to: string; template: string; data: Record<string, unknown>; idempotencyKey: string }): Promise<ProviderResult<{ messageId: string }>>;
}

export interface TaskQueueProvider {
  enqueue<T>(type: string, payload: T, options: { idempotencyKey: string; delaySeconds?: number }): Promise<ProviderResult<{ taskId: string }>>;
}

export interface ProviderBundle {
  payments: PaymentsProvider;
  storage: ObjectStorageProvider;
  domains: DomainProvider;
  calendar: CalendarProvider;
  email: EmailProvider;
  tasks: TaskQueueProvider;
}

