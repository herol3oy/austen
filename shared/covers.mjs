export const COVER_SCHEMA_VERSION = 3;

const slug = '[a-z0-9]+(?:-[a-z0-9]+)*';
const hash = /^[a-f0-9]{64}$/;
const gitSha = /^[a-f0-9]{40}$/;
const statuses = new Set(['imported', 'missing_repository', 'missing_cover', 'failed']);

export const standardEbooksRepository = book => book.id.replaceAll('/', '_').slice(0, 100);
export const coverAssetPath = book => `src/assets/covers/${book.slug}/cover.jpg`;

export function validateCovers(manifest) {
  if (manifest?.schemaVersion !== COVER_SCHEMA_VERSION || !manifest.books || typeof manifest.books !== 'object' || Array.isArray(manifest.books)) {
    throw new Error('Invalid cover manifest');
  }
  for (const [id, record] of Object.entries(manifest.books)) {
    if (!id || !record || !statuses.has(record.status) || !Number.isFinite(Date.parse(record.checkedAt))) throw new Error(`Invalid cover record: ${id}`);
    const nullable = ['repository', 'branch', 'sourceSha', 'assetPath', 'sourceHash'];
    if (nullable.some(key => record[key] !== null && typeof record[key] !== 'string')) throw new Error(`Invalid cover record: ${id}`);
    if (record.status === 'imported') {
      if (!/^[-a-z0-9_]{1,100}$/.test(record.repository) || record.branch !== 'master' || !gitSha.test(record.sourceSha)
        || !new RegExp(`^src/assets/covers/${slug}/cover\\.jpg$`).test(record.assetPath)
        || !hash.test(record.sourceHash)) throw new Error(`Invalid cover record: ${id}`);
    } else if (nullable.some(key => record[key] !== null)) throw new Error(`Invalid cover record: ${id}`);
  }
  return manifest;
}

export function savedCoverSlug(book, manifest) {
  const record = manifest.books[book.id];
  return record?.status === 'imported' && record.assetPath === coverAssetPath(book) ? book.slug : undefined;
}
