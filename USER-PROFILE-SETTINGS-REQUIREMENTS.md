# RALOA User Profile & Settings Requirements

## 1. Product boundary

RALOA needs two distinct settings areas:

1. **Account Profile** — the creator’s identity, login, privacy, billing, referrals, and account lifecycle.
2. **Site Settings** — the public mini-site’s content, appearance, SEO, integrations, domain, and publishing behavior.

These must not be mixed. A user may change their public display name without changing their login identity, and may change their site without changing their account security or billing.

## 2. Entry points and information architecture

### Account menu

The authenticated avatar menu should contain:

- View public profile
- Account profile
- Site settings
- Billing & plan
- Referral rewards
- Help and support
- Sign out

### Account settings navigation

Use these sections in this order:

1. Profile
2. Security & login
3. Notifications
4. Privacy & data
5. Billing & plan
6. Referrals & rewards
7. Connected apps
8. Danger zone

### Site settings navigation

Keep the existing Studio settings separate:

1. General site
2. Domain & SEO
3. Integrations
4. Billing capability status
5. Advanced / import-export

## 3. Account Profile

### Required fields

| Field | Type | Rules | Visibility |
| --- | --- | --- | --- |
| Avatar | image URL / uploaded asset | JPG, PNG, WebP; max 5 MB; safe fallback | Public if enabled |
| Display name | string | Required; 1–80 characters | Public |
| Handle | lowercase string | `a-z`, `0-9`, `_`, `-`; 3–30 chars; reserved words blocked; changed only through server reservation flow | Public URL |
| Email | email | Read-only display; verified state required | Private |
| Bio | string | 0–500 characters in account profile | Optional public |
| Pronouns | enum/string | Optional; user-controlled visibility | Optional public |
| Location | string | 0–100 characters | Optional public |
| Website | URL | HTTPS preferred; validated | Optional public |
| Language | `en` / `ar` | Controls interface language | Private |
| Time zone | IANA time zone | Defaults from browser; used for bookings and notifications | Private |

### Profile actions

- Edit and save profile.
- Cancel unsaved changes.
- Reset profile fields to last saved values.
- Upload, crop, replace, and remove avatar.
- Copy public profile URL.
- Open public profile in a new tab.
- Show unsaved-changes warning when leaving.
- Show last saved timestamp and save status.

### Profile states

- Loading skeleton
- Empty/default profile
- Editing
- Saving
- Saved
- Validation error
- Uploading
- Upload failed with retry
- Offline/local recovery copy
- Read-only field state

## 4. Security & login

### Authentication

- Current email address and verification state.
- Resend verification email.
- Change email with current-password or recent-login confirmation.
- Change password with current password, new password, confirmation, and strength meter.
- Forgot-password flow.
- List active sessions/devices.
- Revoke an individual session.
- Sign out of all other sessions.
- Last login date, device, approximate location, and authentication method.

### Multi-provider login

Show connected providers:

- Email/password
- Google
- Apple, when enabled

Allow connect/disconnect only when the account retains at least one recovery method. Do not allow removing the final provider without a replacement method.

### Security safeguards

- Re-authenticate before email, password, provider, export, or deletion changes.
- Require secure password policy and prevent known compromised passwords where supported.
- Never display passwords or raw reset tokens.
- Rate-limit password reset and login attempts.
- Show clear session-expiration and recovery states.

## 5. Notifications

Notification preferences must be explicit and independently controllable:

- Product updates
- Billing and payment failures — mandatory for paid accounts
- Domain verification and SSL status
- Booking requests
- Order updates
- Referral qualification and rewards
- Weekly analytics summary
- Security alerts — mandatory

Each preference needs channel controls where supported:

- Email
- In-app

Defaults must be safe, localized, and documented. Saving preferences must be idempotent and show the effective state returned by the server.

## 6. Privacy & data

