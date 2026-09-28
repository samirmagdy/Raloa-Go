import type { Pool, PoolClient } from 'pg';
import { withPostgresTransaction } from './client';
import { assertOrderTransition, legacyOrderState, type OrderState } from '../../domains/orders/state-machine';
import { assertPositiveQuantity } from '../../core/domain-invariants';
import type { FulfillmentRecord, FulfillmentsRepository, InventoryRecord, OrderRecord, OrdersRepository, OrderTransitionRecord, PaymentRecord, PaymentsRepository, ProductRecord, ProductsRepository, TransactionalInventoryRepository } from '../../repositories/contracts';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const asUuid = (value: unknown, field: string): string => { const candidate = String(value || ''); if (!uuidPattern.test(candidate)) throw new Error(`COMMERCE_TARGET_${field.toUpperCase()}_MAPPING_REQUIRED`); return candidate; };

function productRow(row: Record<string, unknown>): ProductRecord {
  const payload = row.legacy_payload && typeof row.legacy_payload === 'object' ? row.legacy_payload as Record<string, unknown> : {};
  return { ...payload, id: String(row.legacy_product_id || row.id), creatorId: String(row.external_auth_id || row.creator_user_id), siteId: String(row.legacy_site_id || row.site_id), name: String(row.name), description: row.description, priceMinor: Number(row.price_minor), currency: String(row.currency).toLowerCase(), active: row.active === true, inventory: row.on_hand === null || row.on_hand === undefined ? null : Number(row.on_hand), inventoryReserved: Number(row.reserved || 0), stripeProductId: row.provider_product_id, stripePriceId: row.provider_price_id, createdAt: new Date(String(row.created_at)).toISOString(), updatedAt: new Date(String(row.updated_at)).toISOString() };
}

async function resolveSiteUser(client: Pool | PoolClient, siteValue: unknown, userValue: unknown): Promise<{ siteId: string; userId: string }> {
  const site = await client.query('SELECT id FROM sites WHERE id::text = $1 OR legacy_site_id = $1 LIMIT 1', [String(siteValue || '')]);
  const user = await client.query('SELECT id FROM app_users WHERE id::text = $1 OR external_auth_id = $1 LIMIT 1', [String(userValue || '')]);
  if (!site.rows[0]) throw new Error('COMMERCE_TARGET_SITE_MAPPING_REQUIRED');
  if (!user.rows[0]) throw new Error('COMMERCE_TARGET_USER_MAPPING_REQUIRED');
  return { siteId: String(site.rows[0].id), userId: String(user.rows[0].id) };
}

