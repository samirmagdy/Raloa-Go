import type { DesignTokens } from '../utils/designTokens';

export interface PublicCreatorPage {
  handle: string;
  name: string;
  role: string;
  bio: string;
  bioAr: string;
  avatar: string;
  coverImage: string;
  metaTitle?: string;
  metaDescription?: string;
  isPublished: boolean;
  designTokens: DesignTokens;
  site: Record<string, unknown>;
}

export interface PublicCreatorMetadata {
  title: string;
  description: string;
  canonicalPath: string;
  image: string;
  robots: 'index, follow' | 'noindex, nofollow';
}

export interface PublicCreatorAdapter {
  loadPage(handle: string): Promise<PublicCreatorPage | null>;
  getMetadata(page: PublicCreatorPage): PublicCreatorMetadata;
  cacheControl: string;
  invalidate(handle: string): Promise<void>;
}
