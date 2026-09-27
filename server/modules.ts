import type { Firestore } from 'firebase-admin/firestore';
import { createSitesModule } from './domains/sites';
import { createPublishingModule } from './domains/publishing';
import { createAudienceModule } from './domains/audience';
import { createAnalyticsModule } from './domains/analytics';
import { createBookingsModule } from './domains/bookings';
import { createProductsModule } from './domains/products';
import { createOrdersModule } from './domains/orders';
import { createBillingModule, type BillingProvider } from './domains/billing';
import { createDomainsModule } from './domains/domains';
import { createMediaModule } from './domains/media';
import { createIntegrationsModule, type ExternalProvider } from './domains/integrations';
import { createInventoryModule } from './domains/inventory';
import { createSubscriptionsModule } from './domains/subscriptions';
import type { CloudflareProvider } from './core/providers';
import type { OAuthProviderAdapter } from './domains/integrations/oauth-service';

export function createDomainModules(db: Firestore, dependencies: {
  resolvePublicSite: (handle: string) => Promise<Record<string, unknown> | null>;
  billing: BillingProvider;
  cloudflare: CloudflareProvider;
  oauthAdapters?: readonly OAuthProviderAdapter[];
  providers?: readonly ExternalProvider[];
}) {
  return {
    sites: createSitesModule(db), publishing: createPublishingModule(dependencies.resolvePublicSite),
    audience: createAudienceModule(db), analytics: createAnalyticsModule(db), bookings: createBookingsModule(db),
    products: createProductsModule(db), orders: createOrdersModule(db), billing: createBillingModule(dependencies.billing),
    domains: createDomainsModule(db, dependencies.cloudflare), media: createMediaModule(db), integrations: createIntegrationsModule(db, dependencies.providers || [], dependencies.oauthAdapters || []),
    inventory: createInventoryModule(db), subscriptions: createSubscriptionsModule(db)
  };
}
