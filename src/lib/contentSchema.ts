import type {
  BackgroundStyle,
  BookingConfig,
  BookingServiceConfig,
  MediaGalleryItem,
  ProfileSocialLink,
  UserMiniSite
} from '../types';
import { isSupportedBlockType, isSupportedEmbedUrl, type SupportedBlockType } from './blockTypes';
import { normalizeSiteSlug, validateSiteSlug } from './siteSlug';
import { DEFAULT_DESIGN_TOKENS, DesignTokens, normalizeDesignTokens } from '../utils/designTokens';

export interface CanonicalContentBlock {
  id: string;
  title: string;
  titleAr?: string;
  subtitle?: string;
  subtitleAr?: string;
  url: string;
  type: SupportedBlockType;
  thumbnail?: string;
  galleryItems?: MediaGalleryItem[];
}

export interface CanonicalSiteContent {
  id?: string;
  userId?: string;
  revision?: number;
  username: string;
  displayName: string;
  role: string;
  bio: string;
  bioAr: string;
  avatar: string;
  coverImage: string;
  templateId: string;
  bgStyle: BackgroundStyle;
  themeMode: 'auto' | 'dark' | 'light';
  designTokens: DesignTokens;
  links: CanonicalContentBlock[];
  socials: ProfileSocialLink[];
  isPublished: boolean;
  customDomain: string;
  metaTitle: string;
  metaDescription: string;
  hidePoweredBy: boolean;
  sensitiveWarning: boolean;
  ga4Id: string;
  metaPixelId: string;
  webhookUrl: string;
  bookingConfig: BookingConfig;
}

export interface CanonicalProductInput {
  name: string;
  description: string;
  imageUrls: string[];
  priceMinor: number;
  currency: string;
  active: boolean;
  inventory: number | null;
}

export interface SchemaIssue {
  path: string;
  code: string;
  message: string;
}

export interface SchemaResult<T> {
  value: T;
  issues: SchemaIssue[];
  valid: boolean;
}

