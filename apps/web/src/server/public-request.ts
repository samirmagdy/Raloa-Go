import { headers } from 'next/headers';
import { webConfig } from '../env';

export async function getRequestHost() {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || new URL(webConfig.appUrl).host;
  return forwarded.split(',')[0].trim().split(':')[0].toLowerCase().replace(/\.$/, '');
}

export function isCustomPublicHost(host: string) {
  const appHost = new URL(webConfig.appUrl).hostname.toLowerCase();
  return host !== appHost && host !== 'www.' + appHost && host !== 'localhost' && host !== '127.0.0.1';
}

export function publicOrigin(host: string) {
  return isCustomPublicHost(host) ? `https://${host}` : webConfig.appUrl;
}
