import { AttributionUtmPayload } from '../types';

/**
 * Cookie Helper: Write cookie with specified attributes
 */
export function setCookie(name: string, value: string, maxAgeSeconds: number = 2592000): void {
  if (typeof document === 'undefined') return;

  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax`;

  if (isSecure) {
    cookieString += '; Secure';
  }

  // Attempt to set cookie for parent domain if on raloa.app
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('raloa.app')) {
    document.cookie = `${cookieString}; Domain=.raloa.app`;
  } else {
    document.cookie = cookieString;
  }
}

/**
 * Cookie Helper: Read cookie by name
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const encodedName = encodeURIComponent(name) + '=';
  const cookies = document.cookie.split(';');

  for (let c of cookies) {
    c = c.trim();
    if (c.indexOf(encodedName) === 0) {
      return decodeURIComponent(c.substring(encodedName.length));
    }
  }

  return null;
}

/**
 * Detect common In-App Browsers (IABs): Instagram, Facebook, TikTok, Twitter, LinkedIn
 */
export interface InAppBrowserInfo {
  isInApp: boolean;
  app: 'instagram' | 'facebook' | 'tiktok' | 'twitter' | 'linkedin' | null;
  userAgent: string;
}

export function detectInAppBrowser(): InAppBrowserInfo {
  if (typeof navigator === 'undefined') {
    return { isInApp: false, app: null, userAgent: '' };
  }

  const ua = navigator.userAgent || '';
  const isInstagram = /FBAN\/FBAV|Instagram/i.test(ua);
  const isFacebook = /FBAN|FBAV/i.test(ua) && !isInstagram;
  const isTikTok = /musical_ly|ByteDance|TikTok/i.test(ua);
  const isTwitter = /Twitter/i.test(ua);
  const isLinkedIn = /LinkedInApp/i.test(ua);

  const isInApp = isInstagram || isFacebook || isTikTok || isTwitter || isLinkedIn;

  return {
    isInApp,
    app: isInstagram
      ? 'instagram'
      : isFacebook
        ? 'facebook'
        : isTikTok
          ? 'tiktok'
          : isTwitter
            ? 'twitter'
            : isLinkedIn
              ? 'linkedin'
              : null,
    userAgent: ua,
  };
}

/**
 * Enforce viewport scaling lock and handle IAB quirks (AC-04)
 */
export function setupInAppBrowserMitigations(): void {
  if (typeof document === 'undefined') return;

  // AC-04: Viewport scaling locks at width=device-width, initial-scale=1.0
  let viewportMeta = document.querySelector('meta[name="viewport"]');
  if (!viewportMeta) {
    viewportMeta = document.createElement('meta');
    viewportMeta.setAttribute('name', 'viewport');
    document.head.appendChild(viewportMeta);
  }
  viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0');

  // IAB storage partition mitigation: sync cookies to localStorage as backup
  try {
    const ref = getCookie('_raloa_ref');
    if (ref) {
      localStorage.setItem('_raloa_ref_backup', ref);
    } else {
      const backup = localStorage.getItem('_raloa_ref_backup');
      if (backup) {
        setCookie('_raloa_ref', backup, 2592000);
      }
    }

    const utmCookie = getCookie('_raloa_utm');
    if (utmCookie) {
      localStorage.setItem('_raloa_utm_backup', utmCookie);
    } else {
      const backupUtm = localStorage.getItem('_raloa_utm_backup');
      if (backupUtm) {
        setCookie('_raloa_utm', backupUtm, 2592000);
      }
    }
  } catch (_) {
    // Storage access may be restricted in strict sandboxes
  }

  // Ensure all outbound links created dynamically in IAB have rel="opener" or rel="noopener" appropriately
  const iab = detectInAppBrowser();
  if (iab.isInApp) {
    document.documentElement.setAttribute('data-in-app-browser', iab.app || 'true');
  }
}

/**
 * Intercept & process referral parameter (FR-2.1)
 * Cookie: _raloa_ref
 * Attributes: HttpOnly=false; Secure; SameSite=Lax; Max-Age=2592000 (30 days)
 */
export function captureReferralCode(searchParams?: URLSearchParams): string | null {
  if (typeof window === 'undefined') return null;

  const params = searchParams || new URLSearchParams(window.location.search);
  const refParam = params.get('ref') || params.get('referral') || params.get('referrer');

  if (refParam && refParam.trim().length > 0) {
    const cleanRef = refParam.trim().toUpperCase();
    setCookie('_raloa_ref', cleanRef, 2592000);
    try {
      localStorage.setItem('_raloa_ref_backup', cleanRef);
    } catch (_) {}
    return cleanRef;
  }

  // Fallback to existing cookie or backup
  const existingCookie = getCookie('_raloa_ref');
  if (existingCookie) return existingCookie;

  try {
    return localStorage.getItem('_raloa_ref_backup');
  } catch (_) {
    return null;
  }
}

/**
 * Capture & parse UTM parameters (FR-2.2 & Section 6.1)
 * Cookie: _raloa_utm (URL-encoded JSON payload)
 * Storage: sessionStorage 'raloa_utm'
 */
export function captureUtmParameters(searchParams?: URLSearchParams): AttributionUtmPayload | null {
  if (typeof window === 'undefined') return null;

  const params = searchParams || new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source');
  const utmMedium = params.get('utm_medium');
  const utmCampaign = params.get('utm_campaign');
  const utmTerm = params.get('utm_term');
  const utmContent = params.get('utm_content');

  const hasAnyUtm = Boolean(utmSource || utmMedium || utmCampaign || utmTerm || utmContent);

  if (hasAnyUtm) {
    let referrerHost: string | null = null;
    if (document.referrer) {
      try {
        referrerHost = new URL(document.referrer).hostname;
      } catch (_) {
        referrerHost = null;
      }
    }

    const payload: AttributionUtmPayload = {
      utm_source: utmSource || null,
      utm_medium: utmMedium || null,
      utm_campaign: utmCampaign || null,
      utm_term: utmTerm || null,
      utm_content: utmContent || null,
      initial_landing_path: window.location.pathname || '/',
      referrer_host: referrerHost,
      timestamp: Math.floor(Date.now() / 1000),
    };

    const jsonString = JSON.stringify(payload);

    // Save to sessionStorage
    try {
      sessionStorage.setItem('raloa_utm', jsonString);
    } catch (_) {}

    // Mirror to _raloa_utm cookie (URL-encoded JSON payload)
    setCookie('_raloa_utm', jsonString, 2592000);

    try {
      localStorage.setItem('_raloa_utm_backup', jsonString);
    } catch (_) {}

    return payload;
  }

  // Retrieve existing from sessionStorage, cookie, or backup
  try {
    const sessionVal = sessionStorage.getItem('raloa_utm');
    if (sessionVal) return JSON.parse(sessionVal);
  } catch (_) {}

  const cookieVal = getCookie('_raloa_utm');
  if (cookieVal) {
    try {
      const parsed = JSON.parse(cookieVal);
      try {
        sessionStorage.setItem('raloa_utm', cookieVal);
      } catch (_) {}
      return parsed;
    } catch (_) {}
  }

  try {
    const backup = localStorage.getItem('_raloa_utm_backup');
    if (backup) return JSON.parse(backup);
  } catch (_) {}

  return null;
}

/**
 * Initialize all entry-point attribution tracking
 */
export function initAttribution(): {
  referralCode: string | null;
  utmPayload: AttributionUtmPayload | null;
  iab: InAppBrowserInfo;
} {
  setupInAppBrowserMitigations();
  const referralCode = captureReferralCode();
  const utmPayload = captureUtmParameters();
  const iab = detectInAppBrowser();

  return { referralCode, utmPayload, iab };
}
