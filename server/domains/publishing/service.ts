export interface PublishingService { resolve(handle: string): Promise<Record<string, unknown> | null>; }
export function createPublishingService(resolve: PublishingService['resolve']): PublishingService { return { resolve }; }
