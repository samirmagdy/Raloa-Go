import fs from 'node:fs';

const source = fs.readFileSync('docs/capacity-plan.md', 'utf8');
const required = [
  'Workload assumptions',
  'Derived peak load',
  'PostgreSQL',
  'Queues and workers',
  'Media storage and CDN',
  'Analytics',
  'Scaling triggers and review',
  'reversal plan'
];
const missing = required.filter((section) => !source.toLowerCase().includes(section.toLowerCase()));
if (missing.length) {
  console.error(`Capacity plan is missing required sections: ${missing.join(', ')}`);
  process.exit(1);
}
if (!/planning case/i.test(source) || !/95% CDN hit rate/i.test(source)) {
  console.error('Capacity plan must identify a bounded planning case and CDN assumption.');
  process.exit(1);
}
console.log('capacity plan check passed');
