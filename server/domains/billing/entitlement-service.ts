import { normalizedEntitlementSchema, type NormalizedEntitlement } from '../../../src/shared/schema';
import type { AuthoritativeBillingState } from '../../../server-services';
import type { BillingRepository } from '../../repositories/contracts';
import { getPlanCapabilities, type PlanCapabilities } from '../../../src/lib/planCapabilities';

export type EntitlementFeature = 'analytics' | 'customDomains' | 'studioControls' | 'premiumTemplates' | 'removeBranding';

export type EntitlementSnapshot = {
  accountId: string;
  billing: AuthoritativeBillingState;
  entitlements: NormalizedEntitlement;
  evaluatedAt: string;
};

export interface EntitlementService {
  resolve(accountId: string): Promise<EntitlementSnapshot>;
  assertEntitled(accountId: string, feature: EntitlementFeature): Promise<EntitlementSnapshot>;
  assertLimit(accountId: string, feature: 'maxLinks' | 'maxMedia' | 'maxUploadBytes', value: number): Promise<EntitlementSnapshot>;
}

const normalizeCapabilities = (capabilities: PlanCapabilities): NormalizedEntitlement => normalizedEntitlementSchema.parse({
  maxLinks: Number.isFinite(capabilities.maxLinks) ? capabilities.maxLinks : null,
  maxMedia: Number.isFinite(capabilities.maxMedia) ? capabilities.maxMedia : null,
  maxUploadBytes: capabilities.maxUploadBytes,
  premiumTemplates: capabilities.premiumTemplates,
  analytics: capabilities.analytics,
  removeBranding: capabilities.removeBranding,
  customDomains: capabilities.customDomains,
  studioControls: capabilities.studioControls,
  allowedBackgroundStyles: [...capabilities.allowedBackgroundStyles],
  allowedBlockTypes: [...capabilities.allowedBlockTypes],
  allowedDesignOptions: {
    cardRadius: [...capabilities.allowedDesignOptions.cardRadius],
    cardShadow: [...capabilities.allowedDesignOptions.cardShadow],
    borderStyle: [...capabilities.allowedDesignOptions.borderStyle]
  }
});

export function createEntitlementService(dependencies: { billing: BillingRepository | ((accountId: string) => Promise<AuthoritativeBillingState>); clock?: () => string }): EntitlementService {
  const clock = dependencies.clock ?? (() => new Date().toISOString());
  const loadBilling: (accountId: string) => Promise<AuthoritativeBillingState> = typeof dependencies.billing === 'function'
    ? dependencies.billing
    : async (accountId: string) => {
      const repository = dependencies.billing as BillingRepository;
      const state = await repository.getAuthoritativeState(accountId);
      if (!state) throw new Error('BILLING_STATE_NOT_FOUND');
      return state;
    };
  return {
    async resolve(accountId) {
      const billing = await loadBilling(accountId);
      return { accountId, billing, entitlements: normalizeCapabilities(getPlanCapabilities({ plan: billing.effectivePlan })), evaluatedAt: clock() };
    },
    async assertEntitled(accountId, feature) {
      const snapshot = await this.resolve(accountId);
      if (!snapshot.entitlements[feature]) throw new Error('ENTITLEMENT_REQUIRED');
      return snapshot;
    },
    async assertLimit(accountId, feature, value) {
      const snapshot = await this.resolve(accountId);
      const limit = snapshot.entitlements[feature];
      if (limit !== null && value > limit) throw new Error('ENTITLEMENT_LIMIT_EXCEEDED');
      return snapshot;
    }
  };
}
