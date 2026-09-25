import fs from 'node:fs';
import path from 'node:path';

const endpointDir = path.resolve('docs/api/endpoints');
const files = fs.readdirSync(endpointDir).filter((file) => file.endsWith('.md'));
const paths = {};
for (const file of files) {
  const text = fs.readFileSync(path.join(endpointDir, file), 'utf8');
  const method = text.match(/^method:\s*(\w+)/m)?.[1]?.toLowerCase();
  const route = text.match(/^path:\s*(.+)$/m)?.[1]?.trim();
  if (!method || !route) continue;
  const openapiPath = route.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
  paths[openapiPath] ||= {};
  paths[openapiPath][method] = {
    operationId: `${method}_${file.replace(/\.md$/, '').replace(/[^a-z0-9]+/gi, '_')}`,
    responses: { '200': { description: 'Successful response' }, '400': { description: 'Invalid request' }, '401': { description: 'Authentication required' } }
  };
}

const yaml = [
  'openapi: 3.0.3',
  'info:',
  '  title: RALOA API',
  '  version: 1.0.0',
  '  description: Server-authoritative API surface for the RALOA product.',
  'servers:',
  '  - url: https://raloa.app',
  'paths:'
];
for (const [route, operations] of Object.entries(paths).sort()) {
  yaml.push(`  ${route}:`);
  for (const [method, operation] of Object.entries(operations)) {
    yaml.push(`    ${method}:`);
    yaml.push(`      operationId: ${operation.operationId}`);
    yaml.push('      responses:');
    for (const [status, response] of Object.entries(operation.responses)) {
      yaml.push(`        '${status}':`);
      yaml.push(`          description: ${response.description}`);
    }
  }
}
fs.writeFileSync(path.resolve('docs/api/openapi.yaml'), `${yaml.join('\n')}\n`);
