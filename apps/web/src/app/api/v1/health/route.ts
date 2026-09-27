import type { HealthService } from '@raloa/api';

const healthService: HealthService = {
  async check() {
    return { status: 'ok', service: 'raloa-web', version: process.env.npm_package_version || 'workspace' };
  },
};

export async function GET() {
  const result = await healthService.check();
  return Response.json(result, { status: result.status === 'ok' ? 200 : 503, headers: { 'cache-control': 'no-store' } });
}
