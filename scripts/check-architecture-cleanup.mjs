const required = [
  ['FIRESTORE_RECONCILIATION_STATUS', 'passed', 'Firestore reconciliation'],
  ['MEDIA_R2_RECONCILIATION_STATUS', 'passed', 'R2 media reconciliation'],
  ['NEXT_API_INVENTORY_STATUS', 'passed', 'Next API inventory'],
  ['NEXT_FUNCTIONAL_EQUIVALENCE_STATUS', 'passed', 'functional equivalence'],
  ['NEXT_VITE_MIGRATION_STATUS', 'passed', 'Vite migration'],
  ['NEXT_PARITY_OBSERVATION_STATUS', 'passed', 'parity observation']
];

const blockers = [];
for (const [name, expected, label] of required) {
  if (process.env[name] !== expected) blockers.push(`${name}=${expected} is required for ${label}.`);
}
if (process.env.ARCHITECTURE_CLEANUP_APPROVED !== 'true') {
  blockers.push('ARCHITECTURE_CLEANUP_APPROVED=true is required for destructive cleanup.');
}

if (blockers.length) {
  console.error('Architectural cleanup gate blocked:');
  for (const blocker of blockers) console.error(`- ${blocker}`);
  console.error('Run the bounded Firestore, media R2, and Next runtime gates before deleting active compatibility paths.');
  process.exit(1);
}

console.log('Architectural cleanup prerequisites passed. Run the reviewed deletion change and full regression suite.');

