import { normalizedEntitlementSchema, type NormalizedEntitlement } from '../../../src/shared/schema';
import type { AuthoritativeBillingState } from '../../../server-services';
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

export function createEntitlementService(dependencies: { billing: (accountId: string) => Promise<AuthoritativeBillingState>; clock?: () => string }): EntitlementService {
  const clock = dependencies.clock ?? (() => new Date().toISOString());
  return {
    async resolve(accountId) {
      const billing = await dependencies.billing(accountId);
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
