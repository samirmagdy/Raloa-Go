import { createCheckoutSession, createPortalSession, handleStripeWebhook, isStripeConfigured } from '../../server-services';

export const stripeAdapter = {
  name: 'stripe',
  isConfigured: isStripeConfigured,
  createCheckoutSession,
  createPortalSession,
  handleWebhook: handleStripeWebhook
};
