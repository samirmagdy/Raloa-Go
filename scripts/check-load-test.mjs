import fs from 'node:fs';

const script = fs.readFileSync('load/k6/staging.js', 'utf8');
const requiredWorkloads = ['public_pages', 'studio_saves', 'concurrent_bookings', 'inventory_reservations', 'stripe_webhook_burst', 'analytics_burst', 'media_uploads', 'background_job_spike'];
const requiredMetrics = ['public_page_latency', 'studio_save_latency', 'booking_latency', 'inventory_latency', 'stripe_webhook_latency', 'analytics_ingestion_latency', 'media_upload_latency', 'background_job_latency', 'load_errors'];
const failures = [];
for (const workload of requiredWorkloads) if (!script.includes(`${workload}:`)) failures.push(`load scenario missing: ${workload}`);
for (const metric of requiredMetrics) if (!script.includes(`'${metric}'`)) failures.push(`load metric missing: ${metric}`);
if (!script.includes("confirmation !== 'I_UNDERSTAND'")) failures.push('load test does not require disposable-data confirmation');
if (!script.includes("/^https:\\/\\//.test(baseUrl)")) failures.push('load test does not require HTTPS staging URL');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('staging load-test scenarios and safety gates passed');
