import type { Pool } from 'pg';
import { withPostgresTransaction } from './client';
import { assertOrderTransition, legacyOrderState, type OrderState } from '../../domains/orders/state-machine';

export type CommerceCursor = { createdAt: string; id: string };
export type CheckoutDraft = { id: string; status: 'pending_payment'; productId: string; productName: string; quantity: number; unitPriceMinor: number; totalMinor: number; currency: string; stripeProductId: string | null; stripePriceId: string | null; customerEmail: string; siteId: string; creatorId: string };

const encodeCursor = (value: CommerceCursor) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
export function decodeCommerceCursor(value: unknown): CommerceCursor | null {
  if (typeof value !== 'string' || value.length > 512) return null;
  try { const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>; return typeof parsed.createdAt === 'string' && typeof parsed.id === 'string' ? { createdAt: parsed.createdAt, id: parsed.id } : null; } catch { return null; }
}

function publicOrder(row: Record<string, unknown>) {
  return { id: String(row.legacy_order_id || row.id), creatorId: String(row.external_auth_id || row.creator_user_id), siteId: String(row.legacy_site_id || row.site_id), customerEmail: String(row.customer_email), status: String(row.status), state: String(row.state), fulfillmentStatus: String(row.fulfillment_status), totalMinor: Number(row.total_minor), currency: String(row.currency).toLowerCase(), createdAt: new Date(String(row.created_at)).toISOString(), updatedAt: new Date(String(row.updated_at)).toISOString() };
}

