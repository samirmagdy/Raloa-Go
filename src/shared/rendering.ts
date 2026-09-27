/** Framework-independent site rendering package.
 *
 * Public rendering and Studio preview must enter through this facade so they
 * normalize content and resolve themes identically.
 */
export * from '../lib/blockTypes';
export * from '../lib/contentSchema';
export * from '../utils/designTokens';
export * from '../utils/templateThemes';
export type { TemplateItem, TemplateThemeConfig, BackgroundStyle, MediaGalleryItem } from '../types';
