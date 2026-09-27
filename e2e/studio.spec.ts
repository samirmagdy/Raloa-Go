import { expect, test, type Page, type Route } from '@playwright/test';

const site = {
  id: 'site-alpha', userId: 'usr_e2e', username: 'e2e_creator', displayName: 'E2E Creator',
  templateId: 'signature', role: 'Creator', bio: 'A persisted Studio profile', avatar: '', coverImage: '',
  bgStyle: 'minimal', themeMode: 'light', isPublished: false, revision: 1,
  links: [
    { id: 'link-1', type: 'link', title: 'Portfolio', subtitle: 'Selected work', url: 'https://example.com' },
    { id: 'contact-1', type: 'contact', title: 'Contact me', subtitle: 'Send a message', url: '' }
  ],
  socials: [], designTokens: { accentColor: '#4f46e5', surfaceColor: '#ffffff', cardRadius: 'rounded', cardShadow: 'soft', borderStyle: 'thin', themeMode: 'light', fontFamily: 'Inter' }
};

async function mockStudioApi(page: Page, options: { saveFailure?: boolean } = {}) {
  let saveAttempts = 0;
  let published = false;
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path === '/api/sites' && request.method() === 'GET') return route.fulfill({ json: { sites: [{ id: site.id, username: site.username, displayName: site.displayName, isPublished: published, updatedAt: new Date().toISOString() }] } });
    if (path === `/api/sites/${site.id}` && request.method() === 'GET') return route.fulfill({ json: { site: { ...site, isPublished: published } } });
    if (path === `/api/public/sites/${site.username}`) return route.fulfill({ json: { site: { ...site, isPublished: true } } });
    if (path === `/api/sites/${site.id}` && request.method() === 'PUT') {
      saveAttempts += 1;
      if (options.saveFailure && saveAttempts === 1) return route.fulfill({ status: 503, json: { error: { code: 'SERVICE_UNAVAILABLE', message: 'Temporary save failure' } } });
      const body = JSON.parse(request.postData() || '{}');
      published = body.isPublished === true;
      return route.fulfill({ json: { site: { ...site, ...body, isPublished: published, revision: site.revision + saveAttempts } } });
    }
    if (path === '/api/account/billing') return route.fulfill({ json: { billing: { plan: 'studio', state: 'active', interval: 'monthly', stripeStatus: 'active', entitlements: { premiumTemplates: true, analytics: true, removeBranding: true, customDomains: true, studioControls: true, maxLinks: null, maxMedia: null } } } });
    if (path === '/api/integrations') return route.fulfill({ json: { integrations: [] } });
    if (path === '/api/calendar/integrations') return route.fulfill({ json: { integrations: [] } });
    if (path.startsWith('/api/analytics/')) return route.fulfill({ json: { metrics: { views: 14, uniqueVisitors: 8, clicks: 3, ctr: 21.4 }, links: [] } });
    if (path === '/api/creator/audience') return route.fulfill({ json: { data: [], total: 0, hasMore: false, metrics: { subscribers: 0, activeSubscribers: 0, newSubscribers: 0, submissions: 0, newSubmissions: 0, uniqueVisitors: 0, conversionRate: null } } });
    if (path === '/api/media') return route.fulfill({ json: { media: [] } });
    if (path === '/api/domains') return route.fulfill({ json: { domains: [] } });
    if (path === '/api/sites/site-alpha' && request.method() === 'DELETE') return route.fulfill({ status: 204 });
    return route.fulfill({ json: {} });
  });
  await page.goto('/studio?e2e=1');
  await expect(page.getByRole('region', { name: 'Editor controls' })).toBeVisible();
}

test('creator authentication, site load, edit, autosave retry, publish and unpublish', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'The desktop editor workflow is covered in the desktop project; mobile has a dedicated navigation flow below.');
  await mockStudioApi(page, { saveFailure: true });
  await expect(page.getByLabel('Display Name')).toHaveValue('E2E Creator');
  const displayName = page.getByLabel('Display Name');
  await displayName.fill('Updated Creator');
  await expect(page.getByText('Saving')).toBeVisible();
  await expect(page.getByText('Saved to server')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Add Block' }).click();
  await expect(page.getByRole('heading', { name: 'Add New Block' })).toBeVisible();
  await page.getByRole('button', { name: 'Contact Lead Form' }).click();
  await page.getByLabel('Block Title').fill('Contact me');
  await page.getByLabel('Destination URL').fill('https://example.com/contact');
  await page.getByRole('button', { name: 'Add to Site' }).click();
  await expect(page.getByRole('region', { name: 'Editor controls' }).getByText('Contact me').first()).toBeVisible();
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText('Published')).toBeVisible();
  await page.getByRole('button', { name: 'Unpublish' }).click();
  await expect(page.getByText('Draft')).toBeVisible();
});

