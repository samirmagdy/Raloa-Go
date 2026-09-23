import { useEffect, useState, useMemo } from 'react';
import { Locale } from '../types';

export interface MetaTagItem {
  name?: string;
  property?: string;
  content: string;
}

export interface SectionSEOMetadata {
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  keywords?: string[];
  canonicalUrl?: string;
  metaTags?: MetaTagItem[];
  jsonLd?: Record<string, any>;
}

export interface UseSEOOptions {
  locale?: Locale;
  activeSection?: string;
  customTitle?: string;
  customDescription?: string;
}

export interface UseSEOReturn {
  currentSection: string;
  title: string;
  description: string;
  ogDescription: string;
  canonicalUrl: string;
  metaTags: MetaTagItem[];
}

// Default fallback registry for all core sections in both English and Arabic
export const SECTION_SEO_REGISTRY: Record<string, Record<Locale, SectionSEOMetadata>> = {
  hero: {
    en: {
      title: 'RALOA — Beautiful Mini-Sites for Creators, Freelancers & Businesses',
      description: 'Create a polished mini-site for your links, content, bookings and products. Launch in minutes with RALOA — no coding required.',
      ogTitle: 'RALOA — Beautiful Mini-Sites for Creators & Brands',
      ogDescription: 'Launch your high-converting mini-site in under 3 minutes. Total design freedom, multi-page layout, and zero code required.',
      twitterCard: 'summary_large_image'
    },
    ar: {
      title: 'رالوا — مواقع مصغرة استثنائية لصناع المحتوى والمهنيين والأنشطة التجارية',
      description: 'أنشئ موقعك المصغر الاحترافي لروابطك، منتجاتك، محتواك وحجوزاتك في دقائق معدودة مع رالوا — بدون الحاجة لأي خبرة برمجية.',
      ogTitle: 'رالوا — المنصة المتكاملة للمواقع المصغرة وبايو الحسابات',
      ogDescription: 'أطلق موقعك المصغر الاحترافي في دقائق معدودة. حرية كاملة بالتصميم ودعم صفحات متعددة بدون أي خبرة برمجية.',
      twitterCard: 'summary_large_image'
    }
  },
  benefits: {
    en: {
      title: 'Creator Benefits & Platform Trust — RALOA',
      description: 'Zero setup friction, 99.9% uptime global edge CDN, lightning-fast mobile loading, and total design freedom for your brand.',
      ogTitle: 'Why Top Creators Choose RALOA — Performance & Trust',
      ogDescription: 'Zero setup friction, global edge CDN speeds, and full design freedom. Elevate your online presence with RALOA.',
      twitterCard: 'summary_large_image'
    },
    ar: {
      title: 'مزايا المبدعين وثقة المنصة — رالوا',
      description: 'إطلاق فوري وسلس، شبكة توزيع محتوى فائقة السرعة، أداء مثالي على الهواتف وحرية كاملة لتخصيص علامتك التجارية.',
      ogTitle: 'لماذا يفضل المبدعون منصة رالوا؟ سرعة وأمان وحرية تصميم',
      ogDescription: 'سرعة فائقة على شبكات التوزيع العالمية، حماية متقدمة، وأداء لا يضاهى على الهواتف الذكية.',
      twitterCard: 'summary_large_image'
    }
  },
  templates: {
    en: {
      title: 'Templates & Curated Themes — RALOA Mini-Sites',
      description: 'Explore curated, conversion-crafted aesthetic templates for digital creators, photographers, educators, coaches and modern businesses.',
      ogTitle: 'Explore Beautiful Mini-Site Templates — RALOA Gallery',
      ogDescription: 'Browse dozens of hand-crafted starter designs for musicians, creators, coaches, and agencies. Live interactive previews available.',
      twitterCard: 'summary_large_image'
    },
    ar: {
      title: 'قوالب وتصاميم مميزة — رالوا',
      description: 'استعرض قوالب تفاعلية أنيقة مصممة لزيادة التفاعل والمبيعات لصناع المحتوى، المصورين، المدربين ورواد الأعمال.',
      ogTitle: 'معرض قوالب وتصاميم رالوا الجاهزة للإطلاق',
      ogDescription: 'قوالب جاهزة ومصممة بأعلى معايير الجمالية والأداء لتحويل الزوار إلى عملاء ومتابعين حقيقيين.',
      twitterCard: 'summary_large_image'
    }
  },
  'how-it-works': {
    en: {
      title: 'How It Works — Launch in 3 Simple Steps | RALOA',
      description: 'Pick a template, customize your bio and interactive links, and publish your custom raloa.app link to your bio in under 3 minutes.',
      ogTitle: 'Build & Publish Your Mini-Site in 3 Steps — RALOA',
      ogDescription: 'From selecting a starter template to publishing your custom link — see how easy it is to stand out online.',
      twitterCard: 'summary_large_image'
    },
    ar: {
      title: 'كيف تعمل المنصة — أطلق موقعك في ٣ خطوات | رالوا',
      description: 'اختر قالبك المفضل، خصص ملفك وروابطك التفاعلية، وانشر رابطك المباشر في بايو حساباتك بكل سهولة.',
      ogTitle: 'كيف تنشئ موقعك المصغر مع رالوا في ٣ خطوات بسيطة',
      ogDescription: 'اختر القالب، خصص الروابط والمحتوى، وانشر رابطك الاحترافي فوراً في جميع منصاتك.',
      twitterCard: 'summary_large_image'
    }
  },
  features: {
    en: {
      title: 'Creator Tools & Integrated Features — RALOA',
      description: 'Custom domains, instant digital storefronts, calendar bookings, portfolio galleries, real-time analytics, and SEO optimization in one place.',
      ogTitle: 'All-in-One Creator Toolkit — Modern Mini-Sites by RALOA',
      ogDescription: 'Everything you need: custom domains, zero commission digital sales, booking schedules, and real-time UTM analytics.',
      twitterCard: 'summary_large_image'
    },
    ar: {
      title: 'مميزات وأدوات صناع المحتوى — رالوا',
      description: 'نطاقات مخصصة، متجر رقمي متكامل، نظام حجز مواعيد، معارض وسائط متقدمة، وتحليلات فورية في منصة موحدة.',
      ogTitle: 'أدوات ومميزات استثنائية لصناع المحتوى على رالوا',
      ogDescription: 'نطاقات خاصة، مبيعات بدون عمولة، حجوزات مباشرة وتحليلات تفصيلية للزيارات والتحويلات.',
      twitterCard: 'summary_large_image'
    }
  },
  testimonials: {
    en: {
      title: 'Creator Stories & Reviews — RALOA',
      description: 'See how thousands of creators, artists, educators and founders elevated their link-in-bio into high-converting personal hubs.',
      ogTitle: 'Creator Stories & Real Reviews — Trusted by Thousands on RALOA',
      ogDescription: 'Read how modern creators doubled their engagement and monetized their audience with RALOA mini-sites.',
      twitterCard: 'summary_large_image'
    },
    ar: {
      title: 'قصص وتقييمات المبدعين — رالوا',
      description: 'تعرف على تجارب آلاف المبدعين والفنانين والمدربين الذين طوروا حضورهم الرقمي عبر منصة رالوا.',
      ogTitle: 'تجارب وقصص نجاح صناع المحتوى مع منصة رالوا',
      ogDescription: 'اكتشف كيف ساعدت رالوا آلاف المبدعين على مضاعفة التفاعل وتحقيق عوائد مجزية من محتواهم.',
      twitterCard: 'summary_large_image'
    }
  },
  pricing: {
    en: {
      title: 'Transparent Pricing Plans — Free, Pro & Business | RALOA',
      description: 'Start free forever or unlock custom domains, zero transaction fees, deep analytics and VIP priority support with RALOA Pro.',
      ogTitle: 'Transparent Pricing with No Hidden Fees — Free & Pro Plans | RALOA',
      ogDescription: 'Start free forever. Upgrade to Pro whenever you want custom domains, zero commission sales, and advanced integrations.',
      twitterCard: 'summary_large_image'
    },
    ar: {
      title: 'خطط الأسعار الشفافة — مجانية، احترافية وأعمال | رالوا',
      description: 'ابدأ مجاناً مدى الحياة أو اختر باقة المحترفين للنطاقات المخصصة، بدون عمولات مبيعات، وتحليلات متقدمة ودعم أولوية.',
      ogTitle: 'خطط اشتراك شفافة بدون رسوم خفية — رالوا',
      ogDescription: 'ابدأ مجاناً مدى الحياة، أو قم بالترقية للحصول على نطاق خاص وعمولة صفرية على مبيعاتك.',
      twitterCard: 'summary_large_image'
    }
  },
  faq: {
    en: {
      title: 'Frequently Asked Questions & Support — RALOA',
      description: 'Find answers about custom domains, zero commission digital sales, calendar integrations, and switching from other link services.',
      ogTitle: 'RALOA Help & FAQ — Everything You Need to Know',
      ogDescription: 'Got questions about custom domains, zero fees, or migrating from other platforms? We have all the answers here.',
      twitterCard: 'summary_large_image'
    },
    ar: {
      title: 'الأسئلة الشائعة والدعم الفني — رالوا',
      description: 'إجابات شاملة حول النطاقات المخصصة، البيع الرقمي بدون عمولة، ربط التقويم، والتحويل السلس من المنصات الأخرى.',
      ogTitle: 'الأسئلة الأكثر شيوعاً والدعم الفني لمنصة رالوا',
      ogDescription: 'إجابات واضحة ومفصلة حول النطاقات الخاصة، بوابات الدفع، وإعداد حسابك خطوة بخطوة.',
      twitterCard: 'summary_large_image'
    }
  }
};

