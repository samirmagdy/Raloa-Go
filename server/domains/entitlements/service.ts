import { normalizedEntitlementSchema, type NormalizedEntitlement } from '../../../src/shared/schema';
import { getPlanCapabilities, type PlanCapabilities, type PlanTier } from '../../../src/lib/planCapabilities';
import type { AuthoritativeBillingState } from '../../../server-services';
import type { BillingRepository } from '../../repositories/contracts';
import { assertEntitlementLimit } from '../../core/domain-invariants';

export type EntitlementFeature = 'analytics' | 'customDomains' | 'studioControls' | 'premiumTemplates' | 'removeBranding' | 'googleCalendar' | 'microsoftCalendar' | 'socialIntegrations' | 'emailDelivery';
export type EntitlementSnapshot = { accountId: string; plan: PlanTier; billing: AuthoritativeBillingState; capabilities: NormalizedEntitlement; entitlements: NormalizedEntitlement; limits: Pick<NormalizedEntitlement, 'maxLinks' | 'maxMedia' | 'maxUploadBytes'>; evaluatedAt: string };
export interface EntitlementService { resolve(accountId: string): Promise<EntitlementSnapshot>; assertEntitled(accountId: string, feature: EntitlementFeature): Promise<EntitlementSnapshot>; assertLimit(accountId: string, feature: 'maxLinks' | 'maxMedia' | 'maxUploadBytes', value: number): Promise<EntitlementSnapshot>; }

/** Synchronous plan policy used by server authorization and validation paths. */
export function capabilitiesForPlan(plan: PlanTier): NormalizedEntitlement {
  const capabilities: PlanCapabilities = getPlanCapabilities({ plan });
  return normalizedEntitlementSchema.parse({
    maxLinks: Number.isFinite(capabilities.maxLinks) ? capabilities.maxLinks : null,
    maxMedia: Number.isFinite(capabilities.maxMedia) ? capabilities.maxMedia : null,
    maxUploadBytes: capabilities.maxUploadBytes,
    premiumTemplates: capabilities.premiumTemplates, analytics: capabilities.analytics,
    removeBranding: capabilities.removeBranding, customDomains: capabilities.customDomains, studioControls: capabilities.studioControls,
    allowedBackgroundStyles: [...capabilities.allowedBackgroundStyles], allowedBlockTypes: [...capabilities.allowedBlockTypes],
    allowedDesignOptions: { cardRadius: [...capabilities.allowedDesignOptions.cardRadius], cardShadow: [...capabilities.allowedDesignOptions.cardShadow], borderStyle: [...capabilities.allowedDesignOptions.borderStyle] },
    integrationAvailability: { googleCalendar: plan !== 'free', microsoftCalendar: plan !== 'free', socialIntegrations: plan !== 'free', emailDelivery: true },
    studioFeatures: { advancedControls: capabilities.studioControls, analyticsDashboard: capabilities.analytics, customDomains: capabilities.customDomains, premiumTemplates: capabilities.premiumTemplates, removeBranding: capabilities.removeBranding }
  });
}

export function createEntitlementService(dependencies: { billing: BillingRepository | ((accountId: string) => Promise<AuthoritativeBillingState>); clock?: () => string }): EntitlementService {
  const clock = dependencies.clock ?? (() => new Date().toISOString());
  const loadBilling = typeof dependencies.billing === 'function' ? dependencies.billing : async (accountId: string) => {
    const state = await (dependencies.billing as BillingRepository).getAuthoritativeState(accountId);
    if (!state) throw new Error('BILLING_STATE_NOT_FOUND');
    return state;
  };
  return {
    async resolve(accountId) {
      const billing = await loadBilling(accountId); const capabilities = capabilitiesForPlan(billing.effectivePlan);
      return { accountId, plan: billing.effectivePlan, billing, capabilities, entitlements: capabilities, limits: { maxLinks: capabilities.maxLinks, maxMedia: capabilities.maxMedia, maxUploadBytes: capabilities.maxUploadBytes }, evaluatedAt: clock() };
    },
    async assertEntitled(accountId, feature) {
      const snapshot = await this.resolve(accountId);
      if (!Boolean((snapshot.capabilities as unknown as Record<string, unknown>)[feature])) throw new Error('ENTITLEMENT_REQUIRED');
      return snapshot;
    },
    async assertLimit(accountId, feature, value) {
      const snapshot = await this.resolve(accountId); assertEntitlementLimit(snapshot.limits[feature], value); return snapshot;
    }
  };
}