export function createPostgresProductsRepository(pool: Pool): ProductsRepository {
  const get = async (id: string, client: Pool | PoolClient = pool): Promise<ProductRecord | null> => {
    const result = await client.query(`SELECT p.*, m.external_auth_id, s.legacy_site_id, i.on_hand, i.reserved FROM products p LEFT JOIN app_users m ON m.id = p.creator_user_id LEFT JOIN sites s ON s.id = p.site_id LEFT JOIN product_variants v ON v.product_id = p.id LEFT JOIN inventory i ON i.variant_id = v.id WHERE p.id::text = $1 OR p.legacy_product_id = $1 LIMIT 1`, [id]);
    return result.rows[0] ? productRow(result.rows[0]) : null;
  };
  return {
    get,
    async listForSite(siteId, creatorId, limit = 100) {
      const resolved = await resolveSiteUser(pool, siteId, creatorId || '');
      const values: unknown[] = [resolved.siteId];
      let where = 'p.site_id = $1';
      if (creatorId) { values.push(resolved.userId); where += ' AND p.creator_user_id = $2'; }
      values.push(Math.min(Math.max(limit, 1), 500));
      const result = await pool.query(`SELECT p.*, m.external_auth_id, s.legacy_site_id, i.on_hand, i.reserved FROM products p LEFT JOIN app_users m ON m.id = p.creator_user_id LEFT JOIN sites s ON s.id = p.site_id LEFT JOIN product_variants v ON v.product_id = p.id LEFT JOIN inventory i ON i.variant_id = v.id WHERE ${where} ORDER BY p.created_at DESC, p.id DESC LIMIT $${values.length}`, values);
      return result.rows.map(productRow);
    },
    async save(id, product) {
      await withPostgresTransaction(pool, async (client) => {
        const existing = await get(id, client);
        if (!existing) {
          const owner = await resolveSiteUser(client, product.siteId, product.creatorId);
          const productId = uuidPattern.test(id) ? id : cryptoRandomUuid();
          const inserted = await client.query<{ id: string }>(`INSERT INTO products (id, legacy_product_id, site_id, creator_user_id, slug, name, description, currency, price_minor, active, provider_product_id, provider_price_id, legacy_payload) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb) RETURNING id`, [productId, uuidPattern.test(id) ? null : id, owner.siteId, owner.userId, String(product.slug || product.name || id).toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 64), String(product.name || ''), product.description ? String(product.description) : null, String(product.currency || 'usd').toUpperCase(), Number(product.priceMinor || 0), product.active !== false, product.stripeProductId || null, product.stripePriceId || null, JSON.stringify(product)]);
          const canonicalId = inserted.rows[0].id;
          await client.query(`INSERT INTO product_variants (product_id, sku, name, price_minor) VALUES ($1, $2, 'Default', $3) ON CONFLICT (product_id, name) DO UPDATE SET price_minor = EXCLUDED.price_minor`, [canonicalId, `sku-${canonicalId}`, Number(product.priceMinor || 0)]);
          const variant = await client.query<{ id: string }>('SELECT id FROM product_variants WHERE product_id = $1 ORDER BY created_at LIMIT 1', [canonicalId]);
          await client.query(`INSERT INTO inventory (variant_id, on_hand, reserved) VALUES ($1, $2, 0) ON CONFLICT (variant_id) DO NOTHING`, [variant.rows[0].id, product.inventory === null || product.inventory === undefined ? null : Number(product.inventory)]);
          await client.query(`INSERT INTO product_prices (product_id, variant_id, currency, amount_minor) VALUES ($1, $2, $3, $4)`, [canonicalId, variant.rows[0].id, String(product.currency || 'usd').toUpperCase(), Number(product.priceMinor || 0)]);
          return;
        }
        await client.query(`UPDATE products SET name = COALESCE($2, name), description = COALESCE($3, description), price_minor = COALESCE($4, price_minor), active = COALESCE($5, active), provider_product_id = COALESCE($6, provider_product_id), provider_price_id = COALESCE($7, provider_price_id), legacy_payload = legacy_payload || $8::jsonb, updated_at = now() WHERE id = $1`, [existing.id, product.name ? String(product.name) : null, product.description ? String(product.description) : null, product.priceMinor === undefined ? null : Number(product.priceMinor), product.active === undefined ? null : product.active === true, product.stripeProductId || null, product.stripePriceId || null, JSON.stringify(product)]);
        if (product.priceMinor !== undefined) {
          await client.query('UPDATE product_variants SET price_minor = $2, updated_at = now() WHERE product_id = $1', [existing.id, Number(product.priceMinor)]);
          await client.query('INSERT INTO product_prices (product_id, currency, amount_minor) VALUES ($1, $2, $3)', [existing.id, String(product.currency || existing.currency || 'usd').toUpperCase(), Number(product.priceMinor)]);
        }
        if (product.inventory !== undefined) await client.query('UPDATE inventory SET on_hand = $2, updated_at = now() FROM product_variants v WHERE inventory.variant_id = v.id AND v.product_id = $1 AND (inventory.on_hand IS NULL OR $2 IS NULL OR $2 >= inventory.reserved)', [existing.id, product.inventory === null ? null : Number(product.inventory)]);
      });
    },
    async remove(id) { const existing = await get(id); if (!existing) throw new Error('PRODUCT_NOT_FOUND'); await pool.query('UPDATE products SET active = false, updated_at = now() WHERE id::text = $1 OR legacy_product_id = $1', [existing.id]); }
  };
}

