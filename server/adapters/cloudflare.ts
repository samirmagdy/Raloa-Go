import { cloudflareRequest } from '../../server-services';
import type { CloudflareProvider } from '../core/providers';

export const cloudflareAdapter: CloudflareProvider = { request: cloudflareRequest };