- Public profile visibility: published / unpublished.
- Search-engine indexing preference, with a warning that public profiles may be indexed.
- Sensitive-content warning.
- Analytics collection toggle where legally allowed.
- Cookie/consent preferences.
- Download personal data export.
- Request account data correction.
- Request account deletion.
- Clear local cached drafts from this device.

The UI must clearly distinguish:

- Account data
- Public site data
- Visitor analytics
- Third-party integrations

## 7. Billing & plan

The billing section must be server-authoritative and show:

- Current plan: Free, Pro, or Studio.
- Billing interval: monthly or yearly.
- Subscription status: active, trialing, past due, canceled, incomplete, or free.
- Renewal date.
- Current amount and currency.
- Payment method summary, never full card details.
- Invoice history and downloadable invoices.
- Stripe customer portal action.
- Upgrade, downgrade, and cancellation actions.
- Grace-period and failed-payment messaging.
- Referral-earned benefits and their expiry dates.

The client must never unlock paid features solely because a local plan value changed. The UI should refresh the profile only after Stripe webhook synchronization.

## 8. Referrals & rewards

Show:

- Personal referral link.
- Copy/share actions.
- Qualified referrals count.
- Pending invitations.
- Earned rewards.
- Progress toward the next reward.
- Reward expiration date.
- Reward history and status.

Rules:

- No self-referrals.
- No duplicate qualification.
- Qualification only after account creation and server validation.
- Reward state is server-owned.
- Client cannot write referral counts, plan upgrades, or reward flags.

## 9. Connected apps and integrations

Show each integration with status, scope, last sync, and revoke action:

- Google Analytics 4
- Meta Pixel
- Webhooks
- Calendar/booking provider, when available
- Import/export integrations

Requirements:

- Secrets are masked and never returned to the browser after save.
- Validate HTTPS callback and webhook URLs.
- Provide test-connection action.
- Provide delivery history and retry for webhooks.
- Revoke removes access and stops future delivery.
- Paid-only integrations show a clear upgrade explanation.

## 10. Site Settings requirements

### General site

- Site display name.
- Public handle.
- Bio and Arabic bio.
- Avatar and cover image.
- Template selection.
- Immersive preview mode as the default template preview.
- Theme mode: light, dark, or system.
- Accent/surface colors.
- Card radius, shadow, and border style.
- Sensitive-content warning.
- Publish/unpublish control.
- Preview public site.

### Domain & SEO

- Default `raloa.app/@handle` URL.
- Custom-domain input.
- DNS instructions with exact record values.
- Ownership verification state.
- SSL provisioning state.
- Active, pending, failed, removed, and retry states.
- SEO title and description.
- Canonical URL preview.
- OpenGraph preview.
- Indexing toggle with confirmation.
- Remove custom domain action with confirmation.

### Content and publishing

- Link/media list with drag-and-drop ordering.
- Link title, Arabic title, subtitle, URL, thumbnail, and type.
- Link validation and broken-link warning.
- Draft versus published state.
- Save draft, publish, unpublish, and revert actions.
- Publish confirmation containing the final public URL.
- Plan-based limits shown before the user hits the limit.

## 11. Permissions and plan matrix

| Capability | Free | Pro | Studio |
| --- | --- | --- | --- |
| Account profile | Yes | Yes | Yes |
| Public RALOA URL | Yes | Yes | Yes |
| Basic templates | Yes | Yes | Yes |
| Link limit | 10 | Higher/verified limit | Higher/verified limit |
| Remove RALOA branding | No | Yes | Yes |
| Custom domain | No | Yes | Yes |
| Advanced analytics | No | Yes | Yes |
| GA4 / Meta Pixel | No | Yes | Yes |
| Webhooks | No | Yes | Yes |
| Studio controls | No | Limited | Yes |
| Referral benefits | Earn/use according to reward rules | Yes | Yes |

The same capability definition must be used by pricing copy, Studio UI, API handlers, and Firestore rules. If a capability is not implemented end to end, it must not be advertised as available.

## 12. Data model additions

