import type { DomainModule } from '../../core/types';
import { createBillingService, type BillingService } from './service';
export interface BillingProvider { createCheckoutSession(...args: any[]): Promise<unknown>; createPortalSession(...args: any[]): Promise<unknown>; }
export interface BillingModule extends DomainModule { provider: BillingProvider; service: BillingService; }
export function createBillingModule(provider: BillingProvider): BillingModule {
  return { name: 'billing', routes: ['/api/billing/checkout-session', '/api/billing/portal-session', '/api/webhooks/stripe'], provider, service: createBillingService(provider) };
}
