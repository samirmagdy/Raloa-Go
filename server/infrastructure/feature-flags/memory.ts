import type { FeatureFlagKey, FeatureFlagRepository, FeatureFlagState } from './contracts';

export class MemoryFeatureFlagRepository implements FeatureFlagRepository {
  private readonly states = new Map<FeatureFlagKey, FeatureFlagState>();

  constructor(initial: FeatureFlagState[] = []) {
    for (const state of initial) this.states.set(state.key, state);
  }

  async get(key: FeatureFlagKey): Promise<FeatureFlagState | null> {
    return this.states.get(key) ?? null;
  }

  async list(): Promise<FeatureFlagState[]> {
    return [...this.states.values()];
  }

  async save(state: FeatureFlagState): Promise<void> {
    this.states.set(state.key, state);
  }
}
