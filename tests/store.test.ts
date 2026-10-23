import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { identifyPng } from '../src/index.ts';
import { ImageStore, imageUrl, type Catalog } from '../src/store.ts';
import { png } from './fixtures.ts';

async function setup(t: { after: (fn: () => Promise<void>) => void }) {
  const cache = await mkdtemp(resolve(tmpdir(), 'e2e-store-')); t.after(() => rm(cache, { recursive: true, force: true }));
  const bytes = png(), image = identifyPng(bytes);
  const catalog: Catalog = { schemaVersion: 1, repository: 'anicolao/e2e-baselines', images: { [image.blobDigest]: { ...image, release: 'batch-001', assetId: 1 } } };
  return { cache, bytes, image, catalog };
}
test('download verifies original bytes, and a cached image works offline', async t => {
  const { cache, bytes, image, catalog } = await setup(t); let calls = 0;
  const store = new ImageStore(catalog, { cache, maxBytes: 1024, request: async () => { calls++; return new Response(bytes); } });
  assert.equal(imageUrl(catalog, image.blobDigest), `https://github.com/anicolao/e2e-baselines/releases/download/batch-001/${image.blobDigest.slice(7)}.png`);
  assert.deepEqual(await store.get(image.blobDigest), bytes);
  assert.deepEqual(await store.get(image.blobDigest), bytes); assert.equal(calls, 1);
  const offline = new ImageStore(catalog, { cache, maxBytes: 1024, request: async () => { throw new Error('offline'); } });
  assert.deepEqual(await offline.get(image.blobDigest), bytes);
});
test('corrupt downloads are rejected and never cached', async t => {
  const { cache, image, catalog } = await setup(t);
  const store = new ImageStore(catalog, { cache, maxBytes: 1024, request: async () => new Response(png(1)) });
  await assert.rejects(store.get(image.blobDigest), /integrity|length/); assert.deepEqual(await readdir(cache), []);
});
test('a corrupt cache entry is replaced only with verified bytes', async t => {
  const { cache, bytes, image, catalog } = await setup(t);
  const file = resolve(cache, image.blobDigest.slice(7) + '.png'); await writeFile(file, 'broken');
  const store = new ImageStore(catalog, { cache, maxBytes: 1024, request: async () => new Response(bytes) });
  await store.get(image.blobDigest); assert.deepEqual(await readFile(file), bytes);
});
test('cache eviction respects its byte limit', async t => {
  const { cache, bytes, image, catalog } = await setup(t);
  const second = png(1), next = identifyPng(second);
  catalog.images[next.blobDigest] = { ...next, release: 'batch-001', assetId: 2 };
  const store = new ImageStore(catalog, { cache, maxBytes: Math.max(bytes.length, second.length), request: async url => new Response(String(url).includes(image.blobDigest.slice(7)) ? bytes : second) });
  await store.get(image.blobDigest); await store.get(next.blobDigest);
  assert.equal((await readdir(cache)).length, 1);
});
test('HTTP failure and absent catalog entries remain failures', async t => {
  const { cache, image, catalog } = await setup(t);
  const store = new ImageStore(catalog, { cache, maxBytes: 0, request: async () => new Response('', { status: 404 }) });
  await assert.rejects(store.get(image.blobDigest), /HTTP 404/);
  assert.throws(() => imageUrl(catalog, `sha256:${'0'.repeat(64)}`), /absent/);
});
test('concurrent readers of one image keep one verified cache object', async t => {
  const { cache, bytes, image, catalog } = await setup(t);
  const store = new ImageStore(catalog, { cache, maxBytes: 1024, request: async () => new Response(bytes) });
  const copies = await Promise.all([store.get(image.blobDigest), store.get(image.blobDigest)]);
  assert.ok(copies.every(copy => copy.equals(bytes)));
  assert.equal((await readdir(cache)).length, 1);
});
test('catalog lookup pins both its commit and original bytes', async t => {
  const { catalog } = await setup(t);
  const { createHash } = await import('node:crypto');
  const { loadCatalog } = await import('../src/store.ts');
  const body = JSON.stringify(catalog);
  const lock = { repository: catalog.repository, revision: 'a'.repeat(40), catalogDigest: `sha256:${createHash('sha256').update(body).digest('hex')}` as const };
  assert.deepEqual(await loadCatalog(lock, async url => { assert.ok(String(url).includes(lock.revision)); return new Response(body); }), catalog);
  await assert.rejects(loadCatalog(lock, async () => new Response('{}')), /integrity/);
  await assert.rejects(loadCatalog({ ...lock, revision: 'main' }), /Invalid storage lock/);
});
test('concurrent publications reuse existing locations and reject conflicting metadata', async t => {
  const { catalog, image } = await setup(t);
  const { mergeCatalog } = await import('../src/store.ts');
  const incoming = structuredClone(catalog);
  incoming.images[image.blobDigest].release = 'another-batch';
  incoming.images[image.blobDigest].assetId = 10;
  const merged = mergeCatalog(catalog, incoming);
  assert.equal(Object.keys(merged.images).length, 1);
  assert.equal(merged.images[image.blobDigest].release, 'batch-001');
  incoming.images[image.blobDigest].width++;
  assert.throws(() => mergeCatalog(catalog, incoming), /Conflicting/);
});
