import crypto from 'node:crypto';

const required = ['STAGING_BASE_URL', 'STAGING_BEARER_TOKEN', 'STAGING_DISPOSABLE_DATA_CONFIRMATION'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) { console.error(`Creator staging flow refused to run. Missing: ${missing.join(', ')}`); process.exit(2); }
if (process.env.STAGING_DISPOSABLE_DATA_CONFIRMATION !== 'I_UNDERSTAND') { console.error('STAGING_DISPOSABLE_DATA_CONFIRMATION must equal I_UNDERSTAND.'); process.exit(2); }
const baseUrl = process.env.STAGING_BASE_URL.replace(/\/$/, '');
if (!/^https:\/\//.test(baseUrl) && process.env.ALLOW_HTTP_STAGING !== 'true') { console.error('STAGING_BASE_URL must use HTTPS.'); process.exit(2); }
const headers = { Authorization: `Bearer ${process.env.STAGING_BEARER_TOKEN}`, Accept: 'application/json, text/html' };
const checks = [];
async function request(path, init = {}) { const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) }, redirect: 'manual', signal: AbortSignal.timeout(20_000) }); const text = await response.text(); let body = null; try { body = text ? JSON.parse(text) : null; } catch {} return { response, text, body }; }
function pass(name, condition) { if (!condition) throw new Error(`${name} failed`); checks.push(name); console.log(`[PASS] ${name}`); }
const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const siteId = `flow_${suffix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48)}`;
const handle = `flow-${suffix.replace(/[^a-z0-9-]/gi, '').toLowerCase().slice(0, 22)}`;
let created = false; let mediaId = '';
try {
  const createdSite = await request('/api/sites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteId, username: handle, templateId: 'signature', displayName: 'Staging Flow Creator', role: 'Creator', bio: 'Disposable staging flow profile', links: [], socials: [] }) });
  pass('creator site creation', createdSite.response.status === 201 && createdSite.body?.site?.id === siteId); created = true;
  const edit = await request(`/api/sites/${encodeURIComponent(siteId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: 'Updated Staging Flow Creator', bio: 'Edited profile content for the staging flow', expectedRevision: Number(createdSite.body.site.revision) }) });
  pass('creator site edit and autosave', edit.response.status === 200 && edit.body?.site?.displayName === 'Updated Staging Flow Creator');
  const uploadBody = new FormData(); uploadBody.append('siteId', siteId); uploadBody.append('purpose', 'avatar'); uploadBody.append('file', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'flow.png');
  const upload = await request('/api/media/upload', { method: 'POST', body: uploadBody }); mediaId = String(upload.body?.media?.id || ''); pass('media upload and metadata persistence', upload.response.status === 201 && Boolean(mediaId));
  const publish = await request(`/api/sites/${encodeURIComponent(siteId)}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); pass('published snapshot creation', publish.response.status === 200 && publish.body?.site?.isPublished === true);
  const publicApi = await request(`/api/public/sites/${encodeURIComponent(handle)}`); pass('visitor public snapshot visit', publicApi.response.status === 200 && publicApi.body?.site?.isPublished === true);
  const publicHtml = await request(`/@${encodeURIComponent(handle)}`); pass('visitor public HTML visit', publicHtml.response.status === 200 && publicHtml.text.includes('Updated Staging Flow Creator'));
  const analyticsId = `staging-flow-${crypto.randomUUID()}`; const analytics = await request('/api/v1/public/telemetry/page-view', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': analyticsId }, body: JSON.stringify({ eventId: analyticsId, visitorId: analyticsId, path: `/@${handle}` }) }); pass('visitor analytics ingestion', analytics.response.status === 202 && analytics.body?.status === 'accepted');
} finally {
  if (mediaId) { const removedMedia = await request(`/api/media/${encodeURIComponent(mediaId)}?siteId=${encodeURIComponent(siteId)}`, { method: 'DELETE' }); pass('media cleanup', removedMedia.response.status === 204); }
  if (created) { const unpublished = await request(`/api/sites/${encodeURIComponent(siteId)}/unpublish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); pass('publication cleanup', [200, 404].includes(unpublished.response.status)); const deleted = await request(`/api/sites/${encodeURIComponent(siteId)}`, { method: 'DELETE' }); pass('site cleanup', [204, 404].includes(deleted.response.status)); }
}
console.log(`Creator staging flow passed: ${checks.length} checks.`);
