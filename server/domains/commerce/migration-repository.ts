import type { FeatureFlagContext, FeatureFlagService } from '../../infrastructure/feature-flags';
import type { InventoryRepository, OrderRecord, OrdersRepository, OrderTransitionRecord, ProductRecord, ProductsRepository } from '../../repositories/contracts';

export interface CommerceMigrationObserver {
  mismatch?(domain: 'products' | 'orders' | 'inventory', context: FeatureFlagContext, id?: string): void | Promise<void>;
  writeFailure?(domain: 'products' | 'orders' | 'inventory', context: FeatureFlagContext, error: unknown): void | Promise<void>;
}

export function createCommerceMigrationRepositories(dependencies: {
  source: { products: ProductsRepository; orders: OrdersRepository; inventory: InventoryRepository };
  target: { products: ProductsRepository; orders: OrdersRepository; inventory: InventoryRepository };
  flags: FeatureFlagService;
  observer?: CommerceMigrationObserver;
}) {
  const { source, target, flags, observer = {} } = dependencies;
  const enabled = (context: FeatureFlagContext, suffix: 'reads' | 'writes' | 'authoritative') => flags.isEnabled(`commerce.postgres.${suffix}.v2`, context);
  const write = async <T>(domain: 'products' | 'orders' | 'inventory', context: FeatureFlagContext, sourceWrite: () => Promise<T>, targetWrite: () => Promise<T>): Promise<T | undefined> => {
    if (await enabled(context, 'authoritative')) return targetWrite();
    if (!(await enabled(context, 'writes'))) return sourceWrite();
    const result = await sourceWrite();
    try { await targetWrite(); } catch (error) { await observer.writeFailure?.(domain, context, error); }
    return result;
  };
  return {
    products: {
      async get(id: string, context: FeatureFlagContext): Promise<ProductRecord | null> {
        if (await enabled(context, 'authoritative') && await enabled(context, 'reads')) return target.products.get(id);
        const record = await source.products.get(id);
        if (await enabled(context, 'reads')) { const targetRecord = await target.products.get(id); if (JSON.stringify(record) !== JSON.stringify(targetRecord)) await observer.mismatch?.('products', context, id); }
        return record;
      },
      listForSite: (siteId: string, creatorId: string | undefined, limit: number, context: FeatureFlagContext) => enabled(context, 'authoritative').then((authoritative) => authoritative && flags.isEnabled('commerce.postgres.reads.v2', context)).then((useTarget) => useTarget ? target.products.listForSite(siteId, creatorId, limit) : source.products.listForSite(siteId, creatorId, limit)),
      save: (id: string, product: Partial<ProductRecord>, context: FeatureFlagContext) => write('products', context, () => source.products.save(id, product), () => target.products.save(id, product)),
      remove: (id: string, context: FeatureFlagContext) => write('products', context, () => source.products.remove(id), () => target.products.remove(id))
    },
    orders: {
      async get(id: string, context: FeatureFlagContext): Promise<OrderRecord | null> {
        if (await enabled(context, 'authoritative') && await enabled(context, 'reads')) return target.orders.get(id);
        const record = await source.orders.get(id);
        if (await enabled(context, 'reads')) { const targetRecord = await target.orders.get(id); if (JSON.stringify(record) !== JSON.stringify(targetRecord)) await observer.mismatch?.('orders', context, id); }
        return record;
      },
      listByCreator: (creatorId: string, limit: number, context: FeatureFlagContext) => enabled(context, 'authoritative').then((authoritative) => authoritative && flags.isEnabled('commerce.postgres.reads.v2', context)).then((useTarget) => useTarget ? target.orders.listByCreator(creatorId, limit) : source.orders.listByCreator(creatorId, limit)),
      listByCustomer: (email: string, limit: number, context: FeatureFlagContext) => enabled(context, 'authoritative').then((authoritative) => authoritative && flags.isEnabled('commerce.postgres.reads.v2', context)).then((useTarget) => useTarget ? target.orders.listByCustomer(email, limit) : source.orders.listByCustomer(email, limit)),
      save: (id: string, order: Partial<OrderRecord>, context: FeatureFlagContext) => write('orders', context, () => source.orders.save(id, order), () => target.orders.save(id, order)),
      transition: async (id: string, transition: OrderTransitionRecord, context: FeatureFlagContext) => {
        if (await enabled(context, 'authoritative')) return target.orders.transition(id, transition);
        if (!(await enabled(context, 'writes'))) return source.orders.transition(id, transition);
        const result = await source.orders.transition(id, transition);
        try { await target.orders.transition(id, transition); } catch (error) { await observer.writeFailure?.('orders', context, error); }
        return result;
      }
    },
    inventory: {
      get: (productId: string, context: FeatureFlagContext) => enabled(context, 'authoritative').then((authoritative) => authoritative && flags.isEnabled('commerce.postgres.reads.v2', context)).then((useTarget) => useTarget ? target.inventory.getByProduct(productId) : source.inventory.getByProduct(productId)),
      reserve: (productId: string, quantity: number, context: FeatureFlagContext) => write('inventory', context, () => source.inventory.reserve(productId, quantity), () => target.inventory.reserve(productId, quantity)),
      release: (productId: string, quantity: number, context: FeatureFlagContext) => write('inventory', context, () => source.inventory.release(productId, quantity), () => target.inventory.release(productId, quantity)),
      decrement: (productId: string, quantity: number, context: FeatureFlagContext) => write('inventory', context, () => source.inventory.decrement(productId, quantity), () => target.inventory.decrement(productId, quantity))
    }
  };
}
