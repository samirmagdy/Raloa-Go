import fs from 'node:fs';

const required = [
  ['deploy/cloud-run/public-web.yaml', 'public-web'],
  ['deploy/cloud-run/studio-api.yaml', 'studio-api'],
  ['deploy/cloud-run/background-worker.yaml', 'background-worker']
];
const failures = [];
for (const [file, role] of required) {
  if (!fs.existsSync(file)) failures.push(`${file} is missing`);
  else {
    const text = fs.readFileSync(file, 'utf8');
    if (!text.includes(`value: ${role}`)) failures.push(`${file} does not declare SERVICE_ROLE=${role}`);
    if (!text.includes('serviceAccountName:')) failures.push(`${file} does not declare a runtime service account`);
    if (!text.includes('autoscaling.knative.dev/minScale')) failures.push(`${file} does not declare scaling bounds`);
  }
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('deployment topology manifests passed');