function orderRow(row: Record<string, unknown>): OrderRecord {
  const payload = row.legacy_payload && typeof row.legacy_payload === 'object' ? row.legacy_payload as Record<string, unknown> : {};
  return { ...payload, id: String(row.legacy_order_id || row.id), creatorId: String(row.external_auth_id || row.creator_user_id), siteId: String(row.legacy_site_id || row.site_id), status: String(row.status), state: String(row.state), fulfillmentStatus: String(row.fulfillment_status), customerEmail: String(row.customer_email), totalMinor: Number(row.total_minor), currency: String(row.currency).toLowerCase(), createdAt: new Date(String(row.created_at)).toISOString(), updatedAt: new Date(String(row.updated_at)).toISOString() };
}

export function createPostgresOrdersRepository(pool: Pool): OrdersRepository {
  const get = async (id: string, client: Pool | PoolClient = pool): Promise<OrderRecord | null> => {
    const result = await client.query(`SELECT o.*, u.external_auth_id, s.legacy_site_id FROM orders o LEFT JOIN app_users u ON u.id = o.creator_user_id LEFT JOIN sites s ON s.id = o.site_id WHERE o.id::text = $1 OR o.legacy_order_id = $1 LIMIT 1`, [id]);
    return result.rows[0] ? orderRow(result.rows[0]) : null;
  };
  const resolvedId = async (client: Pool | PoolClient, id: string): Promise<string> => { const result = await client.query('SELECT id FROM orders WHERE id::text = $1 OR legacy_order_id = $1 LIMIT 1', [id]); if (!result.rows[0]) throw new Error('ORDER_NOT_FOUND'); return String(result.rows[0].id); };
  return {
    get,
    async listByCreator(creatorId, limit = 100) { const user = await pool.query('SELECT id FROM app_users WHERE id::text = $1 OR external_auth_id = $1 LIMIT 1', [creatorId]); if (!user.rows[0]) return []; const result = await pool.query(`SELECT o.*, u.external_auth_id, s.legacy_site_id FROM orders o LEFT JOIN app_users u ON u.id = o.creator_user_id LEFT JOIN sites s ON s.id = o.site_id WHERE o.creator_user_id = $1 ORDER BY o.created_at DESC LIMIT $2`, [user.rows[0].id, Math.min(Math.max(limit, 1), 500)]); return result.rows.map(orderRow); },
    async listByCustomer(email, limit = 100) { const result = await pool.query(`SELECT o.*, u.external_auth_id, s.legacy_site_id FROM orders o LEFT JOIN app_users u ON u.id = o.creator_user_id LEFT JOIN sites s ON s.id = o.site_id WHERE lower(o.customer_email) = lower($1) ORDER BY o.created_at DESC LIMIT $2`, [email, Math.min(Math.max(limit, 1), 500)]); return result.rows.map(orderRow); },
    async save(id, order) { await withPostgresTransaction(pool, async (client) => { const current = await get(id, client); if (!current) throw new Error('ORDER_NOT_FOUND'); const target = await resolvedId(client, id); await client.query(`UPDATE orders SET customer_email = COALESCE($2, customer_email), fulfillment_status = COALESCE($3::fulfillment_status, fulfillment_status), provider_checkout_id = COALESCE($4, provider_checkout_id), legacy_payload = legacy_payload || $5::jsonb, updated_at = now() WHERE id = $1`, [target, order.customerEmail ? String(order.customerEmail) : null, order.fulfillmentStatus ? String(order.fulfillmentStatus) : null, order.providerCheckoutId ? String(order.providerCheckoutId) : null, JSON.stringify(order)]); }); },
    async transition(id, transition: OrderTransitionRecord) {
      return withPostgresTransaction(pool, async (client) => {
        const target = await resolvedId(client, id);
        const currentResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [target]);
        const current = currentResult.rows[0];
        const duplicate = await client.query('SELECT 1 FROM order_state_history WHERE order_id = $1 AND transition_key = $2', [target, transition.transitionKey]);
        if (duplicate.rows[0]) return (await get(target, client)) as OrderRecord;
        const currentState = legacyOrderState(current.state, current.fulfillment_status || current.status);
        if (currentState !== transition.from) throw new Error(`STALE_ORDER_STATE:${currentState}`);
        assertOrderTransition(currentState, transition.to as OrderState);
        await client.query('UPDATE orders SET state = $2::order_state, status = CASE WHEN $2 = \'paid\' THEN \'paid\'::order_status WHEN $2 = \'payment_failed\' THEN \'payment_failed\'::order_status WHEN $2 = \'cancelled\' THEN \'cancelled\'::order_status WHEN $2 = \'refunded\' THEN \'refunded\'::order_status ELSE status END, updated_at = now() WHERE id = $1', [target, transition.to]);
        await client.query('INSERT INTO order_state_history (order_id, from_state, to_state, source, actor_user_id, transition_key, metadata) VALUES ($1, $2::order_state, $3::order_state, $4, $5, $6, $7::jsonb)', [target, transition.from, transition.to, transition.source, transition.actorUserId || null, transition.transitionKey, JSON.stringify(transition.metadata || {})]);
        await client.query(`INSERT INTO outbox_events (event_type, event_version, aggregate_type, aggregate_id, idempotency_key, correlation_id, payload) VALUES ($1, 1, 'order', $2, $3, $3, $4::jsonb) ON CONFLICT (idempotency_key) DO NOTHING`, [`Order${transition.to[0].toUpperCase()}${transition.to.slice(1)}.v1`, target, `order:${id}:${transition.transitionKey}`, JSON.stringify({ orderId: id, state: transition.to })]);
        return (await get(target, client)) as OrderRecord;
      });
    }
  };
}

