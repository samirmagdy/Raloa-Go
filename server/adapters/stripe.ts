import { createCheckoutSession, createPortalSession, handleStripeWebhook, isStripeConfigured } from '../../server-services';

export interface StripeAdapterDependencies {
  isConfigured(): boolean;
  createCheckoutSession(...args: any[]): Promise<unknown>;
  createPortalSession(...args: any[]): Promise<unknown>;
  handleWebhook(...args: any[]): Promise<unknown>;
}

export function createStripeAdapter(dependencies: StripeAdapterDependencies) {
  return { name: 'stripe', ...dependencies };
}

export const stripeAdapter = createStripeAdapter({ isConfigured: isStripeConfigured, createCheckoutSession, createPortalSession, handleWebhook: handleStripeWebhook });
