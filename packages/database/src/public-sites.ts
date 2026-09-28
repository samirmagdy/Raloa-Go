import type { Pool } from 'pg';

export type PublicSiteSnapshotRecord = {
  siteId: string;
  handle: string;
  displayName: string;
  role: string;
  bio: string;
  bioAr: string;
  avatar: string;
  coverImage: string;
  metaTitle?: string;
  metaDescription?: string;
  locale: 'en' | 'ar';
  publicationVersion: number;
  isPublished: true;
  designTokens: Record<string, unknown>;
  links: Record<string, unknown>[];
  socials: Record<string, unknown>[];
  blocks: Record<string, unknown>[];
};

export interface PublicSiteRepository {
  findPublishedByHandle(handle: string): Promise<PublicSiteSnapshotRecord | null>;
  findPublishedByHostname(hostname: string): Promise<PublicSiteSnapshotRecord | null>;
  listPublishedHandles(): Promise<Array<{ handle: string; updatedAt: Date }>>;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object' && !Array.isArray(entry))) : [];
}

function mapSnapshot(row: Record<string, unknown>): PublicSiteSnapshotRecord {
  const content = objectValue(row.content);
  const designConfig = objectValue(row.design_config);
  const tokens = objectValue(content.designTokens ?? content.design_tokens ?? designConfig);
  return {
    siteId: String(row.site_id),
    handle: String(row.handle),
    displayName: String(content.displayName ?? content.display_name ?? row.display_name ?? 'Creator'),
    role: String(content.role ?? content.title ?? ''),
    bio: String(content.bio ?? ''),
    bioAr: String(content.bioAr ?? content.bio_ar ?? ''),
    avatar: String(content.avatar ?? content.avatarUrl ?? content.avatar_url ?? ''),
    coverImage: String(content.coverImage ?? content.cover_image ?? content.coverImageUrl ?? ''),
    metaTitle: typeof content.metaTitle === 'string' ? content.metaTitle : undefined,
    metaDescription: typeof content.metaDescription === 'string' ? content.metaDescription : undefined,
    locale: content.locale === 'ar' || content.language === 'ar' ? 'ar' : 'en',
    publicationVersion: Number(row.publication_version ?? 1),
    isPublished: true,
    designTokens: tokens,
    links: arrayValue(content.links),
    socials: arrayValue(content.socials),
    blocks: arrayValue(content.blocks ?? content.links),
  };
}

const publishedProjection = `
  SELECT s.id::text AS site_id, s.handle, s.display_name, s.publication_version,
         s.updated_at, snap.content, snap.design_config
    FROM sites s
    JOIN published_site_snapshots snap
      ON snap.id = s.published_snapshot_id
     AND snap.site_id = s.id
     AND snap.is_current = true
`;

const publishedWhere = `WHERE s.is_published = true`;

export function createPostgresPublicSiteRepository(pool: Pool): PublicSiteRepository {
  return {
    async findPublishedByHandle(handle) {
      const result = await pool.query(`${publishedProjection} ${publishedWhere} AND s.handle = $1 LIMIT 1`, [handle]);
      return result.rows[0] ? mapSnapshot(result.rows[0]) : null;
    },
    async findPublishedByHostname(hostname) {
      const result = await pool.query(`
        ${publishedProjection}
        JOIN custom_domains d
          ON d.site_id = s.id
         AND d.hostname = $1
         AND d.verification_status = 'verified'
         AND d.ssl_status = 'active'
         AND d.provisioning_state = 'verified'
        ${publishedWhere}
        LIMIT 1
      `, [hostname]);
      return result.rows[0] ? mapSnapshot(result.rows[0]) : null;
    },
    async listPublishedHandles() {
      const result = await pool.query(`${publishedProjection} ${publishedWhere} ORDER BY s.handle ASC LIMIT 10000`);
      return result.rows.map((row) => ({ handle: String(row.handle), updatedAt: new Date(String(row.updated_at)) }));
    },
  };
}
