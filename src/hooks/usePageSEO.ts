import { useEffect, useMemo, useRef } from 'react';
import { Locale } from '../types';
import {
  registerSectionSEO,
  SectionSEOMetadata,
  MetaTagItem,
} from './useSEO';

export interface UsePageSEOProps {
  /**
   * Unique DOM ID or identifier for the section (e.g., 'templates', 'pricing', 'features')
   */
  sectionId: string;
  /**
   * Optional language code (defaults to 'en' or active app locale)
   */
  locale?: Locale;
  /**
   * Custom browser title (<title> and fallback for og:title)
   */
  title?: string;
  /**
   * Primary search engine meta description (<meta name="description">)
   */
  description?: string;
  /**
   * Custom OpenGraph title (<meta property="og:title">)
   */
  ogTitle?: string;
  /**
   * Section-specific OpenGraph description (<meta property="og:description">)
   * passed to useSEO for social share cards
   */
  ogDescription?: string;
  /**
   * OpenGraph image preview URL for social share cards (<meta property="og:image">)
   */
  ogImage?: string;
  /**
   * OpenGraph type (<meta property="og:type">), defaults to 'website'
   */
  ogType?: string;
  /**
   * Twitter card title (<meta name="twitter:title">)
   */
  twitterTitle?: string;
  /**
   * Twitter card description (<meta name="twitter:description">)
   */
  twitterDescription?: string;
  /**
   * Twitter card layout format ('summary' or 'summary_large_image')
   */
  twitterCard?: 'summary' | 'summary_large_image';
  /**
   * Array of search keywords for this section (<meta name="keywords">)
   */
  keywords?: string[];
  /**
   * Explicit canonical URL override for this section
   */
  canonicalUrl?: string;
  /**
   * Arbitrary custom meta tags to inject when this section is active
   */
  metaTags?: MetaTagItem[];
  /**
   * Schema.org JSON-LD structured data object for rich snippets
   */
  jsonLd?: Record<string, any>;
  /**
   * Whether dynamic SEO registration is enabled (defaults to true)
   */
  enabled?: boolean;
}

export interface UsePageSEOReturn {
  sectionId: string;
  isRegistered: boolean;
  metadata: Partial<SectionSEOMetadata>;
}

/**
 * Hook `usePageSEO` that enables individual landing page sections
 * (such as TemplateGallery, PricingTable, FeatureGrid, etc.)
 * to register and pass their own unique meta tags and OpenGraph description
 * to the centralized `useSEO` hook for optimal section-level search indexing and social cards.
 */
export function usePageSEO({
  sectionId,
  locale = 'en',
  title,
  description,
  ogTitle,
  ogDescription,
  ogImage,
  ogType = 'website',
  twitterTitle,
  twitterDescription,
  twitterCard = 'summary_large_image',
  keywords,
  canonicalUrl,
  metaTags,
  jsonLd,
  enabled = true
}: UsePageSEOProps): UsePageSEOReturn {
  const metadata = useMemo<Partial<SectionSEOMetadata>>(() => {
    return {
      title,
      description,
      ogTitle: ogTitle || title,
      ogDescription: ogDescription || description,
      ogImage,
      ogType,
      twitterTitle: twitterTitle || ogTitle || title,
      twitterDescription: twitterDescription || ogDescription || description,
      twitterCard,
      keywords,
      canonicalUrl,
      metaTags,
      jsonLd
    };
  }, [
    title,
    description,
    ogTitle,
    ogDescription,
    ogImage,
    ogType,
    twitterTitle,
    twitterDescription,
    twitterCard,
    JSON.stringify(keywords),
    canonicalUrl,
    JSON.stringify(metaTags),
    JSON.stringify(jsonLd)
  ]);

  const serializedMetadata = useMemo(() => {
    return JSON.stringify(metadata);
  }, [metadata]);

  const metadataRef = useRef(metadata);
  metadataRef.current = metadata;

  useEffect(() => {
    if (!enabled || !sectionId) return;

    // Register section metadata into central SEO registry used by useSEO
    const cleanup = registerSectionSEO(sectionId, locale, metadataRef.current);

    return () => {
      cleanup();
    };
  }, [sectionId, locale, serializedMetadata, enabled]);

  return {
    sectionId,
    isRegistered: enabled,
    metadata
  };
}

export default usePageSEO;
