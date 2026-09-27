export type Locale = 'en' | 'ar';

export type BackgroundStyle = 'signature' | 'banner' | 'immersive' | 'gradient' | 'minimal';

export type GalleryMediaType = 'image' | 'video';

export type SocialPlatform = 'instagram' | 'x' | 'youtube' | 'linkedin' | 'email' | 'tiktok' | 'github' | 'spotify';

export interface ProfileSocialLink {
  platform: SocialPlatform | string;
  url: string;
  enabled?: boolean;
}

export interface SocialIntegrationStatus {
  provider: 'github';
  status: 'connected' | 'reauthorization_required' | 'error';
  accountId?: string;
  accountLabel?: string;
  profileUrl?: string;
  scopes: string[];
  connectedAt?: string;
  updatedAt?: string;
  lastError?: string;
}

export interface MediaGalleryItem {
  id: string;
  src: string;
  thumbnail?: string;
  alt?: string;
  caption?: string;
  type?: GalleryMediaType;
}

export interface BookingServiceConfig {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  bufferMinutes?: number;
}

export interface WeeklyAvailabilityWindow {
  enabled: boolean;
  start: string;
  end: string;
}

export interface BookingConfig {
  enabled: boolean;
  timezone: string;
  services: BookingServiceConfig[];
  weeklyAvailability: Record<string, WeeklyAvailabilityWindow>;
  blackoutDates: string[];
  minNoticeMinutes: number;
  bookingWindowDays: number;
  bufferMinutes: number;
  maxBookingsPerDay: number;
  calendarProvider?: 'none' | 'google' | 'outlook';
}

export interface CreatorProduct {
  id: string;
  creatorId: string;
  name: string;
  description: string;
  imageUrls: string[];
  priceMinor: number;
  currency: string;
  active: boolean;
  inventory: number | null;
  inventoryReserved: number;
  stripeProductId: string;
  stripePriceId: string;
  createdAt?: string;
  updatedAt?: string;
}

export type OrderStatus = 'pending_payment' | 'paid' | 'cancelled' | 'payment_failed' | 'refunded';
export type FulfillmentStatus = 'unfulfilled' | 'processing' | 'fulfilled' | 'cancelled';

export interface CreatorOrder {
  id: string;
  creatorId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPriceMinor: number;
  currency: string;
  totalMinor: number;
  customerEmail: string;
  status: OrderStatus;
  fulfillmentStatus: FulfillmentStatus;
  stripeCheckoutSessionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateBackgroundProperties {
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
  boxShadow?: string;
  borderColor?: string;
  color?: string;
  backdropFilter?: string;
}

export interface TemplateThemeConfig {
  mode: 'dark' | 'light';
  bgClasses: string;
  bgCustomStyle?: string;
  bgSolid?: string;
  ambientGlow?: string;
  bannerOverlay: string;
  statusBarColor: 'dark' | 'light';
  cardBg: string;
  cardBorder: string;
  cardHoverBorder: string;
  cardText: string;
  cardSubtext: string;
  cardIconBg: string;
  cardIconColor: string;
  textColor: string;
  roleColor: string;
  bioColor: string;
  socialBg: string;
  socialBorder: string;
  socialText: string;
  socialHoverBg: string;
  footerText: string;
  homeBarColor: string;
}

export interface TemplateItem {
  id: string;
  name: string;
  role: string;
  category: 'Portfolio' | 'Creative' | 'Business' | 'Professional' | 'Fitness' | 'Travel' | 'Food' | 'Personal';
  avatar: string;
  coverImage: string;
  bio: string;
  bioAr: string;
  themeColor: string;
  accentGradient: string;
  backgroundStyle?: BackgroundStyle;
  backgroundProperties?: TemplateBackgroundProperties;
  themeConfig?: Partial<TemplateThemeConfig>;
  metaTitle?: string;
  metaDescription?: string;
  sampleLinks: {
    id: string;
    title: string;
    titleAr: string;
    subtitle?: string;
    subtitleAr?: string;
    url: string;
    thumbnail?: string;
    galleryItems?: MediaGalleryItem[];
    type?: 'link' | 'gallery' | 'booking' | 'shop';
  }[];
  socials: {
    platform: 'instagram' | 'x' | 'youtube' | 'linkedin' | 'email' | 'tiktok' | 'github' | 'spotify';
    url: string;
  }[];
}

export interface PricingPlan {
  id: string;
  name: string;
  nameAr: string;
  priceMonthly: number;
  priceYearly: number; // total price for one year
  period: string;
  periodAr: string;
  description: string;
  descriptionAr: string;
  popular?: boolean;
  features: string[];
  featuresAr: string[];
  ctaText: string;
  ctaTextAr: string;
  ctaVariant: 'primary' | 'secondary' | 'dark';
}

export interface TestimonialItem {
  id: string;
  quote: string;
  quoteAr: string;
  author: string;
  authorAr: string;
  role: string;
  roleAr: string;
  avatar: string;
  rating: number;
}

export interface FAQItem {
  id: string;
  question: string;
  questionAr: string;
  answer: string;
  answerAr: string;
}

export interface MiniSiteUserConfig {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  templateId: string;
  themeColor: string;
  links: {
    id: string;
    title: string;
    url: string;
    subtitle?: string;
    galleryItems?: MediaGalleryItem[];
    type?: 'link' | 'gallery' | 'booking' | 'shop';
  }[];
  socials: ProfileSocialLink[];
  verified: boolean;
  published: boolean;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  plan: 'free' | 'pro' | 'studio';
  isYearly?: boolean;
  billingStatus?: 'free' | 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | string;
  handle?: string;
  referralsCount?: number;
  referredBy?: string;
  referralStatus?: 'pending' | 'qualified';
  referralRewards?: {
    verifiedBadgeUnlocked?: boolean;
    freeProMonthsEarned?: number;
    customDomainUnlocked?: boolean;
  };
  referralProUntil?: string;
  verifiedCreator?: boolean;
  customDomainPerkUnlocked?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserMiniSite {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  role?: string;
  bio: string;
  templateId: string;
  avatar: string;
  coverImage?: string;
  bgStyle?: BackgroundStyle;
  themeMode?: 'auto' | 'dark' | 'light';
  links: any[];
  isPublished: boolean;
  bookingConfig?: BookingConfig;
  updatedAt?: string;
}

export interface ContactInquiry {
  id?: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
  createdAt?: string;
}

export interface CustomDomainDnsRecord {
  type: 'CNAME' | 'A' | 'TXT';
  name: string;
  value: string;
  is_verified: boolean;
}

export interface CustomDomainMapping {
  domain_id: string;              // UUIDv4
  site_id: string;                // References target site
  user_id: string;                // References account owner
  hostname: string;               // e.g., "portfolio.johndoe.com"
  ssl_status: 'pending' | 'active' | 'expired' | 'failed';
  verification_token: string;     // DNS TXT challenge token
  dns_records: CustomDomainDnsRecord[];
  is_active: boolean;
  created_at: string;             // ISO-8601 UTC
  updated_at: string;             // ISO-8601 UTC
}

export interface AttributionUtmPayload {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  initial_landing_path: string;
  referrer_host: string | null;
  timestamp: number;
}