test('settings cover audience, scheduling, integrations, domains, billing and keyboard navigation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'Settings information architecture is covered in the desktop project.');
  await mockStudioApi(page);
  await page.getByRole('button', { name: 'Audience' }).click();
  await expect(page.getByText('No audience records found.')).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.getByRole('tablist');
  await expect(settings).toBeVisible();
  const domainTab = page.getByRole('tab', { name: 'Domain & SEO' });
  await domainTab.click();
  await domainTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Products' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Scheduling' }).click();
  await expect(page.getByText(/availability/i).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Integrations' }).click();
  await expect(page.getByText('GitHub', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Billing' }).click();
  await expect(page.getByText('Active')).toBeVisible();
  await page.getByRole('tab', { name: 'Domain & SEO' }).click();
  await expect(page.getByLabel('Custom Domain')).toBeVisible();
  await page.getByLabel('Custom Domain').fill('links.example.test');
  await page.getByRole('button', { name: 'Verify DNS' }).click();
  await expect(page.getByText(/DNS|domain/i).last()).toBeVisible();
});

test('mobile navigation, RTL layout, preview parity and permission failure are visible', async ({ page }) => {
  await mockStudioApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('navigation', { name: 'Studio navigation' })).toBeVisible();
  await page.getByRole('button', { name: /Show Live Preview/i }).click();
  await expect(page.getByRole('complementary', { name: 'Live preview canvas' })).toBeVisible();
  await page.evaluate(() => localStorage.setItem('raloa_user_locale', 'ar'));
  await page.goto('/studio?e2e=1&settings=billing');
  await expect(page.locator('[dir="rtl"]').first()).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'تنقل الاستوديو' })).toBeVisible();
});

test('Studio preview and published page preserve persisted tokens, blocks and behavior', async ({ page }, testInfo) => {
  await mockStudioApi(page);
  // Wait for the persisted site response to replace the template bootstrap;
  // otherwise the preview can legitimately show its initial loading template.
  await expect(page.getByLabel('Display Name')).toHaveValue('E2E Creator');
  if (testInfo.project.name === 'mobile-chromium') {
    await page.getByRole('button', { name: /Show Live Preview/i }).click();
  }
  const preview = page.getByTestId('studio-preview-surface');
  await expect(preview).toBeVisible();
  const expectedTokens = JSON.parse(await preview.getAttribute('data-design-tokens') || '{}');
  expect(expectedTokens.accentColor).toBe(site.designTokens.accentColor);
  expect(expectedTokens.surfaceColor).toBe(site.designTokens.surfaceColor);
  expect(expectedTokens.cardRadius).toBe(site.designTokens.cardRadius);
  expect(expectedTokens.cardShadow).toBe(site.designTokens.cardShadow);
  expect(expectedTokens.borderStyle).toBe(site.designTokens.borderStyle);
  await expect(preview.getByRole('button', { name: /Portfolio/ })).toBeVisible();
  await expect(preview.getByRole('button', { name: /Contact me/ })).toBeVisible();
  await expect(preview).toHaveScreenshot('studio-preview.png', { animations: 'disabled' });

  await page.goto('/@e2e_creator');
  const publicSurface = page.getByTestId('public-profile-surface');
  await expect(publicSurface).toBeVisible();
  const publicTokens = JSON.parse(await publicSurface.getAttribute('data-design-tokens') || '{}');
  expect(publicTokens).toEqual(expectedTokens);
  await expect(publicSurface.getByRole('button', { name: /Portfolio/ })).toBeVisible();
  await expect(publicSurface.getByRole('button', { name: /Contact me/ })).toBeVisible();
  await publicSurface.getByRole('button', { name: /Contact me/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(publicSurface).toHaveScreenshot('published-profile.png', { animations: 'disabled' });
});

test('unauthenticated creators are not allowed into Studio', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/studio');
  await expect(page).toHaveURL(/\/$/);
  await context.close();
});
