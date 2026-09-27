const services = (process.env.ROLLBACK_SERVICES || 'raloa-public-web,raloa-studio-api,raloa-background-worker').split(',').map((value) => value.trim()).filter(Boolean);
const revision = String(process.env.ROLLBACK_REVISION || '').trim();
const revisionMap = new Map((process.env.ROLLBACK_REVISIONS || '').split(',').map((entry) => entry.split('=').map((value) => value.trim())).filter(([service, target]) => service && target));
const region = String(process.env.CLOUD_RUN_REGION || '').trim();
if (process.env.ROLLBACK_CONFIRM !== 'I_UNDERSTAND') throw new Error('Set ROLLBACK_CONFIRM=I_UNDERSTAND to perform a production rollback.');
if ((!revision && revisionMap.size === 0) || !region) throw new Error('Set ROLLBACK_REVISION or ROLLBACK_REVISIONS, plus CLOUD_RUN_REGION.');

for (const service of services) {
  const target = revisionMap.get(service) || revision;
  if (!target) throw new Error(`No rollback revision provided for ${service}.`);
  const result = await import('node:child_process').then(({ execFileSync }) => execFileSync('gcloud', ['run', 'services', 'update-traffic', service, '--region', region, '--to-revisions', `${target}=100`], { encoding: 'utf8', stdio: 'inherit' }));
  void result;
  console.log(`Rolled back ${service} to ${target}`);
}
