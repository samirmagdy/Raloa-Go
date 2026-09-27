import { calendarAdapter, calendarOAuthConfiguration, type CalendarProvider } from '../../server-calendar';
import type { OAuthProviderAdapter } from '../domains/integrations/oauth-service';

/** Provider token operations exposed to the integration service only. */
export function oauthProviderAdapters(): OAuthProviderAdapter[] {
  return (['google', 'outlook'] as CalendarProvider[]).map((provider) => {
    const adapter = calendarAdapter(provider);
    const configuration = calendarOAuthConfiguration(provider);
    return {
      provider,
      allowedScopes: configuration?.scopes || [],
      refresh: async (tokens) => {
        if (!tokens.refreshToken) throw new Error('OAUTH_REAUTH_REQUIRED');
        const refreshed = await adapter.refresh({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt || 0 });
        return refreshed;
      }
    } satisfies OAuthProviderAdapter;
  });
}