const DEFAULT_BOOKING_CONFIG: BookingConfig = {
  enabled: false,
  timezone: 'UTC',
  services: [],
  weeklyAvailability: {
    '0': { enabled: false, start: '09:00', end: '17:00' },
    '1': { enabled: true, start: '09:00', end: '17:00' },
    '2': { enabled: true, start: '09:00', end: '17:00' },
    '3': { enabled: true, start: '09:00', end: '17:00' },
    '4': { enabled: true, start: '09:00', end: '17:00' },
    '5': { enabled: true, start: '09:00', end: '17:00' },
    '6': { enabled: false, start: '09:00', end: '17:00' }
  },
  blackoutDates: [],
  minNoticeMinutes: 120,
  bookingWindowDays: 60,
  bufferMinutes: 15,
  maxBookingsPerDay: 20,
  calendarProvider: 'none'
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object';
const text = (value: unknown, max: number, fallback = '') => typeof value === 'string' ? value.trim().slice(0, max) : fallback;
const validTime = (value: unknown): value is string => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const validDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

export function isSafeContentUrl(value: unknown, allowAnchor = false): value is string {
  if (typeof value !== 'string' || value.length > 4000) return false;
  const trimmed = value.trim();
  if (allowAnchor && /^#[a-zA-Z0-9_-]{1,80}$/.test(trimmed)) return true;
  if (/^(javascript|data|vbscript):/i.test(trimmed) || trimmed.startsWith('//')) return false;
  try {
    const parsed = new URL(trimmed);
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(parsed.protocol);
  } catch (_) {
    return false;
  }
}

function normalizeGalleryItems(input: unknown): MediaGalleryItem[] {
  if (!Array.isArray(input)) return [];
  return input.map((item) => {
    const value = isRecord(item) ? item : {};
    return {
      id: text(value.id, 128),
      src: text(value.src, 4000),
      ...(value.thumbnail !== undefined ? { thumbnail: text(value.thumbnail, 4000) } : {}),
      ...(value.alt !== undefined ? { alt: text(value.alt, 300) } : {}),
      ...(value.caption !== undefined ? { caption: text(value.caption, 500) } : {}),
      ...(value.type === 'video' ? { type: 'video' as const } : { type: 'image' as const })
    };
  });
}

export function normalizeBookingConfig(input: unknown): BookingConfig {
  const source = isRecord(input) ? input : {};
  const services: BookingServiceConfig[] = Array.isArray(source.services) ? source.services.flatMap((service) => {
    if (!isRecord(service)) return [];
    const id = text(service.id, 64).toLowerCase();
    const name = text(service.name, 120);
    const durationMinutes = Number(service.durationMinutes);
    if (!/^[a-z0-9_-]{1,64}$/.test(id) || !name || !Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) return [];
    const bufferValue = Number(service.bufferMinutes);
    return [{ id, name, description: text(service.description, 500) || undefined, durationMinutes, bufferMinutes: Number.isInteger(bufferValue) ? Math.min(120, Math.max(0, bufferValue)) : 0 }];
  }) : [];
  const weeklyAvailability = { ...DEFAULT_BOOKING_CONFIG.weeklyAvailability };
  const weeklyInput = isRecord(source.weeklyAvailability) ? source.weeklyAvailability : {};
  if (isRecord(source.weeklyAvailability)) {
    Object.keys(weeklyAvailability).forEach((day) => {
      const value = isRecord(weeklyInput[day]) ? weeklyInput[day] as Record<string, unknown> : {};
      const start = validTime(value.start) ? value.start : weeklyAvailability[day].start;
      const end = validTime(value.end) ? value.end : weeklyAvailability[day].end;
      weeklyAvailability[day] = { enabled: value.enabled === true && start < end, start, end };
    });
  }
  let timezone = text(source.timezone, 100, DEFAULT_BOOKING_CONFIG.timezone);
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(); } catch (_) { timezone = DEFAULT_BOOKING_CONFIG.timezone; }
  const integer = (value: unknown, fallback: number, min: number, max: number) => Number.isInteger(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
  return {
    ...DEFAULT_BOOKING_CONFIG,
    enabled: source.enabled === true,
    timezone,
    services,
    weeklyAvailability,
    blackoutDates: Array.isArray(source.blackoutDates) ? source.blackoutDates.filter(validDate) : [],
    minNoticeMinutes: integer(source.minNoticeMinutes, DEFAULT_BOOKING_CONFIG.minNoticeMinutes, 0, 10080),
    bookingWindowDays: integer(source.bookingWindowDays, DEFAULT_BOOKING_CONFIG.bookingWindowDays, 1, 365),
    bufferMinutes: integer(source.bufferMinutes, DEFAULT_BOOKING_CONFIG.bufferMinutes, 0, 120),
    maxBookingsPerDay: integer(source.maxBookingsPerDay, DEFAULT_BOOKING_CONFIG.maxBookingsPerDay, 1, 100),
    calendarProvider: source.calendarProvider === 'google' || source.calendarProvider === 'outlook' ? source.calendarProvider : 'none'
  };
}

export function normalizeContentBlock(input: unknown): CanonicalContentBlock {
  const value = isRecord(input) ? input : {};
  const rawType = text(value.type, 30) || 'link';
  return {
    id: text(value.id, 128),
    title: text(value.title, 200),
    ...(value.titleAr !== undefined ? { titleAr: text(value.titleAr, 200) } : {}),
    ...(value.subtitle !== undefined ? { subtitle: text(value.subtitle, 500) } : {}),
    ...(value.subtitleAr !== undefined ? { subtitleAr: text(value.subtitleAr, 500) } : {}),
    url: text(value.url, 4000),
    // Keep invalid types visible until validation rejects them. Coercing an
    // unknown block to a link would make unsupported content executable.
    type: (isSupportedBlockType(rawType) ? rawType : rawType) as SupportedBlockType,
    ...(value.thumbnail !== undefined ? { thumbnail: text(value.thumbnail, 4000) } : {}),
    ...(value.galleryItems !== undefined ? { galleryItems: normalizeGalleryItems(value.galleryItems) } : {})
  };
}

export function normalizeProductInput(input: unknown): CanonicalProductInput {
  const value = isRecord(input) ? input : {};
  const inventory = value.inventory === null || value.inventory === undefined ? null : Number(value.inventory);
  return {
    name: text(value.name, 120),
    description: text(value.description, 2000),
    imageUrls: Array.isArray(value.imageUrls) ? value.imageUrls.filter((image): image is string => isSafeContentUrl(image) && /^https?:/i.test(image)) : [],
    priceMinor: Number(value.priceMinor),
    currency: text(value.currency, 3).toLowerCase(),
    active: value.active !== false,
    inventory: inventory === null || Number.isSafeInteger(inventory) ? inventory : null
  };
}

export function normalizeSiteContent(input: unknown): CanonicalSiteContent {
  const value = isRecord(input) ? input : {};
  const designTokens = normalizeDesignTokens(value.designTokens, value);
  const background = designTokens.background;
  return {
    ...(typeof value.id === 'string' ? { id: value.id } : {}),
    ...(typeof value.userId === 'string' ? { userId: value.userId } : {}),
    ...(typeof value.revision === 'number' ? { revision: value.revision } : {}),
    username: normalizeSiteSlug(value.username),
    displayName: text(value.displayName, 120),
    role: text(value.role, 160),
    bio: text(value.bio, 2000),
    bioAr: text(value.bioAr, 2000, text(value.bio, 2000)),
    avatar: text(value.avatar, 4000),
    coverImage: text(value.coverImage || background.coverImage, 4000),
    templateId: text(value.templateId, 120),
    bgStyle: background.style,
    themeMode: designTokens.themeMode,
    designTokens,
    links: Array.isArray(value.links) ? value.links.map(normalizeContentBlock) : [],
    socials: Array.isArray(value.socials) ? value.socials.flatMap((social) => {
      if (!isRecord(social)) return [];
      return [{ platform: text(social.platform, 40), url: text(social.url, 2000), ...(social.enabled !== undefined ? { enabled: social.enabled === true } : {}) }];
    }) : [],
    isPublished: value.isPublished === true,
    customDomain: text(value.customDomain, 253).toLowerCase(),
    metaTitle: text(value.metaTitle, 160),
    metaDescription: text(value.metaDescription, 320),
    hidePoweredBy: value.hidePoweredBy === true,
    sensitiveWarning: value.sensitiveWarning === true,
    ga4Id: text(value.ga4Id, 100),
    metaPixelId: text(value.metaPixelId, 100),
    webhookUrl: text(value.webhookUrl, 2000),
    bookingConfig: normalizeBookingConfig(value.bookingConfig)
  };
}

export function validateSiteContent(input: unknown): SchemaResult<CanonicalSiteContent> {
  const value = normalizeSiteContent(input);
  const raw = isRecord(input) ? input : {};
  const issues: SchemaIssue[] = [];
  const add = (path: string, code: string, message: string) => issues.push({ path, code, message });
  if (!validateSiteSlug(value.username).valid) add('username', 'invalid_handle', 'A valid site handle is required.');
  if (value.isPublished && !value.displayName) add('displayName', 'required', 'Display name is required before publishing.');
  if (value.isPublished && !value.bio) add('bio', 'required', 'Bio is required before publishing.');
  if (!value.templateId) add('templateId', 'required', 'Template ID is required.');
  if (value.links.length > 500) add('links', 'too_many', 'A site cannot contain more than 500 blocks.');
  if (value.socials.length > 50) add('socials', 'too_many', 'A site cannot contain more than 50 social links.');
  if (value.bookingConfig.services.length > 50) add('bookingConfig.services', 'too_many', 'A site cannot contain more than 50 booking services.');
  if (value.bookingConfig.blackoutDates.length > 366) add('bookingConfig.blackoutDates', 'too_many', 'A site cannot contain more than 366 blackout dates.');
  if (isRecord(raw.bookingConfig)) {
    const rawServices = Array.isArray(raw.bookingConfig.services) ? raw.bookingConfig.services : [];
    const rawBlackouts = Array.isArray(raw.bookingConfig.blackoutDates) ? raw.bookingConfig.blackoutDates : [];
    if (rawServices.length !== value.bookingConfig.services.length) add('bookingConfig.services', 'invalid_service', 'Every booking service must have a valid ID, name, duration, and buffer.');
    if (rawBlackouts.length !== value.bookingConfig.blackoutDates.length) add('bookingConfig.blackoutDates', 'invalid_date', 'Blackout dates must use YYYY-MM-DD format.');
  }
  const ids = new Set<string>();
  value.links.forEach((block, index) => {
    const path = `links[${index}]`;
    if (!isSupportedBlockType(block.type)) add(`${path}.type`, 'unsupported_block', 'Block type is not supported.');
    if (!block.id || ids.has(block.id)) add(`${path}.id`, 'unique', 'Block IDs must be unique and non-empty.');
    ids.add(block.id);
    if (!block.title) add(`${path}.title`, 'required', 'Block title is required.');
    const needsUrl = block.type === 'link' || block.type === 'video' || block.type === 'music';
    if ((needsUrl || block.url) && !isSafeContentUrl(block.url, true)) add(`${path}.url`, 'unsafe_url', 'Block URL is not safe.');
    if ((block.type === 'video' || block.type === 'music') && !isSupportedEmbedUrl(block.type, block.url)) add(`${path}.url`, 'unsupported_embed', 'Embed URL is not supported.');
    if (block.type === 'gallery') {
      if (!block.galleryItems?.length || block.galleryItems.length > 50) add(`${path}.galleryItems`, 'invalid_gallery', 'Gallery must contain between 1 and 50 items.');
      const galleryIds = new Set<string>();
      block.galleryItems?.forEach((item, itemIndex) => {
        if (!item.id || galleryIds.has(item.id) || !isSafeContentUrl(item.src)) add(`${path}.galleryItems[${itemIndex}]`, 'invalid_media', 'Gallery media must have unique IDs and safe URLs.');
        galleryIds.add(item.id);
        if (item.thumbnail && !isSafeContentUrl(item.thumbnail)) add(`${path}.galleryItems[${itemIndex}].thumbnail`, 'unsafe_url', 'Thumbnail URL is not safe.');
      });
    }
  });
  value.socials.forEach((social, index) => { if (!social.platform || !isSafeContentUrl(social.url)) add(`socials[${index}].url`, 'unsafe_url', 'Social URL is not safe.'); });
  if (value.avatar && !isSafeContentUrl(value.avatar)) add('avatar', 'unsafe_url', 'Avatar URL is not safe.');
  if (value.coverImage && !isSafeContentUrl(value.coverImage)) add('coverImage', 'unsafe_url', 'Cover image URL is not safe.');
  if (value.webhookUrl && !isSafeContentUrl(value.webhookUrl)) add('webhookUrl', 'unsafe_url', 'Webhook URL is not safe.');
  if (value.bookingConfig.services.some((service, index) => value.bookingConfig.services.findIndex((other) => other.id === service.id) !== index)) add('bookingConfig.services', 'unique', 'Booking service IDs must be unique.');
  if (value.isPublished && issues.length > 0) add('isPublished', 'publish_invalid', 'Invalid content cannot be published.');
  return { value, issues, valid: issues.length === 0 };
}

export function validateProductInput(input: unknown): SchemaResult<CanonicalProductInput> {
  const value = normalizeProductInput(input);
  const issues: SchemaIssue[] = [];
  const raw = isRecord(input) ? input : {};
  const rawImages = Array.isArray(raw.imageUrls) ? raw.imageUrls : [];
  if (!value.name) issues.push({ path: 'name', code: 'required', message: 'Product name is required.' });
  if (!Number.isSafeInteger(value.priceMinor) || value.priceMinor < 50 || value.priceMinor > 10_000_000) issues.push({ path: 'priceMinor', code: 'invalid_price', message: 'Product price is invalid.' });
  if (!/^[a-z]{3}$/.test(value.currency)) issues.push({ path: 'currency', code: 'invalid_currency', message: 'Product currency is invalid.' });
  if (rawImages.length > 8 || value.imageUrls.length !== rawImages.length) issues.push({ path: 'imageUrls', code: 'invalid_images', message: 'Products may contain up to 8 safe HTTP(S) images.' });
  if (value.inventory !== null && (!Number.isSafeInteger(value.inventory) || value.inventory < 0)) issues.push({ path: 'inventory', code: 'invalid_inventory', message: 'Product inventory is invalid.' });
  return { value, issues, valid: issues.length === 0 };
}

export function canonicalSiteToLegacy(site: CanonicalSiteContent): Record<string, unknown> {
  return {
    ...site,
    accentColor: site.designTokens.accentColor,
    surfaceColor: site.designTokens.surfaceColor,
    cardRadius: site.designTokens.cardRadius,
    cardShadow: site.designTokens.cardShadow,
    borderStyle: site.designTokens.borderStyle,
    bgStyle: site.designTokens.background.style,
    themeMode: site.designTokens.themeMode
  };
}

export function canonicalProductToRecord(product: CanonicalProductInput): Record<string, unknown> {
  return { ...product };
}

export function canonicalSiteFromUserSite(site: UserMiniSite): CanonicalSiteContent {
  return normalizeSiteContent(site);
}

export { DEFAULT_DESIGN_TOKENS };
