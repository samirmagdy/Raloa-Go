import crypto from 'node:crypto';
import { featureFlagKeys, featureFlagStateSchema, type FeatureFlagContext, type FeatureFlagEvaluation, type FeatureFlagKey, type FeatureFlagRepository, type FeatureFlagState } from './contracts';

const defaultState = (key: FeatureFlagKey): FeatureFlagState => ({
  key,
  enabled: false,
  killSwitch: false,
  rolloutPercentage: 0,
  tenantIds: [],
  updatedAt: new Date(0).toISOString(),
  updatedBy: 'system-default',
  version: 1
});

function bucket(key: FeatureFlagKey, subject: string): number {
  const digest = crypto.createHash('sha256').update(`${key}:${subject}`).digest();
  return digest.readUInt32BE(0) % 100;
}

export interface FeatureFlagService {
  evaluate(key: FeatureFlagKey, context?: FeatureFlagContext): Promise<FeatureFlagEvaluation>;
  isEnabled(key: FeatureFlagKey, context?: FeatureFlagContext): Promise<boolean>;
  get(key: FeatureFlagKey): Promise<FeatureFlagState>;
  list(): Promise<FeatureFlagState[]>;
  set(key: FeatureFlagKey, patch: Partial<Omit<FeatureFlagState, 'key' | 'version'>>, actor: string): Promise<FeatureFlagState>;
  kill(key: FeatureFlagKey, actor: string): Promise<FeatureFlagState>;
}

export function createFeatureFlagService(repository: FeatureFlagRepository, clock: () => string = () => new Date().toISOString()): FeatureFlagService {
  const get = async (key: FeatureFlagKey): Promise<FeatureFlagState> => (await repository.get(key)) ?? defaultState(key);

  return {
    async evaluate(key, context = {}) {
      let state: FeatureFlagState;
      try {
        state = await get(key);
      } catch {
        // A flag store outage must not accidentally enable a risky migration.
        return { key, enabled: false, reason: 'error', version: 0 };
      }
      if (state.killSwitch) return { key, enabled: false, reason: 'kill_switch', version: state.version };
      if (!state.enabled) return { key, enabled: false, reason: state.updatedAt === new Date(0).toISOString() ? 'default' : 'disabled', version: state.version };
      if (context.tenantId && state.tenantIds.includes(context.tenantId)) return { key, enabled: true, reason: 'tenant_allowlist', version: state.version };
      if (state.rolloutPercentage <= 0) return { key, enabled: false, reason: 'disabled', version: state.version };
      const subject = context.tenantId || context.siteId || context.userId;
      if (!subject) return { key, enabled: false, reason: 'no_subject', version: state.version };
      return { key, enabled: bucket(key, subject) < state.rolloutPercentage, reason: 'rollout', version: state.version };
    },
    async isEnabled(key, context) { return (await this.evaluate(key, context)).enabled; },
    get,
    async list() {
      const stored = new Map((await repository.list()).map((state) => [state.key, state]));
      return featureFlagKeys.map((key) => stored.get(key) ?? defaultState(key));
    },
    async set(key, patch, actor) {
      const current = await get(key);
      const next = featureFlagStateSchema.parse({ ...current, ...patch, key, version: current.version + 1, updatedAt: clock(), updatedBy: actor });
      await repository.save(next);
      return next;
    },
    async kill(key, actor) { return this.set(key, { killSwitch: true }, actor); }
  };
}
