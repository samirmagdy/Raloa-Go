import { unstable_cache } from 'next/cache';
import { publicSiteSnapshotSchema, type PublicSiteSnapshot } from '@raloa/schemas';
import { createPostgresPublicSiteRepository, type PublicSiteRepository } from '@raloa/database';
import { getWebDatabase } from './database';

let repository: PublicSiteRepository | undefined;

function getRepository() {
  repository ||= createPostgresPublicSiteRepository(getWebDatabase());
  return repository;
}

function validate(value: Awaited<ReturnType<PublicSiteRepository['findPublishedByHandle']>>): PublicSiteSnapshot | null {
  return value ? publicSiteSnapshotSchema.parse(value) : null;
}

export function loadPublicSiteByHandle(handle: string) {
  const normalized = handle.replace(/^@/, '').trim().toLowerCase();
  return unstable_cache(
    async () => validate(await getRepository().findPublishedByHandle(normalized)),
    ['public-site-handle', normalized],
    { revalidate: 300, tags: [`public-site:${normalized}`] },
  )();
}

export function loadPublicSiteByHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, '');
  return unstable_cache(
    async () => validate(await getRepository().findPublishedByHostname(normalized)),
    ['public-site-hostname', normalized],
    { revalidate: 300, tags: [`public-domain:${normalized}`] },
  )();
}

export function listPublicSiteHandles() {
  return unstable_cache(
    async () => getRepository().listPublishedHandles(),
    ['public-site-handles'],
    { revalidate: 300, tags: ['public-sites'] },
  )();
}
