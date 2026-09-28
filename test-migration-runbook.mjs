import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

function run(args) {
  return spawnSync(process.execPath, ['scripts/run-migration-runbook.mjs', ...args], { cwd: process.cwd(), encoding: 'utf8', env: { PATH: process.env.PATH } });
}

let result = run(['--stage=5', '--json']);
assert.notEqual(result.status, 0);
assert.match(result.stdout + result.stderr, /authority cutover gate failed/);

result = run(['--stage=8', '--json']);
assert.notEqual(result.status, 0);
assert.match(result.stdout + result.stderr, /decommission gate failed/);

result = run(['--stage=9', '--json']);
assert.notEqual(result.status, 0);
assert.match(result.stdout + result.stderr, /stage must be an integer/);

console.log('migration runbook gate tests passed');
