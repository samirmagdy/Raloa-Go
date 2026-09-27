export const SUPPORTED_BLOCK_TYPES = ['link', 'gallery', 'booking', 'shop', 'video', 'music', 'contact', 'newsletter', 'header'] as const;
export type SupportedBlockType = typeof SUPPORTED_BLOCK_TYPES[number];

export function isSupportedBlockType(value: unknown): value is SupportedBlockType {
  return typeof value === 'string' && (SUPPORTED_BLOCK_TYPES as readonly string[]).includes(value);
}

export function isSupportedEmbedUrl(type: 'video' | 'music', value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (type === 'video') return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'vimeo.com' || host.endsWith('.vimeo.com');
    return host === 'soundcloud.com' || host === 'www.soundcloud.com' || host === 'open.spotify.com';
  } catch (_) {
    return false;
  }
}