export function createPostgresInventoryRepository(pool: Pool): TransactionalInventoryRepository {
  const resolveVariant = async (client: Pool | PoolClient, productId: string): Promise<{ variantId: string; productId: string }> => {
    const result = await client.query(`SELECT v.id AS variant_id, p.id AS product_id FROM products p JOIN product_variants v ON v.product_id = p.id WHERE p.id::text = $1 OR p.legacy_product_id = $1 ORDER BY v.created_at LIMIT 1`, [productId]);
    if (!result.rows[0]) throw new Error('PRODUCT_NOT_FOUND');
    return { variantId: String(result.rows[0].variant_id), productId: String(result.rows[0].product_id) };
  };
  const change = async (productId: string, quantity: number, operation: 'reserve' | 'release' | 'decrement', key: string, orderId?: string): Promise<void> => {
    assertPositiveQuantity(quantity);
    await withPostgresTransaction(pool, async (client) => {
      const variant = await resolveVariant(client, productId);
      const duplicate = await client.query('SELECT 1 FROM inventory_movements WHERE idempotency_key = $1', [key]);
      if (duplicate.rows[0]) return;
      const stock = await client.query('SELECT on_hand, reserved FROM inventory WHERE variant_id = $1 FOR UPDATE', [variant.variantId]);
      if (!stock.rows[0]) throw new Error('INVENTORY_NOT_FOUND');
      const onHand = stock.rows[0].on_hand === null ? null : Number(stock.rows[0].on_hand);
      const reserved = Number(stock.rows[0].reserved || 0);
      if (operation === 'reserve' && onHand !== null && onHand - reserved < quantity) throw new Error('OUT_OF_STOCK');
      if (operation === 'release' && reserved < quantity) throw new Error('INVENTORY_RESERVATION_UNDERFLOW');
      if (operation === 'decrement' && onHand !== null && onHand - reserved < quantity) throw new Error('OUT_OF_STOCK');
      const nextOnHand = operation === 'decrement' && onHand !== null ? onHand - quantity : onHand;
      const nextReserved = operation === 'reserve' ? reserved + quantity : operation === 'release' ? reserved - quantity : reserved;
      await client.query('UPDATE inventory SET on_hand = $2, reserved = $3, updated_at = now() WHERE variant_id = $1', [variant.variantId, nextOnHand, nextReserved]);
      await client.query('INSERT INTO inventory_movements (variant_id, order_id, movement_type, quantity_delta, on_hand_after, reserved_after, idempotency_key, reason) VALUES ($1, $2, $3::inventory_movement_type, $4, $5, $6, $7, $8)', [variant.variantId, orderId || null, operation === 'reserve' ? 'reservation' : operation === 'release' ? 'reservation_release' : 'sale', operation === 'reserve' ? quantity : -quantity, nextOnHand === null ? 0 : nextOnHand, nextReserved, key, `commerce:${operation}`]);
    });
  };
  return { getByProduct: async (productId) => { const result = await pool.query(`SELECT p.id, p.legacy_product_id, i.on_hand, i.reserved FROM products p JOIN product_variants v ON v.product_id = p.id JOIN inventory i ON i.variant_id = v.id WHERE p.id::text = $1 OR p.legacy_product_id = $1 ORDER BY v.created_at LIMIT 1`, [productId]); const row = result.rows[0]; return row ? { id: String(row.legacy_product_id || row.id), productId, available: row.on_hand === null ? Number.MAX_SAFE_INTEGER : Number(row.on_hand) - Number(row.reserved), reserved: Number(row.reserved) } : null; }, reserve: (id, quantity) => change(id, quantity, 'reserve', `inventory:reserve:${id}:${cryptoRandomUuid()}`), release: (id, quantity) => change(id, quantity, 'release', `inventory:release:${id}:${cryptoRandomUuid()}`), decrement: (id, quantity) => change(id, quantity, 'decrement', `inventory:decrement:${id}:${cryptoRandomUuid()}`), reserveWithKey: (id, quantity, key, orderId) => change(id, quantity, 'reserve', key, orderId), releaseWithKey: (id, quantity, key, orderId) => change(id, quantity, 'release', key, orderId), decrementWithKey: (id, quantity, key, orderId) => change(id, quantity, 'decrement', key, orderId) };
}

