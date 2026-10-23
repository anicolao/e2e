import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { identifyPng } from '../src/index.ts';
import { ImageStore, type Catalog } from '../src/store.ts';
import { diagnose } from '../src/diagnose.ts';
import { png } from './fixtures.ts';

test('diagnostics distinguish visible and encoding-only changes and preserve unavailable baselines', async t => {
  const output = await mkdtemp(resolve(tmpdir(), 'e2e-diagnose-')); t.after(() => rm(output, { recursive: true, force: true }));
  const baseline = png(), image = identifyPng(baseline);
  const catalog: Catalog = { schemaVersion: 1, repository: 'anicolao/e2e-baselines', images: { [image.blobDigest]: { ...image, release: 'test', assetId: 1 } } };
  const store = new ImageStore(catalog, { cache: resolve(output, 'cache'), maxBytes: 0, request: async () => new Response(baseline) });
  assert.equal((await diagnose(png(0, 'metadata'), image.blobDigest, store, output)).classification, 'encoding-only');
  const visible = await diagnose(png(1), image.blobDigest, store, output);
  assert.equal(visible.classification, 'pixels-changed'); assert.equal(visible.changedPixels, 1);
  const offline = new ImageStore(catalog, { cache: resolve(output, 'cache'), maxBytes: 0, request: async () => { throw new Error('offline'); } });
  assert.equal((await diagnose(png(1), image.blobDigest, offline, output)).classification, 'diagnostic-error');
  assert.deepEqual(await readFile(resolve(output, 'actual.png')), png(1));
});
