import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../../../server-services';
import type { BillingService } from './service';
import type { AuditService } from '../../audit/service';
import {
  AuthenticationError,
  ValidationError,
  ConflictError,
  NotFoundError,
  DependencyUnavailableError
} from '../../core/errors';

export function createBillingController(
  service: BillingService,
  authenticate: (request: Request) => Promise<AuthenticatedUser | null>,
  audit?: AuditService
) {
  return {
    async checkout(request: Request, response: Response) {
      const user = await authenticate(request);
      if (!user) throw new AuthenticationError('Authentication required');
      const plan = request.body?.plan === 'studio' || request.body?.plan === 'business' ? 'studio' : request.body?.plan;
      if (plan !== 'pro' && plan !== 'studio') throw new ValidationError('A paid plan is required');
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
        if (message === 'STRIPE_SUBSCRIPTION_EXISTS') {
          throw new ConflictError('An active subscription already exists. Manage it from Billing Portal.', 'STRIPE_SUBSCRIPTION_EXISTS');
        }
        throw new DependencyUnavailableError('Checkout is temporarily unavailable', message.includes('NOT_CONFIGURED') ? 'SERVICE_NOT_CONFIGURED' : 'CHECKOUT_UNAVAILABLE');
      }
    },
    async portal(request: Request, response: Response) {
      const user = await authenticate(request);
      if (!user) throw new AuthenticationError('Authentication required');
      try {
        const url = await service.portal(user.uid);
        await audit?.recordBestEffort({ actorUserId: user.uid, resourceType: 'billing', resourceId: user.uid, action: 'billing.portal_opened', requestId: typeof request.headers['x-request-id'] === 'string' ? request.headers['x-request-id'] : undefined });
        return response.status(200).json({ url });
      } catch (error) {
        console.error('[Billing portal]', error);
        const message = error instanceof Error ? error.message : 'Billing portal unavailable';
        const notFound = message.includes('NOT_FOUND');
        if (notFound) {
          throw new NotFoundError('Billing customer was not found', 'CUSTOMER_NOT_FOUND');
        }
        throw new DependencyUnavailableError('Billing portal is temporarily unavailable', 'BILLING_PORTAL_UNAVAILABLE');
      }
    }
  };
}