### `users/{uid}`

```ts
{
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string;
  handle: string;
  photoURL: string | null;
  bio?: string;
  pronouns?: string;
  location?: string;
  website?: string;
  locale: 'en' | 'ar';
  timeZone: string;
  notificationPreferences: Record<string, boolean>;
  privacyPreferences: Record<string, boolean>;
  plan: 'free' | 'pro' | 'studio';
  billingStatus: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  referralRewards: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
```

### Supporting collections

- `users/{uid}/sessions/{sessionId}`
- `users/{uid}/security_events/{eventId}`
- `users/{uid}/notification_preferences/{preferenceId}` or embedded preferences
- `users/{uid}/data_export_requests/{requestId}`
- `users/{uid}/deletion_requests/{requestId}`
- `users/{uid}/integrations/{integrationId}`
- `users/{uid}/sites/{siteId}`
- `custom_domains/{domainId}`
- `stripe_events/{eventId}`

Sensitive fields, entitlements, session records, and integration secrets must be Admin/server-write-only.

## 13. API requirements

Required account endpoints:

- `GET /api/account/profile`
- `PUT /api/account/profile`
- `POST /api/account/avatar`
- `POST /api/account/email/change`
- `POST /api/account/password/change`
- `GET /api/account/sessions`
- `DELETE /api/account/sessions/:sessionId`
- `POST /api/account/sessions/revoke-all`
- `GET /api/account/notifications`
- `PUT /api/account/notifications`
- `GET /api/account/privacy`
- `PUT /api/account/privacy`
- `POST /api/account/data-export`
- `POST /api/account/delete`
- `GET /api/billing/status`
- `GET /api/referrals/summary`
- `GET /api/integrations`
- `POST /api/integrations/:integrationId/test`
- `DELETE /api/integrations/:integrationId`

Every endpoint requires:

- Authentication where applicable.
- Schema validation.
- Stable error code and message.
- Ownership checks.
- Audit logging for security-sensitive actions.
- Idempotency for repeated mutation requests.
- Rate limits for upload, password, email, export, and deletion actions.

## 14. UX and accessibility requirements

- Responsive at 320, 375, 430, 768, 1280, and 1440px.
- No horizontal scrolling.
- Mobile settings use a stacked navigation or bottom sheet.
- Desktop settings use a left rail and content panel.
- Every form field has a visible label, help text where needed, and error association.
- Keyboard navigation and visible focus states.
- Destructive actions require confirmation and are not adjacent to primary save actions.
- Arabic RTL mirrors layout, icons, alignment, and directional copy.
- Toasts are supplemented by inline status for important changes.
- Unsaved changes are recoverable and never silently discarded.

## 15. Business and product analytics

Track:

- Profile completion percentage.
- Profile save success/failure.
- Avatar upload success/failure.
- Public profile publish/unpublish.
- Handle availability and failed reservations.
- Settings section visits.
- Upgrade CTA impressions and conversions.
- Billing portal opens and completed changes.
- Referral link copies/shares and qualified referrals.
- Domain verification attempts and activation time.
- Integration connection/test/revoke events.
- Data export and deletion requests.

Do not record passwords, access tokens, full payment details, or raw private profile fields in analytics.

## 16. Acceptance criteria

The feature is complete when:

- Account and site settings are visibly separated.
- A user can update profile data and see the saved server response.
- Handle changes are validated, reserved atomically, and cannot be changed by direct Firestore writes.
- Security actions require appropriate re-authentication.
- Billing status is webhook-driven and cannot be faked in the browser.
- Referral balances and rewards are server-authoritative.
- Domain and integration states expose actionable pending/failed/retry states.
- Export and deletion requests have confirmation, status, and recovery/support paths.
- Free/pro/studio capability gates are identical in UI, API, and rules.
- All forms work with keyboard, mobile, RTL, loading, error, and offline states.
- API contracts, Firestore rules tests, and browser acceptance tests cover every critical path.
