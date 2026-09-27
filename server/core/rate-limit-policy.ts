export type RateLimitDimension = 'ip' | 'user' | 'tenant' | 'site' | 'domain' | 'provider';

export type RateLimitPolicy = {
  limit: number;
  windowMs: number;
  dimensions: readonly RateLimitDimension[];
  rationale: string;
};

export const RATE_LIMIT_POLICIES = {
  authLogin: { limit: 5, windowMs: 10 * 60 * 1000, dimensions: ['ip', 'user'] as const, rationale: 'Slow credential attacks by account and source.' },
  authPasswordReset: { limit: 3, windowMs: 15 * 60 * 1000, dimensions: ['ip', 'user'] as const, rationale: 'Bound reset-email abuse while preserving account recovery.' },
  publicForms: { limit: 5, windowMs: 60 * 60 * 1000, dimensions: ['ip', 'site'] as const, rationale: 'Protect contact and newsletter submission endpoints.' },
  publicBooking: { limit: 10, windowMs: 60 * 60 * 1000, dimensions: ['ip', 'site'] as const, rationale: 'Protect public reservation creation and availability contention.' },
  analyticsIngestion: { limit: 120, windowMs: 60 * 60 * 1000, dimensions: ['ip', 'site'] as const, rationale: 'Bound telemetry amplification per visitor and public site.' },
  mediaUploads: { limit: 20, windowMs: 60 * 60 * 1000, dimensions: ['ip', 'user', 'site'] as const, rationale: 'Protect bytes, image processing, and storage quotas.' },
  domainVerification: { limit: 10, windowMs: 60 * 60 * 1000, dimensions: ['ip', 'user', 'site', 'domain'] as const, rationale: 'Prevent DNS/provider polling abuse.' },
  imports: { limit: 5, windowMs: 60 * 60 * 1000, dimensions: ['ip', 'user', 'site'] as const, rationale: 'Bound expensive bulk operations per tenant.' },
  checkoutCreation: { limit: 10, windowMs: 60 * 60 * 1000, dimensions: ['ip', 'site'] as const, rationale: 'Prevent payment-session and inventory reservation abuse.' },
  oauthFlows: { limit: 10, windowMs: 10 * 60 * 1000, dimensions: ['ip', 'user', 'provider'] as const, rationale: 'Prevent authorization and token-refresh initiation abuse.' }
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;
export type RateLimitIdentity = Partial<Record<RateLimitDimension, string>>;

export function buildRateLimitKey(policyName: RateLimitPolicyName, identity: RateLimitIdentity): string {
  const policy = RATE_LIMIT_POLICIES[policyName];
  const values = policy.dimensions.map((dimension) => {
    const value = identity[dimension];
    if (!value) throw new Error(`Missing rate-limit identity dimension: ${dimension}`);
    return `${dimension}=${value}`;
  });
  return `${policyName}:${values.join('|')}`;
}
