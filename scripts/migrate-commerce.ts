import 'dotenv/config';
import { adminDb } from '../server-services';
import { createConfiguredPostgresDatabase } from '../server/infrastructure/postgres';

const { pool } = createConfiguredPostgresDatabase();
const report = { products: 0, variants: 0, orders: 0, skipped: 0 };
const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const number = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const orderState = (status: string, fulfillment: string) => fulfillment === 'fulfilled' ? 'fulfilled' : fulfillment === 'processing' ? 'processing' : status === 'paid' ? 'paid' : status === 'payment_failed' ? 'payment_failed' : status === 'cancelled' ? 'cancelled' : status === 'refunded' ? 'refunded' : 'pending';

async function resolveSite(creatorId: string, siteId: string, productId?: string) {
  const direct = await pool.query<{ id: string; account_id: string; owner_user_id: string }>(`SELECT s.id::text, s.account_id::text, s.owner_user_id::text FROM sites s JOIN app_users u ON u.id = s.owner_user_id WHERE u.external_auth_id = $1 AND ($2 = '' OR s.id::text = $2 OR s.legacy_site_id = $2) LIMIT 1`, [creatorId, siteId]);
  if (direct.rows[0]) return direct.rows[0];
  if (productId) {
    const productSite = await pool.query<{ id: string; account_id: string; owner_user_id: string }>(`SELECT s.id::text, s.account_id::text, s.owner_user_id::text FROM products p JOIN sites s ON s.id = p.site_id WHERE p.legacy_product_id = $1 LIMIT 1`, [productId]);
    return productSite.rows[0] || null;
  }
  return null;
}

try {
  const productDocs = await adminDb.collection('creator_products').get();
  for (const document of productDocs.docs) {
    const value = document.data() || {};
    const site = await resolveSite(text(value.creatorId), text(value.siteId));
    if (!site) { report.skipped += 1; continue; }
    const product = await pool.query<{ id: string }>(`INSERT INTO products (legacy_product_id, site_id, creator_user_id, slug, name, description, currency, price_minor, active, provider_product_id, provider_price_id, legacy_payload, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14) ON CONFLICT (legacy_product_id) DO UPDATE SET name = EXCLUDED.name, price_minor = EXCLUDED.price_minor, active = EXCLUDED.active, updated_at = EXCLUDED.updated_at RETURNING id`, [document.id, site.id, site.owner_user_id, text(value.slug, document.id).toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 64), text(value.name, document.id), text(value.description) || null, text(value.currency, 'USD').toUpperCase(), Math.max(0, Math.round(number(value.priceMinor))), value.active !== false, text(value.stripeProductId) || null, text(value.stripePriceId) || null, JSON.stringify(value), text(value.createdAt, new Date().toISOString()), text(value.updatedAt, text(value.createdAt, new Date().toISOString()))]);
    const variant = await pool.query<{ id: string }>(`INSERT INTO product_variants (product_id, sku, name, price_minor) VALUES ($1, $2, 'Default', $3) ON CONFLICT (product_id, name) DO UPDATE SET price_minor = EXCLUDED.price_minor RETURNING id`, [product.rows[0].id, `legacy-${document.id}`.slice(0, 64), Math.max(0, Math.round(number(value.priceMinor)))]);
    await pool.query(`INSERT INTO inventory (variant_id, on_hand, reserved) VALUES ($1, $2, $3) ON CONFLICT (variant_id) DO UPDATE SET on_hand = EXCLUDED.on_hand, updated_at = now()`, [variant.rows[0].id, value.inventory === null || value.inventory === undefined ? null : Math.max(0, Math.round(number(value.inventory))), Math.max(0, Math.round(number(value.inventoryReserved)))]);
    await pool.query(`INSERT INTO product_prices (product_id, variant_id, currency, amount_minor) SELECT $1, $2, currency, price_minor FROM products WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM product_prices WHERE product_id = $1 AND variant_id = $2)`, [product.rows[0].id, variant.rows[0].id]);
    report.products += 1; report.variants += 1;
  }

  const orderDocs = await adminDb.collection('orders').get();
  for (const document of orderDocs.docs) {
    const value = document.data() || {};
    const creatorId = text(value.creatorId);
    const site = await resolveSite(creatorId, text(value.siteId), text(value.productId));
    if (!site) { report.skipped += 1; continue; }
    const product = await pool.query<{ id: string; name: string; price_minor: number; currency: string }>('SELECT id, name, price_minor, currency FROM products WHERE legacy_product_id = $1 LIMIT 1', [text(value.productId)]);
    if (!product.rows[0]) { report.skipped += 1; continue; }
    const quantity = Math.max(1, Math.round(number(value.quantity, 1)));
    const status = text(value.status, 'pending_payment'); const fulfillment = text(value.fulfillmentStatus, 'unfulfilled');
    const order = await pool.query<{ id: string }>(`INSERT INTO orders (legacy_order_id, creator_user_id, site_id, customer_email, status, state, fulfillment_status, provider_checkout_id, total_minor, currency, legacy_payload, created_at, updated_at) VALUES ($1, $2, $3, $4, $5::order_status, $6::order_state, $7::fulfillment_status, $8, $9, $10, $11::jsonb, $12, $13) ON CONFLICT (legacy_order_id) DO UPDATE SET status = EXCLUDED.status, state = EXCLUDED.state, fulfillment_status = EXCLUDED.fulfillment_status, updated_at = EXCLUDED.updated_at RETURNING id`, [document.id, site.owner_user_id, site.id, text(value.customerEmail, 'unknown@example.com'), ['pending_payment', 'paid', 'payment_failed', 'cancelled', 'refunded'].includes(status) ? status : 'pending_payment', orderState(status, fulfillment), ['unfulfilled', 'processing', 'fulfilled', 'cancelled'].includes(fulfillment) ? fulfillment : 'unfulfilled', text(value.stripeCheckoutSessionId) || null, Math.max(0, Math.round(number(value.totalMinor, number(value.unitPriceMinor) * quantity))), text(value.currency, 'USD').toUpperCase(), JSON.stringify(value), text(value.createdAt, new Date().toISOString()), text(value.updatedAt, text(value.createdAt, new Date().toISOString()))]);
    await pool.query(`INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price_minor, total_minor) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`, [order.rows[0].id, product.rows[0].id, product.rows[0].name, quantity, Number(value.unitPriceMinor || product.rows[0].price_minor), quantity * Number(value.unitPriceMinor || product.rows[0].price_minor)]);
    report.orders += 1;
  }
  console.log(JSON.stringify({ event: 'commerce_migration_completed', ...report }));
} finally {
  await pool.end();
}
