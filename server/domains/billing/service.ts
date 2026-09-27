import type { PaymentProvider } from '../../core/providers';
export interface BillingService { checkout(...args: any[]): Promise<unknown>; portal(...args: any[]): Promise<unknown>; }
export function createBillingService(provider: PaymentProvider): BillingService { return { checkout: (...args) => provider.createCheckoutSession(...args), portal: (...args) => provider.createPortalSession(...args) }; }
