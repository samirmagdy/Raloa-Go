import { z } from 'zod';

export const featureFlagKeys = [
  'postgres.reads.v2',
  'postgres.writes.v2',
  'bookings.postgres.reads.v2',
  'bookings.postgres.writes.v2',
  'bookings.postgres.authoritative.v2',
  'commerce.postgres.reads.v2',
  'commerce.postgres.writes.v2',
  'commerce.postgres.authoritative.v2',
  'public-rendering.v2',
  'background-jobs.v2',
  'integrations.v2',
  'studio-capabilities.v2'
] as const;

export type FeatureFlagKey = typeof featureFlagKeys[number];

export const featureFlagStateSchema = z.object({
  key: z.enum(featureFlagKeys),
  enabled: z.boolean().default(false),
  killSwitch: z.boolean().default(false),
  rolloutPercentage: z.number().min(0).max(100).default(0),
  tenantIds: z.array(z.string().min(1)).default([]),
  updatedAt: z.string(),
  updatedBy: z.string().min(1),
  version: z.number().int().positive().default(1)
});

export type FeatureFlagState = z.infer<typeof featureFlagStateSchema>;

export interface FeatureFlagContext {
  tenantId?: string;
  siteId?: string;
  userId?: string;
}

export interface FeatureFlagRepository {
  get(key: FeatureFlagKey): Promise<FeatureFlagState | null>;
  list(): Promise<FeatureFlagState[]>;
  save(state: FeatureFlagState): Promise<void>;
}

export interface FeatureFlagEvaluation {
  key: FeatureFlagKey;
  enabled: boolean;
  reason: 'default' | 'disabled' | 'kill_switch' | 'tenant_allowlist' | 'rollout' | 'no_subject' | 'error';
  version: number;
}
