export type BlockId = string;
export type BlockType = 'text' | 'links' | 'gallery' | 'booking' | 'products' | 'social';
export type NormalizedBlock = { id: BlockId; type: BlockType; props: Record<string, unknown>; visible: boolean };
export type SiteRenderModel = { siteId: string; handle: string; theme: Record<string, unknown>; blocks: NormalizedBlock[] };

export interface BlockRenderer<TOutput = unknown> {
  supports(type: BlockType): boolean;
  render(block: NormalizedBlock): TOutput;
}

