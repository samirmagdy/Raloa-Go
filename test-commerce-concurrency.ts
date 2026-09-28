import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createConfiguredPostgresDatabase, createPostgresCommerceService } from './server/infrastructure/postgres';

const databaseUrl = process.env.POSTGRES_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log('Commerce concurrency test skipped: PostgreSQL is not configured.');
} else {
  const { pool } = createConfiguredPostgresDatabase({ ...process.env, POSTGRES_ENABLED: 'true', POSTGRES_ENVIRONMENT: process.env.POSTGRES_ENVIRONMENT || 'test' });
  const suffix = crypto.randomUUID();
  const externalUser = `commerce-concurrency-${suffix}`;
  const handle = `commerce-${suffix.slice(0, 20)}`;
  let siteId = '';
  let accountId = '';
  let productId = '';
  try {
    const user = await pool.query<{ id: string }>('INSERT INTO app_users (external_auth_id) VALUES ($1) RETURNING id', [externalUser]);
    const account = await pool.query<{ id: string }>('INSERT INTO accounts (primary_user_id, name) VALUES ($1, $2) RETURNING id', [user.rows[0].id, `Commerce ${suffix}`]);
    accountId = account.rows[0].id;
    await pool.query("INSERT INTO account_memberships (account_id, user_id, role) VALUES ($1, $2, 'owner')", [accountId, user.rows[0].id]);
    const site = await pool.query<{ id: string }>('INSERT INTO sites (owner_user_id, account_id, handle, display_name, is_published, content) VALUES ($1, $2, $3, $4, true, $5) RETURNING id', [user.rows[0].id, accountId, handle, 'Commerce concurrency', '{}']);
    siteId = site.rows[0].id;
    const product = await pool.query<{ id: string }>('INSERT INTO products (site_id, creator_user_id, slug, name, currency, price_minor, active) VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id', [siteId, user.rows[0].id, `product-${suffix}`, 'Limited product', 'USD', 1000]);
    productId = product.rows[0].id;
    const variant = await pool.query<{ id: string }>('INSERT INTO product_variants (product_id, sku, name, price_minor) VALUES ($1, $2, $3, $4) RETURNING id', [productId, `sku-${suffix}`, 'Default', 1000]);
    await pool.query('INSERT INTO inventory (variant_id, on_hand, reserved) VALUES ($1, 1, 0)', [variant.rows[0].id]);
    const commerce = createPostgresCommerceService(pool);
    const results = await Promise.allSettled([
      commerce.createCheckout({ handle, productId, quantity: 1, customerEmail: 'one@example.com', idempotencyKey: `checkout-one-${suffix}` }),
      commerce.createCheckout({ handle, productId, quantity: 1, customerEmail: 'two@example.com', idempotencyKey: `checkout-two-${suffix}` })
    ]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected' && (result.reason as Error).message === 'OUT_OF_STOCK').length, 1);
    console.log('Commerce inventory concurrency test passed');
  } finally {
    if (siteId) {
      await pool.query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE site_id = $1)', [siteId]);
      await pool.query('DELETE FROM inventory_movements WHERE order_id IN (SELECT id FROM orders WHERE site_id = $1)', [siteId]);
      await pool.query('DELETE FROM inventory_reservations WHERE order_id IN (SELECT id FROM orders WHERE site_id = $1)', [siteId]);
      await pool.query('DELETE FROM fulfillment_history WHERE order_id IN (SELECT id FROM orders WHERE site_id = $1)', [siteId]);
      await pool.query('DELETE FROM outbox_events WHERE aggregate_id IN (SELECT id FROM orders WHERE site_id = $1)', [siteId]);
      await pool.query('DELETE FROM orders WHERE site_id = $1', [siteId]);
      await pool.query('DELETE FROM product_prices WHERE product_id IN (SELECT id FROM products WHERE site_id = $1)', [siteId]);
      await pool.query('DELETE FROM inventory WHERE variant_id IN (SELECT v.id FROM product_variants v JOIN products p ON p.id = v.product_id WHERE p.site_id = $1)', [siteId]);
      await pool.query('DELETE FROM product_variants WHERE product_id IN (SELECT id FROM products WHERE site_id = $1)', [siteId]);
      await pool.query('DELETE FROM products WHERE site_id = $1', [siteId]);
      await pool.query('DELETE FROM sites WHERE id = $1', [siteId]);
    }
    if (accountId) {
      await pool.query('DELETE FROM account_memberships WHERE account_id = $1', [accountId]);
      await pool.query('DELETE FROM accounts WHERE id = $1', [accountId]);
    }
    await pool.query('DELETE FROM app_users WHERE external_auth_id = $1', [externalUser]);
    await pool.end();
  }
}
