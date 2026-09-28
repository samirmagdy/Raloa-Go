import { describe, expect, it } from 'vitest';
import { loadProductionSecrets } from '../../server/infrastructure/secrets/provider';

describe('secret startup', () => {
  it('does not construct a Google Secret Manager client when disabled', async () => {
    await expect(loadProductionSecrets({ SECRET_MANAGER_ENABLED: 'false' })).resolves.toBeUndefined();
  });
});
