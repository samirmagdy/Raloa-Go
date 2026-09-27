import type { FeatureFlagContext, FeatureFlagKey, FeatureFlagService } from '../feature-flags';

export type StranglerWriteMode = 'source' | 'dual' | 'target';

export interface StranglerMismatch {
  operation: 'read';
  flag: FeatureFlagKey;
  context: FeatureFlagContext;
}

export interface StranglerRoute<TInput, TRecord> {
  source: {
    read(input: TInput): Promise<TRecord | null>;
    write(input: TInput): Promise<void>;
  };
  target: {
    read(input: TInput): Promise<TRecord | null>;
    write(input: TInput): Promise<void>;
  };
  normalize(record: TRecord | null): unknown;
  featureFlags: FeatureFlagService;
  readFlag: FeatureFlagKey;
  writeFlag: FeatureFlagKey;
  onMismatch?: (details: StranglerMismatch) => void | Promise<void>;
}

export interface StranglerRouter<TInput, TRecord> {
  read(input: TInput, context: FeatureFlagContext): Promise<TRecord | null>;
  shadowRead(input: TInput, context: FeatureFlagContext): Promise<TRecord | null>;
  write(input: TInput, context: FeatureFlagContext, mode?: StranglerWriteMode): Promise<void>;
}

function equivalent<T>(normalize: (record: T | null) => unknown, left: T | null, right: T | null): boolean {
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

export function createStranglerRouter<TInput, TRecord>(route: StranglerRoute<TInput, TRecord>): StranglerRouter<TInput, TRecord> {
  const compare = async (input: TInput, context: FeatureFlagContext, sourceRecord: TRecord | null): Promise<void> => {
    const targetRecord = await route.target.read(input);
    if (!equivalent(route.normalize, sourceRecord, targetRecord)) {
      await route.onMismatch?.({ operation: 'read', flag: route.readFlag, context });
    }
  };

  return {
    async read(input, context) {
      return (await route.featureFlags.isEnabled(route.readFlag, context))
        ? route.target.read(input)
        : route.source.read(input);
    },
    async shadowRead(input, context) {
      const sourceRecord = await route.source.read(input);
      await compare(input, context, sourceRecord);
      return sourceRecord;
    },
    async write(input, context, mode = 'source') {
      const targetEnabled = await route.featureFlags.isEnabled(route.writeFlag, context);
      if (mode === 'target' && targetEnabled) return route.target.write(input);
      if (mode === 'dual' && targetEnabled) {
        await route.source.write(input);
        await route.target.write(input);
        return;
      }
      await route.source.write(input);
    }
  };
}