export function createPostgresPaymentsRepository(pool: Pool): PaymentsRepository {
  return { get: async (id) => { const result = await pool.query('SELECT * FROM payments WHERE id::text = $1 LIMIT 1', [id]); return result.rows[0] ? result.rows[0] as PaymentRecord : null; }, getByProviderEvent: async (provider, providerEventId) => { const result = await pool.query('SELECT * FROM payments WHERE provider = $1 AND provider_event_id = $2 LIMIT 1', [provider, providerEventId]); return result.rows[0] ? result.rows[0] as PaymentRecord : null; }, save: async (id, payment) => { await pool.query(`INSERT INTO payments (id, order_id, provider, provider_payment_id, provider_event_id, status, amount_minor, currency, idempotency_key, raw_event) VALUES ($1, $2, $3, $4, $5, $6::payment_status, $7, $8, $9, $10::jsonb) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, raw_event = EXCLUDED.raw_event, updated_at = now()`, [id, payment.orderId, payment.provider || 'stripe', payment.providerPaymentId || null, payment.providerEventId || null, payment.status || 'pending', payment.amountMinor || 0, payment.currency || 'USD', payment.id || `payment:${id}`, JSON.stringify(payment)]); } };
}

export function createPostgresFulfillmentsRepository(pool: Pool): FulfillmentsRepository {
  return { getByOrder: async (orderId) => { const result = await pool.query('SELECT * FROM fulfillments WHERE order_id::text = $1 LIMIT 1', [orderId]); return result.rows[0] ? result.rows[0] as FulfillmentRecord : null; }, save: async (orderId, fulfillment) => { await pool.query(`INSERT INTO fulfillments (order_id, status, tracking_number, carrier, shipped_at, delivered_at) VALUES ($1, $2::fulfillment_state, $3, $4, $5, $6) ON CONFLICT (order_id) DO UPDATE SET status = EXCLUDED.status, tracking_number = EXCLUDED.tracking_number, carrier = EXCLUDED.carrier, shipped_at = EXCLUDED.shipped_at, delivered_at = EXCLUDED.delivered_at, updated_at = now()`, [asUuid(orderId, 'order'), fulfillment.status || 'unfulfilled', fulfillment.trackingNumber || null, fulfillment.carrier || null, fulfillment.shippedAt || null, fulfillment.deliveredAt || null]); } };
}

function cryptoRandomUuid(): string { return '00000000-0000-4000-8000-' + Math.random().toString(16).slice(2).padEnd(12, '0').slice(0, 12); }
