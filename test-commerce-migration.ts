import assert from 'node:assert/strict';
import { createCommerceMigrationRepositories } from './server/domains/commerce';
import { createFeatureFlagService, MemoryFeatureFlagRepository } from './server/infrastructure/feature-flags';
import type { InventoryRepository, OrdersRepository, ProductsRepository } from './server/repositories/contracts';

function productRepository(): ProductsRepository {
  const values = new Map<string, any>();
  return { get: async (id) => values.get(id) || null, listForSite: async () => [...values.values()], save: async (id, value) => { values.set(id, { id, ...values.get(id), ...value }); }, remove: async (id) => { values.delete(id); } };
}
function orderRepository(): OrdersRepository {
  const values = new Map<string, any>();
  return { get: async (id) => values.get(id) || null, listByCreator: async () => [...values.values()], listByCustomer: async () => [...values.values()], save: async (id, value) => { values.set(id, { id, ...values.get(id), ...value }); }, transition: async (id, transition) => { const next = { id, ...values.get(id), state: transition.to }; values.set(id, next); return next; } };
}
function inventoryRepository(): InventoryRepository {
  const values = new Map<string, any>([['product-1', { productId: 'product-1', available: 10, reserved: 0 }]]);
  return { getByProduct: async (id) => values.get(id) || null, reserve: async (id, quantity) => { const current = values.get(id); if (current.available - current.reserved < quantity) throw new Error('OUT_OF_STOCK'); current.reserved += quantity; }, release: async (id, quantity) => { values.get(id).reserved -= quantity; }, decrement: async (id, quantity) => { values.get(id).available -= quantity; } };
}

const source = { products: productRepository(), orders: orderRepository(), inventory: inventoryRepository() };
const target = { products: productRepository(), orders: orderRepository(), inventory: inventoryRepository() };
const flags = createFeatureFlagService(new MemoryFeatureFlagRepository());
const migration = createCommerceMigrationRepositories({ source, target, flags });
await migration.products.save('product-1', { name: 'Source product' }, { tenantId: 'site-1' });
assert.equal((await migration.products.get('product-1', { tenantId: 'site-1' }))?.name, 'Source product');

await flags.set('commerce.postgres.writes.v2', { enabled: true, tenantIds: ['site-1'] }, 'test');
await migration.products.save('product-2', { name: 'Dual product' }, { tenantId: 'site-1' });
assert.ok(await target.products.get('product-2'));
await flags.set('commerce.postgres.reads.v2', { enabled: true, tenantIds: ['site-1'] }, 'test');
await flags.set('commerce.postgres.authoritative.v2', { enabled: true, tenantIds: ['site-1'] }, 'test');
await target.products.save('product-2', { name: 'Target product' });
assert.equal((await migration.products.get('product-2', { tenantId: 'site-1' }))?.name, 'Target product');
await flags.kill('commerce.postgres.authoritative.v2', 'rollback');
assert.equal((await migration.products.get('product-2', { tenantId: 'site-1' }))?.name, 'Dual product');

console.log('Commerce migration routing tests passed');
