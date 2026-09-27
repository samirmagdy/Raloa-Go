import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../../../server-services';
import type { BillingService } from './service';
import type { AuditService } from '../../audit/service';

export function createBillingController(
  service: BillingService,
  authenticate: (request: Request) => Promise<AuthenticatedUser | null>,
  audit?: AuditService
) {
  return {
    async checkout(request: Request, response: Response) {
      const user = await authenticate(request);
      if (!user) return response.status(401).json({ error: 'Authentication required' });
      const plan = request.body?.plan === 'studio' || request.body?.plan === 'business' ? 'studio' : request.body?.plan;
      if (plan !== 'pro' && plan !== 'studio') return response.status(400).json({ error: 'A paid plan is required' });
      const isYearly = request.body?.isYearly === true;
      const idempotencyKey = typeof request.headers['idempotency-key'] === 'string' ? request.headers['idempotency-key'] : undefined;
      try {
        const url = await service.checkout(user, plan, isYearly, idempotencyKey);
        await audit?.recordBestEffort({ actorUserId: user.uid, resourceType: 'billing', resourceId: user.uid, action: 'billing.checkout_created', requestId: typeof request.headers['x-request-id'] === 'string' ? request.headers['x-request-id'] : undefined, metadata: { plan, isYearly } });
        return response.status(200).json({ url });
      } catch (error) {
        console.error('[Billing checkout]', error);
        const message = error instanceof Error ? error.message : 'Checkout unavailable';
        console.error('[Billing checkout detail]', message);
        if (message === 'STRIPE_SUBSCRIPTION_EXISTS') return response.status(409).json({ error: 'An active subscription already exists. Manage it from Billing Portal.' });
        return response.status(message.includes('NOT_CONFIGURED') ? 503 : 502).json({ error: 'Checkout is temporarily unavailable' });
      }
    },
    async portal(request: Request, response: Response) {
      const user = await authenticate(request);
      if (!user) return response.status(401).json({ error: 'Authentication required' });
      try {
        const url = await service.portal(user.uid);
        await audit?.recordBestEffort({ actorUserId: user.uid, resourceType: 'billing', resourceId: user.uid, action: 'billing.portal_opened', requestId: typeof request.headers['x-request-id'] === 'string' ? request.headers['x-request-id'] : undefined });
        return response.status(200).json({ url });
      } catch (error) {
        console.error('[Billing portal]', error);
        const message = error instanceof Error ? error.message : 'Billing portal unavailable';
        const notFound = message.includes('NOT_FOUND');
        return response.status(notFound ? 404 : 503).json({ error: notFound ? 'Billing customer was not found' : 'Billing portal is temporarily unavailable' });
      }
    }
  };
}
