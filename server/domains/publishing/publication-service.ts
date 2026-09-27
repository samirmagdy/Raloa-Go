import { assertPublishableSite } from '../../core/domain-invariants';

export type PublicationResult = {
  status: 'published' | 'unpublished' | 'rolled_back' | 'version_conflict' | 'site_not_found' | 'publication_not_found';
  site?: Record<string, any>;
  publicationVersion?: number;
};

export type SitePublicationRepository = {
  publish(input: { userId: string; siteId: string; expectedDraftRevision?: number }): Promise<PublicationResult>;
  unpublish(input: { userId: string; siteId: string; expectedPublicationVersion?: number }): Promise<PublicationResult>;
  rollback(input: { userId: string; siteId: string; publicationVersion: number; expectedPublicationVersion?: number }): Promise<PublicationResult>;
};

export type SitePublicationService = {
  publish(input: { userId: string; siteId: string; draft: Record<string, any>; expectedDraftRevision?: number }): Promise<PublicationResult>;
  unpublish(input: { userId: string; siteId: string; expectedPublicationVersion?: number }): Promise<PublicationResult>;
  rollback(input: { userId: string; siteId: string; publicationVersion: number; expectedPublicationVersion?: number }): Promise<PublicationResult>;
};

export function createSitePublicationService(repository: SitePublicationRepository, options: {
  normalize?: (draft: Record<string, any>) => Record<string, any>;
  validate?: (draft: Record<string, any>) => { valid: boolean; issues?: readonly unknown[] };
} = {}): SitePublicationService {
  return {
    async publish(input) {
      const normalized = options.normalize ? options.normalize(input.draft) : input.draft;
      const validation = options.validate ? options.validate(normalized) : { valid: true, issues: [] };
      if (!validation.valid) throw new Error('INVALID_SITE_CONTENT');
      assertPublishableSite({
        username: normalized.username,
        displayName: normalized.displayName,
        bio: normalized.bio,
        templateId: normalized.templateId,
        validationIssues: validation.issues
      });
      return repository.publish({ userId: input.userId, siteId: input.siteId, expectedDraftRevision: input.expectedDraftRevision });
    },
    unpublish: (input) => repository.unpublish(input),
    rollback: (input) => repository.rollback(input)
  };
}
