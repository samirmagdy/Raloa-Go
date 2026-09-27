export interface FirebaseStore {
  get<T>(collection: string, id: string): Promise<T | null>;
  list<T>(collection: string, filters?: Record<string, unknown>, limit?: number): Promise<T[]>;
  save<T extends Record<string, unknown>>(collection: string, id: string, value: T): Promise<void>;
  remove(collection: string, id: string): Promise<void>;
}

export interface EmailProvider {
  send(message: { to: string; subject: string; text: string; html?: string }): Promise<void>;
}

export interface CloudflareProvider {
  request(path: string, init?: RequestInit): Promise<any>;
}

export interface PaymentProvider {
  createCheckoutSession(...args: any[]): Promise<unknown>;
  createPortalSession(...args: any[]): Promise<unknown>;
}