export function createPostgresCommerceService(pool: Pool) {
  async function canManageSite(userId: string, siteId: string) {
    const result = await pool.query('SELECT 1 FROM sites s JOIN app_users u ON u.id = s.owner_user_id WHERE u.external_auth_id = $1 AND (s.id::text = $2 OR s.legacy_site_id = $2) LIMIT 1', [userId, siteId]);
    return result.rowCount === 1;
  }
  async function publishedSite(handle: string) {
    const result = await pool.query<{ id: string; account_id: string; external_auth_id: string; handle: string }>(
      `SELECT s.id::text, s.account_id::text, u.external_auth_id, s.handle FROM sites s JOIN app_users u ON u.id = s.owner_user_id WHERE s.handle = $1 AND s.is_published = true LIMIT 1`, [handle.trim().toLowerCase()]
    );
    return result.rows[0] || null;
  }

  async function listPublicProducts(handle: string, cursor: CommerceCursor | null, limit: number) {
    const site = await publishedSite(handle); if (!site) return null;
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const values: unknown[] = [site.id];
    const cursorSql = cursor ? ' AND (p.created_at, p.id) < ($2::timestamptz, $3::uuid)' : '';
    if (cursor) values.push(cursor.createdAt, cursor.id);
    values.push(safeLimit + 1);
    const result = await pool.query(`SELECT p.id::text, p.legacy_product_id, p.name, p.description, p.currency, p.active, COALESCE(v.price_minor, p.price_minor) AS amount_minor, v.id::text AS variant_id, v.name AS variant_name, i.on_hand, i.reserved, p.created_at FROM products p LEFT JOIN LATERAL (SELECT * FROM product_variants v0 WHERE v0.product_id = p.id AND v0.active ORDER BY v0.created_at LIMIT 1) v ON true LEFT JOIN inventory i ON i.variant_id = v.id WHERE p.site_id = $1 AND p.active = true${cursorSql} ORDER BY p.created_at DESC, p.id DESC LIMIT $${values.length}`, values);
    const page = result.rows.slice(0, safeLimit);
    return { site: { id: site.id, handle: site.handle }, products: page.map((row) => ({ id: String(row.legacy_product_id || row.id), name: row.name, description: row.description, priceMinor: Number(row.amount_minor), currency: String(row.currency).toLowerCase(), active: true, variantId: row.variant_id, variantName: row.variant_name, inventory: row.on_hand === null || row.on_hand === undefined ? null : Number(row.on_hand), availableQuantity: row.on_hand === null || row.on_hand === undefined ? null : Math.max(0, Number(row.on_hand) - Number(row.reserved || 0)) })), hasMore: result.rows.length > safeLimit, nextCursor: result.rows.length > safeLimit && page.length ? encodeCursor({ createdAt: new Date(String(page[page.length - 1].created_at)).toISOString(), id: String(page[page.length - 1].id) }) : null };
  }

  async function listCreatorProducts(userId: string, siteId: string, cursor: CommerceCursor | null, limit: number) {
    const values: unknown[] = [userId, siteId];
    const cursorSql = cursor ? ' AND (p.created_at, p.id) < ($3::timestamptz, $4::uuid)' : '';
    if (cursor) values.push(cursor.createdAt, cursor.id);
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100); values.push(safeLimit + 1);
    const result = await pool.query(`SELECT p.*, m.external_auth_id, s.legacy_site_id, v.id::text AS variant_id, v.price_minor AS variant_price, i.on_hand, i.reserved FROM products p JOIN app_users m ON m.id = p.creator_user_id JOIN sites s ON s.id = p.site_id LEFT JOIN LATERAL (SELECT * FROM product_variants v0 WHERE v0.product_id = p.id ORDER BY v0.created_at LIMIT 1) v ON true LEFT JOIN inventory i ON i.variant_id = v.variant_id WHERE m.external_auth_id = $1 AND (s.id::text = $2 OR s.legacy_site_id = $2)${cursorSql} ORDER BY p.created_at DESC, p.id DESC LIMIT $${values.length}`, values);
    const page = result.rows.slice(0, safeLimit);
    return { products: page.map((row) => ({ id: String(row.legacy_product_id || row.id), name: row.name, description: row.description, priceMinor: Number(row.variant_price ?? row.price_minor), currency: String(row.currency).toLowerCase(), active: row.active === true, inventory: row.on_hand === null || row.on_hand === undefined ? null : Number(row.on_hand), inventoryReserved: Number(row.reserved || 0), createdAt: row.created_at, updatedAt: row.updated_at })), hasMore: result.rows.length > safeLimit, nextCursor: result.rows.length > safeLimit && page.length ? encodeCursor({ createdAt: new Date(String(page[page.length - 1].created_at)).toISOString(), id: String(page[page.length - 1].id) }) : null };
  }

  async function createCheckout(input: { handle: string; productId: string; variantId?: string; quantity: number; customerEmail: string; idempotencyKey: string }): Promise<CheckoutDraft> {
    return withPostgresTransaction(pool, async (client) => {
      const siteResult = await client.query<{ id: string; external_auth_id: string }>(`SELECT s.id::text, u.external_auth_id FROM sites s JOIN app_users u ON u.id = s.owner_user_id WHERE s.handle = $1 AND s.is_published = true LIMIT 1`, [input.handle.trim().toLowerCase()]);
      const site = siteResult.rows[0]; if (!site) throw new Error('CREATOR_NOT_FOUND');
      const duplicate = await client.query(`SELECT o.*, p.id::text AS product_id, p.name AS product_name, p.provider_product_id, p.provider_price_id, p.currency, oi.quantity, oi.unit_price_minor FROM orders o JOIN order_items oi ON oi.order_id = o.id JOIN products p ON p.id = oi.product_id WHERE o.site_id = $1 AND o.idempotency_key = $2 FOR UPDATE`, [site.id, input.idempotencyKey]);
      if (duplicate.rows[0]) return { ...publicOrder(duplicate.rows[0]), id: String(duplicate.rows[0].id), productId: String(duplicate.rows[0].product_id), productName: String(duplicate.rows[0].product_name), quantity: Number(duplicate.rows[0].quantity), unitPriceMinor: Number(duplicate.rows[0].unit_price_minor), totalMinor: Number(duplicate.rows[0].total_minor), currency: String(duplicate.rows[0].currency).toLowerCase(), stripeProductId: duplicate.rows[0].provider_product_id, stripePriceId: duplicate.rows[0].provider_price_id, customerEmail: String(duplicate.rows[0].customer_email), siteId: site.id, creatorId: site.external_auth_id, status: 'pending_payment' };
      const productResult = await client.query(`SELECT p.*, v.id::text AS variant_id, COALESCE(v.price_minor, p.price_minor) AS effective_price, i.on_hand, i.reserved FROM products p LEFT JOIN LATERAL (SELECT * FROM product_variants v0 WHERE v0.product_id = p.id AND v0.active AND ($2 = '' OR v0.id::text = $2) ORDER BY v0.created_at LIMIT 1) v ON true LEFT JOIN inventory i ON i.variant_id = v.variant_id WHERE p.site_id = $1 AND (p.id::text = $3 OR p.legacy_product_id = $3) AND p.active = true LIMIT 1`, [site.id, input.variantId || '', input.productId]);
      const product = productResult.rows[0]; if (!product) throw new Error('PRODUCT_NOT_FOUND');
      const available = product.on_hand === null || product.on_hand === undefined ? null : Number(product.on_hand) - Number(product.reserved || 0);
      if (available !== null && available < input.quantity) throw new Error('OUT_OF_STOCK');
      const order = await client.query<{ id: string }>(`INSERT INTO orders (creator_user_id, site_id, customer_email, status, state, fulfillment_status, total_minor, currency, idempotency_key, legacy_payload) VALUES ((SELECT id FROM app_users WHERE external_auth_id = $1), $2, $3, 'pending_payment', 'pending', 'unfulfilled', $4, $5, $6, $7::jsonb) RETURNING id`, [site.external_auth_id, site.id, input.customerEmail, Number(product.effective_price) * input.quantity, product.currency, input.idempotencyKey, JSON.stringify({ productId: input.productId, quantity: input.quantity })]);
      const orderId = order.rows[0].id;
      await client.query(`INSERT INTO order_items (order_id, product_id, variant_id, product_name, quantity, unit_price_minor, total_minor) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [orderId, product.id, product.variant_id, product.name, input.quantity, product.effective_price, Number(product.effective_price) * input.quantity]);
      if (product.variant_id && product.on_hand !== null && product.on_hand !== undefined) {
        const reservationKey = `order:${orderId}:reserve`;
        const stockUpdate = await client.query(`UPDATE inventory SET reserved = reserved + $2, updated_at = now() WHERE variant_id = $1 AND (on_hand IS NULL OR reserved + $2 <= on_hand)`, [product.variant_id, input.quantity]);
        if (stockUpdate.rowCount !== 1) throw new Error('OUT_OF_STOCK');
        const reservation = await client.query<{ id: string }>(`INSERT INTO inventory_reservations (product_id, variant_id, order_id, quantity, idempotency_key) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [product.id, product.variant_id, orderId, input.quantity, reservationKey]);
        await client.query(`INSERT INTO inventory_movements (variant_id, order_id, reservation_id, movement_type, quantity_delta, on_hand_after, reserved_after, idempotency_key, reason) SELECT $1, $2, $3, 'reservation', $4, on_hand, reserved, $5, 'checkout reservation' FROM inventory WHERE variant_id = $1`, [product.variant_id, orderId, reservation.rows[0].id, input.quantity, reservationKey]);
      }
      await client.query(`INSERT INTO outbox_events (event_type, event_version, aggregate_type, aggregate_id, idempotency_key, correlation_id, payload) VALUES ('OrderCreated.v1', 1, 'order', $1, $2, $2, $3::jsonb) ON CONFLICT (idempotency_key) DO NOTHING`, [orderId, `order:${orderId}:created`, JSON.stringify({ orderId, siteId: site.id })]);
      return { id: orderId, status: 'pending_payment', productId: String(product.legacy_product_id || product.id), productName: String(product.name), quantity: input.quantity, unitPriceMinor: Number(product.effective_price), totalMinor: Number(product.effective_price) * input.quantity, currency: String(product.currency).toLowerCase(), stripeProductId: product.provider_product_id || null, stripePriceId: product.provider_price_id || null, customerEmail: input.customerEmail, siteId: site.id, creatorId: site.external_auth_id };
    });
  }

  async function setCheckoutSession(orderId: string, sessionId: string) { await pool.query('UPDATE orders SET provider_checkout_id = $2, updated_at = now() WHERE id::text = $1', [orderId, sessionId]); }

  async function listCreatorOrders(userId: string, siteId: string | undefined, cursor: CommerceCursor | null, limit: number) {
    const values: unknown[] = [userId]; let where = 'u.external_auth_id = $1';
    if (siteId) { values.push(siteId); where += ` AND (s.id::text = $${values.length} OR s.legacy_site_id = $${values.length})`; }
    if (cursor) { values.push(cursor.createdAt, cursor.id); where += ` AND (o.created_at, o.id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`; }
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100); values.push(safeLimit + 1);
    const result = await pool.query(`SELECT o.*, u.external_auth_id, s.legacy_site_id FROM orders o JOIN app_users u ON u.id = o.creator_user_id JOIN sites s ON s.id = o.site_id WHERE ${where} ORDER BY o.created_at DESC, o.id DESC LIMIT $${values.length}`, values);
    const page = result.rows.slice(0, safeLimit); return { orders: page.map(publicOrder), hasMore: result.rows.length > safeLimit, nextCursor: result.rows.length > safeLimit && page.length ? encodeCursor({ createdAt: new Date(String(page[page.length - 1].created_at)).toISOString(), id: String(page[page.length - 1].id) }) : null };
  }

  async function listCustomerOrders(email: string, siteId: string | undefined, limit: number) {
    const values: unknown[] = [email.toLowerCase()]; let where = 'lower(o.customer_email) = lower($1)';
    if (siteId) { values.push(siteId); where += ` AND (s.id::text = $${values.length} OR s.legacy_site_id = $${values.length})`; }
    values.push(Math.min(Math.max(Math.trunc(limit), 1), 100));
    const result = await pool.query(`SELECT o.*, u.external_auth_id, s.legacy_site_id FROM orders o JOIN app_users u ON u.id = o.creator_user_id JOIN sites s ON s.id = o.site_id WHERE ${where} ORDER BY o.created_at DESC, o.id DESC LIMIT $${values.length}`, values);
    return result.rows.map(publicOrder);
  }

  async function changeFulfillment(orderId: string, actorExternalId: string, nextStatus: 'processing' | 'fulfilled' | 'cancelled', idempotencyKey: string) {
    return withPostgresTransaction(pool, async (client) => {
      const result = await client.query(`SELECT o.*, s.account_id, u.external_auth_id, s.legacy_site_id FROM orders o JOIN app_users u ON u.id = o.creator_user_id JOIN sites s ON s.id = o.site_id WHERE (o.id::text = $1 OR o.legacy_order_id = $1) AND u.external_auth_id = $2 FOR UPDATE`, [orderId, actorExternalId]);
      const order = result.rows[0]; if (!order) throw new Error('ORDER_NOT_FOUND');
      const duplicate = await client.query('SELECT 1 FROM fulfillment_history WHERE order_id = $1 AND idempotency_key = $2', [order.id, idempotencyKey]);
      if (duplicate.rows[0]) return publicOrder(order);
      if (nextStatus !== 'cancelled' && order.status !== 'paid') throw new Error('ORDER_NOT_PAID');
      const currentState = legacyOrderState(order.state, order.fulfillment_status || order.status);
      const targetState = nextStatus === 'processing' ? 'processing' : nextStatus === 'fulfilled' ? 'fulfilled' : 'cancelled';
      assertOrderTransition(currentState, targetState as OrderState);
      const fulfillment = await client.query<{ id: string }>(`INSERT INTO fulfillments (order_id, status) VALUES ($1, $2::fulfillment_state) ON CONFLICT (order_id) DO UPDATE SET status = EXCLUDED.status, updated_at = now() RETURNING id`, [order.id, nextStatus]);
      const reservation = await client.query<{ id: string; variant_id: string; quantity: number }>(`SELECT id, variant_id, quantity FROM inventory_reservations WHERE order_id = $1 AND status = 'active' FOR UPDATE`, [order.id]);
      if (reservation.rows[0]) {
        const row = reservation.rows[0];
        const movement = nextStatus === 'fulfilled' ? 'sale' : 'reservation_release';
        await client.query(`UPDATE inventory SET reserved = GREATEST(reserved - $2, 0), on_hand = CASE WHEN $3 = 'sale' AND on_hand IS NOT NULL THEN on_hand - $2 ELSE on_hand END, updated_at = now() WHERE variant_id = $1`, [row.variant_id, row.quantity, movement]);
        await client.query(`UPDATE inventory_reservations SET status = $2::reservation_status, consumed_at = CASE WHEN $2 = 'consumed' THEN now() ELSE consumed_at END, released_at = CASE WHEN $2 = 'released' THEN now() ELSE released_at END, updated_at = now() WHERE id = $1`, [row.id, nextStatus === 'fulfilled' ? 'consumed' : 'released']);
        await client.query(`INSERT INTO inventory_movements (variant_id, order_id, reservation_id, movement_type, quantity_delta, on_hand_after, reserved_after, idempotency_key, reason) SELECT $1, $2, $3, $4::inventory_movement_type, $5, COALESCE(on_hand, 0), reserved, $6, 'fulfillment transition' FROM inventory WHERE variant_id = $1`, [row.variant_id, order.id, row.id, movement, nextStatus === 'fulfilled' ? -row.quantity : -row.quantity, `fulfillment:${order.id}:${idempotencyKey}`]);
      }
      await client.query(`UPDATE orders SET state = $2::order_state, status = CASE WHEN $2 = 'cancelled' THEN 'cancelled'::order_status ELSE status END, fulfillment_status = $3::fulfillment_status, updated_at = now() WHERE id = $1`, [order.id, targetState, nextStatus]);
      await client.query(`INSERT INTO fulfillment_history (account_id, site_id, order_id, fulfillment_id, previous_status, next_status, actor_user_id, idempotency_key, metadata) VALUES ($1, $2, $3, $4, $5::fulfillment_state, $6::fulfillment_state, (SELECT id FROM app_users WHERE external_auth_id = $7), $8, '{}'::jsonb)`, [order.account_id, order.site_id, order.id, fulfillment.rows[0].id, order.fulfillment_status, nextStatus, actorExternalId, idempotencyKey]);
      return publicOrder({ ...order, state: targetState, fulfillment_status: nextStatus, status: targetState === 'cancelled' ? 'cancelled' : order.status });
    });
  }

  async function recordStripeCheckoutOutcome(orderId: string, sessionId: string, eventId: string, outcome: 'paid' | 'cancelled' | 'payment_failed' | 'pending_payment' | 'refunded', amountMinor?: number, currency?: string) {
    return withPostgresTransaction(pool, async (client) => {
      const orderResult = await client.query(`SELECT o.*, s.account_id FROM orders o JOIN sites s ON s.id = o.site_id WHERE o.id::text = $1 FOR UPDATE`, [orderId]);
      const order = orderResult.rows[0]; if (!order) return null;
      const duplicate = await client.query('SELECT 1 FROM payment_events WHERE provider = $1 AND provider_event_id = $2', ['stripe', eventId]);
      if (duplicate.rows[0]) return publicOrder(order);
      const paymentState = outcome === 'paid' ? 'paid' : outcome === 'payment_failed' ? 'failed' : outcome === 'refunded' ? 'refunded' : 'pending';
      const payment = await client.query<{ id: string }>(`INSERT INTO payments (order_id, provider, provider_payment_id, provider_event_id, status, amount_minor, currency, idempotency_key, raw_event, paid_at) VALUES ($1, 'stripe', $2, $3, $4::payment_status, $5, $6, $7, '{}'::jsonb, CASE WHEN $4 = 'paid' THEN now() END) ON CONFLICT (provider, provider_event_id) DO UPDATE SET status = EXCLUDED.status RETURNING id`, [order.id, sessionId, eventId, paymentState, amountMinor || order.total_minor, currency || order.currency, `stripe:${eventId}`]);
      await client.query(`INSERT INTO payment_events (provider, provider_event_id, event_type, payment_id, payload, processed_at) VALUES ('stripe', $1, $2, $3, '{}'::jsonb, now()) ON CONFLICT (provider, provider_event_id) DO NOTHING`, [eventId, `checkout.${outcome}`, payment.rows[0]?.id]);
      const currentState = legacyOrderState(order.state, order.fulfillment_status || order.status);
      const targetState: OrderState = outcome === 'paid' ? 'paid' : outcome === 'cancelled' ? 'cancelled' : outcome === 'payment_failed' ? 'payment_failed' : outcome === 'refunded' ? 'refunded' : 'pending';
      if (currentState !== targetState) assertOrderTransition(currentState, targetState);
      const reservation = await client.query<{ id: string; variant_id: string; quantity: number }>(`SELECT id, variant_id, quantity FROM inventory_reservations WHERE order_id = $1 AND status = 'active' FOR UPDATE`, [order.id]);
      if (reservation.rows[0] && outcome !== 'pending_payment') {
        const row = reservation.rows[0]; const consumed = outcome === 'paid';
        await client.query(`UPDATE inventory SET reserved = GREATEST(reserved - $2, 0), on_hand = CASE WHEN $3 AND on_hand IS NOT NULL THEN on_hand - $2 ELSE on_hand END, updated_at = now() WHERE variant_id = $1`, [row.variant_id, row.quantity, consumed]);
        await client.query(`UPDATE inventory_reservations SET status = $2::reservation_status, consumed_at = CASE WHEN $2 = 'consumed' THEN now() ELSE consumed_at END, released_at = CASE WHEN $2 = 'released' THEN now() ELSE released_at END, updated_at = now() WHERE id = $1`, [row.id, consumed ? 'consumed' : 'released']);
        await client.query(`INSERT INTO inventory_movements (variant_id, order_id, reservation_id, movement_type, quantity_delta, on_hand_after, reserved_after, idempotency_key, reason) SELECT $1, $2, $3, $4::inventory_movement_type, $5, COALESCE(on_hand, 0), reserved, $6, 'stripe checkout outcome' FROM inventory WHERE variant_id = $1`, [row.variant_id, order.id, row.id, consumed ? 'sale' : 'reservation_release', consumed ? -row.quantity : -row.quantity, `stripe:${eventId}:inventory`]);
      }
      await client.query(`UPDATE orders SET provider_checkout_id = $2, state = $3::order_state, status = CASE WHEN $3 = 'paid' THEN 'paid'::order_status WHEN $3 = 'cancelled' THEN 'cancelled'::order_status WHEN $3 = 'payment_failed' THEN 'payment_failed'::order_status WHEN $3 = 'refunded' THEN 'refunded'::order_status ELSE 'pending_payment'::order_status END, updated_at = now() WHERE id = $1`, [order.id, sessionId, targetState]);
      return publicOrder({ ...order, state: targetState, status: targetState === 'paid' ? 'paid' : targetState === 'cancelled' ? 'cancelled' : targetState === 'payment_failed' ? 'payment_failed' : targetState === 'refunded' ? 'refunded' : 'pending_payment' });
    });
  }

  async function recordProviderPaymentEvent(input: { orderId: string; providerPaymentId?: string; providerEventId: string; outcome: 'paid' | 'cancelled' | 'payment_failed' | 'pending_payment' | 'refunded'; amountMinor?: number; currency?: string }) {
    return recordStripeCheckoutOutcome(input.orderId, input.providerPaymentId || input.providerEventId, input.providerEventId, input.outcome, input.amountMinor, input.currency);
  }

  return { canManageSite, publishedSite, listPublicProducts, listCreatorProducts, createCheckout, setCheckoutSession, listCreatorOrders, listCustomerOrders, changeFulfillment, recordStripeCheckoutOutcome, recordProviderPaymentEvent };
}
