import type { EmailProvider } from '../core/providers';

export const resendEmailAdapter: EmailProvider = {
  async send(message) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL || 'RALOA <noreply@raloa.app>', ...message })
    });
    if (!response.ok) throw new Error('EMAIL_DELIVERY_FAILED');
  }
};
