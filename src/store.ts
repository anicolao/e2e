import { mkdir, readFile, readdir, rename, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { comparePng, validateImage, type Digest, type Image } from './index.ts';

export type Catalog = { schemaVersion: 1; repository: string;
  images: Record<Digest, Image & { release: string; assetId: number }> };
export function imageUrl(catalog: Catalog, digest: Digest): string {
  if (!/^[\w.-]+\/[\w.-]+$/.test(catalog.repository)) throw new Error('Invalid store repository');
  const entry = catalog.images[digest];
  if (!entry) throw new Error(`Image absent from catalog: ${digest}`);
  validateImage(entry);
  if (entry.blobDigest !== digest || !entry.release) throw new Error('Invalid catalog entry');
  return `https://github.com/${catalog.repository}/releases/download/${encodeURIComponent(entry.release)}/${digest.slice(7)}.png`;
}

export class ImageStore {
  readonly catalog: Catalog;
  private readonly cache: string;
  private readonly limit: number;
  private readonly request: typeof fetch;
  downloadedBytes = 0;
  constructor(catalog: Catalog, options: { cache: string; maxBytes: number; request?: typeof fetch }) {
    if (catalog.schemaVersion !== 1) throw new Error('Unsupported catalog version');
    if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes < 0) throw new Error('Invalid cache limit');
    this.catalog = catalog; this.cache = resolve(options.cache); this.limit = options.maxBytes;
    this.request = options.request ?? fetch;
  }
  has(digest: Digest): boolean { return Object.hasOwn(this.catalog.images, digest); }
  async get(digest: Digest): Promise<Buffer> {
    const url = imageUrl(this.catalog, digest), expected = this.catalog.images[digest];
    const destination = resolve(this.cache, digest.slice(7) + '.png');
    try {
      const bytes = await readFile(destination);
      if (comparePng(bytes, expected).ok) {
        const now = new Date(); await utimes(destination, now, now); return bytes;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && !(error instanceof Error && error.message.startsWith('Invalid PNG'))) throw error;
    }
    await rm(destination, { force: true });
    const response = await this.request(url, { signal: AbortSignal.timeout(30_000), headers: { Accept: 'image/png' } });
    if (!response.ok || !response.body) throw new Error(`Image download failed: HTTP ${response.status}`);
    const chunks: Uint8Array[] = []; let received = 0;
    const reader = response.body.getReader();
    try {
      while (true) {
        const next = await reader.read(); if (next.done) break;
        received += next.value.byteLength; this.downloadedBytes += next.value.byteLength;
        if (received > expected.byteLength) throw new Error('Image download exceeds expected length');
        chunks.push(next.value);
      }
    } finally { await reader.cancel(); }
    const bytes = Buffer.concat(chunks);
    if (!comparePng(bytes, expected).ok) throw new Error(`Image integrity failed: ${digest}`);
    if (bytes.length <= this.limit) {
      await mkdir(this.cache, { recursive: true });
      const temporary = resolve(this.cache, `${randomUUID()}.tmp`);
      try { await writeFile(temporary, bytes, { flag: 'wx' }); await rename(temporary, destination); }
      finally { await rm(temporary, { force: true }); }
      await this.prune();
    }
    return bytes;
  }
  async prune(): Promise<void> {
    const names = await readdir(this.cache).catch(error => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    });
    const files = await Promise.all(names.filter(n => /^[a-f0-9]{64}\.png$/.test(n)).map(async name => {
      const path = resolve(this.cache, name), info = await stat(path); return { path, size: info.size, accessed: info.mtimeMs };
    }));
    let bytes = files.reduce((total, file) => total + file.size, 0);
    for (const file of files.sort((a, b) => a.accessed - b.accessed)) {
      if (bytes <= this.limit) break;
      await rm(file.path, { force: true }); bytes -= file.size;
    }
  }
  async audit(digests: readonly Digest[]): Promise<void> { for (const digest of digests) await this.get(digest); }
}

export type StorageLock = { repository: string; revision: string; catalogDigest: Digest };
/** Fetch a specific public catalog revision and check its recorded bytes. */
export async function loadCatalog(lock: StorageLock, request: typeof fetch = fetch): Promise<Catalog> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(lock.repository) || !/^[a-f0-9]{40}$/.test(lock.revision) || !/^sha256:[a-f0-9]{64}$/.test(lock.catalogDigest)) {
    throw new Error('Invalid storage lock');
  }
  const response = await request(`https://raw.githubusercontent.com/${lock.repository}/${lock.revision}/catalog.json`, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Catalog download failed: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const { createHash } = await import('node:crypto');
  if (`sha256:${createHash('sha256').update(bytes).digest('hex')}` !== lock.catalogDigest) throw new Error('Catalog integrity failed');
  const catalog = JSON.parse(bytes.toString('utf8')) as Catalog;
  if (catalog.repository !== lock.repository || catalog.schemaVersion !== 1) throw new Error('Catalog identity differs from storage lock');
  for (const digest of Object.keys(catalog.images) as Digest[]) imageUrl(catalog, digest);
  return catalog;
}
