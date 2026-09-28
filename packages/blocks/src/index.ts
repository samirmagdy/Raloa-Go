import { z } from 'zod';

export const PRODUCTION_BLOCK_TYPES = ['link', 'gallery', 'booking', 'shop', 'video', 'music', 'contact', 'newsletter', 'header'] as const;
export type BlockType = typeof PRODUCTION_BLOCK_TYPES[number];
export type BlockId = string;
export type BlockProps = Record<string, unknown>;
export type NormalizedBlock = { id: BlockId; type: BlockType; props: BlockProps; visible: boolean };

const text = z.string().trim().max(4_000).default('');
const mediaItemSchema = z.object({ id: z.string().min(1).max(128), src: z.string().max(4_000), thumbnail: z.string().max(4_000).optional(), alt: z.string().max(300).optional(), caption: z.string().max(500).optional(), type: z.enum(['image', 'video']).default('image') });
export const blockSchemas: Record<BlockType, z.ZodTypeAny> = {
  link: z.object({ title: text, titleAr: text, subtitle: text, subtitleAr: text, url: z.string().max(4_000), thumbnail: z.string().max(4_000).optional() }), gallery: z.object({ title: text, titleAr: text, subtitle: text, subtitleAr: text, galleryItems: z.array(mediaItemSchema).max(50) }), booking: z.object({ title: text, titleAr: text, subtitle: text, subtitleAr: text, url: z.string().max(4_000), thumbnail: z.string().max(4_000).optional() }), shop: z.object({ title: text, titleAr: text, subtitle: text, subtitleAr: text, url: z.string().max(4_000), thumbnail: z.string().max(4_000).optional() }), video: z.object({ title: text, titleAr: text, subtitle: text, subtitleAr: text, url: z.string().max(4_000) }), music: z.object({ title: text, titleAr: text, subtitle: text, subtitleAr: text, url: z.string().max(4_000) }), contact: z.object({ title: text, titleAr: text, subtitle: text, subtitleAr: text }), newsletter: z.object({ title: text, titleAr: text, subtitle: text, subtitleAr: text }), header: z.object({ title: text, titleAr: text, subtitle: text, subtitleAr: text }),
};
export type BlockValidationIssue = { path: string; message: string };
export type BlockDefinition = { type: BlockType; label: string; editorKey: string; previewRendererKey: string; publicRendererKey: string; schema: z.ZodTypeAny; analytics: { impression: string; activation?: string }; accessibility: { name: string; requirements: readonly string[] } };

const definition = (type: BlockType, label: string, requirements: readonly string[], activation?: string): BlockDefinition => ({ type, label, editorKey: type, previewRendererKey: type, publicRendererKey: type, schema: blockSchemas[type], analytics: { impression: 'block_impression', activation }, accessibility: { name: label, requirements } });
export const BLOCK_DEFINITIONS: Record<BlockType, BlockDefinition> = {
  link: definition('link', 'Link', ['visible accessible name', 'keyboard operable anchor'], 'block_link_click'), gallery: definition('gallery', 'Gallery', ['meaningful image alt text', 'keyboard operable media controls'], 'gallery_open'), booking: definition('booking', 'Booking', ['descriptive action label', 'keyboard operable link'], 'booking_start'), shop: definition('shop', 'Shop', ['descriptive action label', 'keyboard operable link'], 'shop_open'), video: definition('video', 'Video', ['iframe title', 'lazy loading'], 'media_open'), music: definition('music', 'Music', ['iframe title', 'source link'], 'media_open'), contact: definition('contact', 'Contact form', ['descriptive button label', 'keyboard operable button'], 'contact_start'), newsletter: definition('newsletter', 'Newsletter', ['descriptive button label', 'keyboard operable button'], 'newsletter_start'), header: definition('header', 'Section heading', ['heading hierarchy']),
};

export function isSupportedBlockType(value: unknown): value is BlockType { return typeof value === 'string' && (PRODUCTION_BLOCK_TYPES as readonly string[]).includes(value); }
export function isSelectableBlockType(value: unknown, allowed: readonly string[] = PRODUCTION_BLOCK_TYPES): value is BlockType { return isSupportedBlockType(value) && allowed.includes(value); }
export function isSupportedEmbedUrl(type: 'video' | 'music', value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try { const host = new URL(value).hostname.toLowerCase(); return type === 'video' ? host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'vimeo.com' || host.endsWith('.vimeo.com') : host === 'soundcloud.com' || host === 'www.soundcloud.com' || host === 'open.spotify.com'; } catch { return false; }
}
function isSafeUrl(value: unknown, allowAnchor = false): value is string {
  if (typeof value !== 'string' || value.length > 4_000) return false;
  if (allowAnchor && /^#[a-zA-Z0-9_-]{1,80}$/.test(value)) return true;
  try { const protocol = new URL(value).protocol; return ['https:', 'http:', 'mailto:', 'tel:'].includes(protocol); } catch { return false; }
}
export function normalizeBlock(input: unknown): { block: NormalizedBlock | null; issues: BlockValidationIssue[] } {
  const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const type = raw.type;
  if (!isSupportedBlockType(type)) return { block: null, issues: [{ path: 'type', message: 'Unsupported block type.' }] };
  const result = blockSchemas[type].safeParse(raw);
  if (!result.success) return { block: null, issues: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) };
  const props = result.data as BlockProps;
  if (['link', 'booking', 'shop', 'video', 'music'].includes(type) && !isSafeUrl(props.url)) return { block: null, issues: [{ path: 'url', message: 'Unsafe block URL.' }] };
  if (type === 'gallery' && !(props.galleryItems as Array<Record<string, unknown>>).every((item) => isSafeUrl(item.src))) return { block: null, issues: [{ path: 'galleryItems', message: 'Unsafe gallery media URL.' }] };
  if ((type === 'video' || type === 'music') && !isSupportedEmbedUrl(type, props.url)) return { block: null, issues: [{ path: 'url', message: 'Unsupported embed URL.' }] };
  return { block: { id: typeof raw.id === 'string' && raw.id ? raw.id : `block-${Math.random().toString(36).slice(2)}`, type, props, visible: raw.visible !== false }, issues: [] };
}
export function normalizeBlocks(input: unknown) {
  const blocks: NormalizedBlock[] = []; const issues: BlockValidationIssue[] = [];
  for (const [index, value] of (Array.isArray(input) ? input : []).entries()) { const result = normalizeBlock(value); if (result.block) blocks.push(result.block); issues.push(...result.issues.map((issue) => ({ ...issue, path: `blocks[${index}].${issue.path}` }))); }
  return { blocks, issues, valid: issues.length === 0 };
}
export type SiteRenderModel = { siteId: string; handle: string; theme: Record<string, unknown>; blocks: NormalizedBlock[] };
export interface BlockRenderer<TOutput = unknown> { supports(type: BlockType): boolean; render(block: NormalizedBlock): TOutput; }
