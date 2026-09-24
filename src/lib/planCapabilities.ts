import { UserProfile } from '../types';

export type PlanTier = 'free' | 'pro' | 'studio';

export interface PlanCapabilities {
  maxLinks: number;
  maxMedia: number;
  premiumTemplates: boolean;
  analytics: boolean;
  removeBranding: boolean;
  customDomains: boolean;
  studioControls: boolean;
}

const CAPABILITIES: Record<PlanTier, PlanCapabilities> = {
  free: {
    maxLinks: 10,
    maxMedia: 10,
    premiumTemplates: false,
    analytics: false,
    removeBranding: false,
    customDomains: false,
    studioControls: false
  },
  pro: {
    maxLinks: Number.POSITIVE_INFINITY,
    maxMedia: Number.POSITIVE_INFINITY,
    premiumTemplates: true,
    analytics: true,
    removeBranding: true,
    customDomains: true,
    studioControls: false
  },
  studio: {
    maxLinks: Number.POSITIVE_INFINITY,
    maxMedia: Number.POSITIVE_INFINITY,
    premiumTemplates: true,
    analytics: true,
    removeBranding: true,
    customDomains: true,
    studioControls: true
  }
};

export function getPlanTier(profile?: Pick<UserProfile, 'plan' | 'referralProUntil'> | null): PlanTier {
  if (!profile) return 'free';
  if (profile.plan === 'pro' && profile.referralProUntil && Date.parse(profile.referralProUntil) <= Date.now()) return 'free';
  return profile.plan || 'free';
}

export function getPlanCapabilities(profile?: Pick<UserProfile, 'plan' | 'referralProUntil'> | null): PlanCapabilities {
  return CAPABILITIES[getPlanTier(profile)];
}
