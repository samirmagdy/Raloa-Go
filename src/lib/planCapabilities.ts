import { UserProfile } from '../types';

export type PlanTier = 'free' | 'pro' | 'studio';

export interface PlanCapabilities {
  maxLinks: number;
  maxMedia: number;
  maxUploadBytes: number;
  premiumTemplates: boolean;
  analytics: boolean;
  removeBranding: boolean;
  customDomains: boolean;
  studioControls: boolean;
  allowedBackgroundStyles: readonly string[];
  allowedBlockTypes: readonly string[];
  allowedDesignOptions: {
    cardRadius: readonly string[];
    cardShadow: readonly string[];
    borderStyle: readonly string[];
  };
}

const BASIC_BACKGROUND_STYLES = ['signature', 'minimal'] as const;
const ALL_BACKGROUND_STYLES = ['signature', 'banner', 'immersive', 'gradient', 'minimal'] as const;
const BASIC_BLOCK_TYPES = ['link', 'gallery', 'booking', 'shop'] as const;
const ALL_BLOCK_TYPES = ['link', 'gallery', 'booking', 'shop', 'video', 'music', 'contact', 'newsletter', 'header'] as const;

const CAPABILITIES: Record<PlanTier, PlanCapabilities> = {
  free: {
    maxLinks: 10,
    maxMedia: 10,
    maxUploadBytes: 5 * 1024 * 1024,
    premiumTemplates: false,
    analytics: false,
    removeBranding: false,
    customDomains: false,
    studioControls: false,
    allowedBackgroundStyles: BASIC_BACKGROUND_STYLES,
    allowedBlockTypes: BASIC_BLOCK_TYPES,
    allowedDesignOptions: { cardRadius: ['subtle', 'rounded'], cardShadow: ['none', 'subtle'], borderStyle: ['none', 'thin'] }
  },
  pro: {
    maxLinks: Number.POSITIVE_INFINITY,
    maxMedia: Number.POSITIVE_INFINITY,
    maxUploadBytes: 25 * 1024 * 1024,
    premiumTemplates: true,
    analytics: true,
    removeBranding: true,
    customDomains: true,
    studioControls: false,
    allowedBackgroundStyles: ALL_BACKGROUND_STYLES,
    allowedBlockTypes: BASIC_BLOCK_TYPES,
    allowedDesignOptions: { cardRadius: ['sharp', 'subtle', 'rounded', 'pill'], cardShadow: ['none', 'subtle', 'soft', 'hard'], borderStyle: ['none', 'thin', 'bold', 'dashed'] }
  },
  studio: {
    maxLinks: Number.POSITIVE_INFINITY,
    maxMedia: Number.POSITIVE_INFINITY,
    maxUploadBytes: 50 * 1024 * 1024,
    premiumTemplates: true,
    analytics: true,
    removeBranding: true,
    customDomains: true,
    studioControls: true,
    allowedBackgroundStyles: ALL_BACKGROUND_STYLES,
    allowedBlockTypes: [...ALL_BLOCK_TYPES],
    allowedDesignOptions: { cardRadius: ['sharp', 'subtle', 'rounded', 'pill'], cardShadow: ['none', 'subtle', 'soft', 'hard'], borderStyle: ['none', 'thin', 'bold', 'dashed'] }
  }
};

export const FREE_TEMPLATE_IDS = new Set(['elena', 'mateo', 'dr-ahmed', 'fitlife', 'wander', 'savor']);

export function isPremiumTemplate(templateId: string): boolean {
  return !FREE_TEMPLATE_IDS.has(templateId.trim().toLowerCase());
}

export function isStudioOnlyBlockType(type: string | undefined): boolean {
  return ['video', 'music', 'contact', 'newsletter', 'header'].includes(type || '');
}

export function getPlanTier(profile?: Pick<UserProfile, 'plan' | 'referralProUntil'> | null): PlanTier {
  if (!profile) return 'free';
  if (profile.plan === 'pro' && profile.referralProUntil && Date.parse(profile.referralProUntil) <= Date.now()) return 'free';
  return profile.plan === 'studio' ? 'studio' : profile.plan === 'pro' ? 'pro' : 'free';
}

export function getPlanCapabilities(profile?: Pick<UserProfile, 'plan' | 'referralProUntil'> | null): PlanCapabilities {
  return CAPABILITIES[getPlanTier(profile)];
}
