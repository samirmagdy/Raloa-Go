import type { Express, Request, Response } from 'express';

export interface HealthControllerDependencies {
  isAdminConfigured(): boolean;
  isStripeConfigured(): boolean;
  getPriceId(plan: 'pro' | 'studio', yearly: boolean): string | null;
  getCloudflareConfig(): unknown;
  authSessionSecret: string;
  databaseHealthCheck(): Promise<void>;
  environment?: string;
  serviceRole?: string;
  releaseId?: string;
}

export function registerHealthRoutes(app: Express, dependencies: HealthControllerDependencies): void {
  app.get('/api/health', (_req: Request, res: Response) => {
    return res.status(200).json({
      status: 'ok',
      role: dependencies.serviceRole || 'edge',
      version: dependencies.releaseId || 'local'
    });
  });

  app.get('/api/readiness', async (_req: Request, res: Response) => {
    if (dependencies.environment !== 'production') {
      return res.status(200).json({ status: 'ready', environment: 'development' });
    }

    const checks: Record<string, boolean> = {
      firebaseAdmin: dependencies.isAdminConfigured(),
      stripe: dependencies.isStripeConfigured()
        && Boolean(dependencies.getPriceId('pro', false))
        && Boolean(dependencies.getPriceId('pro', true))
        && Boolean(dependencies.getPriceId('studio', false))
        && Boolean(dependencies.getPriceId('studio', true)),
      stripeWebhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      appUrl: /^https:\/\//.test(process.env.APP_URL || ''),
      authSessionSecret: dependencies.authSessionSecret.length >= 32,
      cloudflare: Boolean(dependencies.getCloudflareConfig())
    };

    if (checks.firebaseAdmin) {
      try {
        await dependencies.databaseHealthCheck();
      } catch {
        checks.firebaseAdmin = false;
      }
    }

    const ready = Object.values(checks).every(Boolean);
    return res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', checks });
  });
}
