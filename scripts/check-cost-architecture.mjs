import fs from 'node:fs';

const source = fs.readFileSync('docs/cost-architecture.md', 'utf8');
const required = [
  'Monthly cost envelope',
  'Unit economics',
  'Cost alerts',
  'Disproportionate adoption risks',
  'CDN/network',
  'analytics',
  'payment processing',
  'reversal plan'
];
const missing = required.filter((section) => !source.toLowerCase().includes(section.toLowerCase()));
if (missing.length) {
  console.error(`Cost architecture is missing required sections: ${missing.join(', ')}`);
  process.exit(1);
}
if (!/\$3,570\/month/.test(source) || !/\$0\.12/.test(source)) {
  console.error('Cost architecture must include the planning total and blended creator unit cost.');
  process.exit(1);
}
console.log('cost architecture check passed');
