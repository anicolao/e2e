import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ImageStore, type Catalog } from '../../src/store.ts';
import { diagnose } from '../../src/diagnose.ts';

const output = resolve(process.argv[2]);
const application = resolve(process.argv[3] ?? '../games/pantheon');
const captures = (await readFile(resolve(output, 'captures.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
const results = [];
for (const row of captures.filter(row => !row.matches && row.expected)) {
  const catalog: Catalog = { schemaVersion: 1, repository: 'anicolao/e2e-baselines', images: {
    [row.expected.blobDigest]: { ...row.expected, release: 'local-diagnostic', assetId: 0 } } };
  const store = new ImageStore(catalog, { cache: resolve(output, 'diagnostic-cache'), maxBytes: 0,
    request: async () => new Response(await readFile(resolve(application, row.baseline))) });
  const actual = await readFile(resolve(output, 'actual', row.actual.blobDigest.slice(7) + '.png'));
  results.push({ baseline: row.baseline, ...await diagnose(actual, row.expected.blobDigest, store,
    resolve(output, 'diagnostics', row.actual.blobDigest.slice(7))) });
}
await writeFile(resolve(output, 'diagnostics.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