const DEFAULT_TRACKED_SECTION_IDS = [
  'hero',
  'benefits',
  'templates',
  'how-it-works',
  'features',
  'testimonials',
  'pricing',
  'faq'
];

// Central reactive registry for dynamic section SEO registered by usePageSEO
type RegistrySubscriber = () => void;
const sectionRegistry = new Map<string, Partial<Record<Locale, Partial<SectionSEOMetadata>>>>();
const registrySubscribers = new Set<RegistrySubscriber>();

let notifyTimer: any = null;
function notifySubscribers() {
  if (notifyTimer) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    registrySubscribers.forEach((callback) => {
      try {
        callback();
      } catch (err) {
        console.error('Error executing SEO registry subscriber callback:', err);
      }
    });
  }, 10);
}

/**
 * Register dynamic SEO metadata for a specific section and locale.
 * Called by `usePageSEO` hook inside individual section components.
 */
export function registerSectionSEO(
  sectionId: string,
  locale: Locale,
  metadata: Partial<SectionSEOMetadata>
): () => void {
  const existing = sectionRegistry.get(sectionId) || {};
  const prevLocaleData = existing[locale];
  const newLocaleData = {
    ...(prevLocaleData || {}),
    ...metadata
  };

  // Compare previous and next to avoid redundant re-renders
  const isIdentical =
    prevLocaleData &&
    JSON.stringify(prevLocaleData) === JSON.stringify(newLocaleData);

  if (!isIdentical) {
    sectionRegistry.set(sectionId, {
      ...existing,
      [locale]: newLocaleData
    });
    notifySubscribers();
  }

  return () => {
    unregisterSectionSEO(sectionId, locale);
  };
}

