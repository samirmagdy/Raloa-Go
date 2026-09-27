import type { DomainModule } from '../../core/types';
export interface BillingProvider { createCheckoutSession(...args: any[]): Promise<unknown>; createPortalSession(...args: any[]): Promise<unknown>; }
export interface BillingModule extends DomainModule { provider: BillingProvider; }
export function createBillingModule(provider: BillingProvider): BillingModule {
  return { name: 'billing', routes: ['/api/billing/checkout-session', '/api/billing/portal-session', '/api/webhooks/stripe'], provider };
}