/**
 * Unregister or clear dynamic SEO metadata for a section
 */
export function unregisterSectionSEO(sectionId: string, locale?: Locale): void {
  let changed = false;
  if (locale) {
    const existing = sectionRegistry.get(sectionId);
    if (existing && existing[locale]) {
      delete existing[locale];
      if (Object.keys(existing).length === 0) {
        sectionRegistry.delete(sectionId);
      }
      changed = true;
    }
  } else {
    if (sectionRegistry.has(sectionId)) {
      sectionRegistry.delete(sectionId);
      changed = true;
    }
  }

  if (changed) {
    notifySubscribers();
  }
}

/**
 * Retrieve registered dynamic SEO metadata for a section
 */
export function getRegisteredSectionSEO(sectionId: string, locale: Locale): Partial<SectionSEOMetadata> | undefined {
  return sectionRegistry.get(sectionId)?.[locale];
}

/**
 * Custom hook `useSEO` that dynamically updates document.title, canonical URL,
 * OpenGraph description/title, Twitter cards, custom meta tags, and JSON-LD structured data
 * based on the active viewport section (or hash/manual section) and current locale.
 */
export function useSEO({
  locale = 'en',
  activeSection: manualSection,
  customTitle,
  customDescription
}: UseSEOOptions = {}): UseSEOReturn {
  const [detectedSection, setDetectedSection] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const cleanHash = window.location.hash.replace('#', '');
      if (cleanHash && (DEFAULT_TRACKED_SECTION_IDS.includes(cleanHash) || sectionRegistry.has(cleanHash))) {
        return cleanHash;
      }
    }
    return 'hero';
  });

  // Registry version counter to trigger reactivity when usePageSEO registers/updates metadata
  const [registryVersion, setRegistryVersion] = useState(0);

  useEffect(() => {
    const handleRegistryChange = () => {
      setRegistryVersion((v) => v + 1);
    };
    registrySubscribers.add(handleRegistryChange);
    return () => {
      registrySubscribers.delete(handleRegistryChange);
    };
  }, []);

  // Listen to hashchange events for immediate direct section jumps
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && (DEFAULT_TRACKED_SECTION_IDS.includes(hash) || sectionRegistry.has(hash))) {
        setDetectedSection(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Active section takes manual override if provided, else auto-detected section
  const currentSection = manualSection || detectedSection;

  // Observe sections in viewport when no manual section is forced
  useEffect(() => {
    if (manualSection) return;
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    // Combine default tracked section IDs with any dynamically registered sections
    const allTrackedIds = Array.from(new Set([...DEFAULT_TRACKED_SECTION_IDS, ...Array.from(sectionRegistry.keys())]));

    const observerCallback: IntersectionObserverCallback = (entries) => {
      const visibleEntries = entries.filter((entry) => entry.isIntersecting);
      if (visibleEntries.length > 0) {
        visibleEntries.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const topSectionId = visibleEntries[0].target.id;
        if (topSectionId && allTrackedIds.includes(topSectionId)) {
          setDetectedSection(topSectionId);
        }
      }
    };

    const observer = new IntersectionObserver(observerCallback, {
      root: null,
      rootMargin: '-20% 0px -35% 0px',
      threshold: [0.1, 0.25, 0.5]
    });

    allTrackedIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [manualSection, registryVersion]);

  // Derive consolidated metadata from static registry and dynamic usePageSEO overrides
  const resolvedMetadata = useMemo(() => {
    const staticData = SECTION_SEO_REGISTRY[currentSection]?.[locale] || SECTION_SEO_REGISTRY.hero[locale];
    const dynamicData = sectionRegistry.get(currentSection)?.[locale] || {};

    const finalTitle = customTitle || dynamicData.title || staticData.title;
    const finalDescription = customDescription || dynamicData.description || staticData.description;
    const finalOgTitle = dynamicData.ogTitle || finalTitle;
    const finalOgDescription = dynamicData.ogDescription || dynamicData.description || staticData.ogDescription || finalDescription;
    const finalOgImage = dynamicData.ogImage || 'https://raloa.app/images/og-default.png';
    const finalOgType = dynamicData.ogType || 'website';
    const finalTwitterTitle = dynamicData.twitterTitle || finalOgTitle;
    const finalTwitterDescription = dynamicData.twitterDescription || finalOgDescription;
    const finalTwitterCard = dynamicData.twitterCard || staticData.twitterCard || 'summary_large_image';

    let baseUrl = 'https://raloa.app';
    if (typeof window !== 'undefined' && window.location) {
      baseUrl = `${window.location.origin}${window.location.pathname}`;
    }

    const finalCanonicalUrl = dynamicData.canonicalUrl || baseUrl;

    const finalMetaTags: MetaTagItem[] = [...(dynamicData.metaTags || [])];
    if (dynamicData.keywords && dynamicData.keywords.length > 0) {
      finalMetaTags.push({
        name: 'keywords',
        content: dynamicData.keywords.join(', ')
      });
    }

    return {
      title: finalTitle,
      description: finalDescription,
      ogTitle: finalOgTitle,
      ogDescription: finalOgDescription,
      ogImage: finalOgImage,
      ogType: finalOgType,
      twitterTitle: finalTwitterTitle,
      twitterDescription: finalTwitterDescription,
      twitterCard: finalTwitterCard,
      canonicalUrl: finalCanonicalUrl,
      metaTags: finalMetaTags,
      jsonLd: dynamicData.jsonLd
    };
  }, [currentSection, locale, customTitle, customDescription, registryVersion]);

  // Synchronize document.title, standard meta tags, OpenGraph, Twitter, and custom tags dynamically
  useEffect(() => {
    if (typeof document === 'undefined') return;

    // 1. Update Title
    document.title = resolvedMetadata.title;

    // Helper to safely upsert meta tag
    const setMetaTag = (attr: 'name' | 'property', value: string, content: string, dynamicKey?: string) => {
      let el = document.querySelector(`meta[${attr}="${value}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, value);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
      if (dynamicKey) {
        el.setAttribute('data-raloa-seo-managed', dynamicKey);
      }
    };

    // 2. Primary Meta Description
    setMetaTag('name', 'description', resolvedMetadata.description);

    // 3. OpenGraph Tags (including section-specific OpenGraph description)
    setMetaTag('property', 'og:title', resolvedMetadata.ogTitle);
    setMetaTag('property', 'og:description', resolvedMetadata.ogDescription);
    setMetaTag('property', 'og:url', resolvedMetadata.canonicalUrl);
    setMetaTag('property', 'og:type', resolvedMetadata.ogType);
    setMetaTag('property', 'og:image', resolvedMetadata.ogImage);
    setMetaTag('property', 'og:site_name', 'RALOA');
    setMetaTag('property', 'og:locale', locale === 'ar' ? 'ar_AR' : 'en_US');

    // 4. Twitter Card Tags
    setMetaTag('name', 'twitter:card', resolvedMetadata.twitterCard);
    setMetaTag('name', 'twitter:title', resolvedMetadata.twitterTitle);
    setMetaTag('name', 'twitter:description', resolvedMetadata.twitterDescription);
    setMetaTag('name', 'twitter:image', resolvedMetadata.ogImage);

    // 5. Canonical Link tag
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', resolvedMetadata.canonicalUrl);

    // 6. Section-specific dynamic custom meta tags
    // First, clean up previous dynamic custom meta tags
    document.querySelectorAll('meta[data-raloa-custom-tag="true"]').forEach((node) => node.remove());

    resolvedMetadata.metaTags.forEach((tag, idx) => {
      if (tag.name) {
        let el = document.querySelector(`meta[name="${tag.name}"]`);
        if (!el) {
          el = document.createElement('meta');
          el.setAttribute('name', tag.name);
          el.setAttribute('data-raloa-custom-tag', 'true');
          document.head.appendChild(el);
        }
        el.setAttribute('content', tag.content);
      } else if (tag.property) {
        let el = document.querySelector(`meta[property="${tag.property}"]`);
        if (!el) {
          el = document.createElement('meta');
          el.setAttribute('property', tag.property);
          el.setAttribute('data-raloa-custom-tag', 'true');
          document.head.appendChild(el);
        }
        el.setAttribute('content', tag.content);
      }
    });

    // 7. Inject or update Schema.org JSON-LD structured data for the section
    const jsonLdScriptId = 'raloa-section-jsonld';
    let jsonLdEl = document.getElementById(jsonLdScriptId) as HTMLScriptElement | null;

    if (resolvedMetadata.jsonLd) {
      if (!jsonLdEl) {
        jsonLdEl = document.createElement('script');
        jsonLdEl.id = jsonLdScriptId;
        jsonLdEl.type = 'application/ld+json';
        document.head.appendChild(jsonLdEl);
      }
      jsonLdEl.textContent = JSON.stringify(resolvedMetadata.jsonLd);
    } else if (jsonLdEl) {
      jsonLdEl.remove();
    }
  }, [resolvedMetadata, locale]);

  return {
    currentSection,
    title: resolvedMetadata.title,
    description: resolvedMetadata.description,
    ogDescription: resolvedMetadata.ogDescription,
    canonicalUrl: resolvedMetadata.canonicalUrl,
    metaTags: resolvedMetadata.metaTags
  };
}
