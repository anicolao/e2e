import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { identifyPng, type Digest } from './index.ts';
import { ImageStore } from './store.ts';

/** Diagnostics explain a failed byte check; their pixel analysis never changes its result. */
export async function diagnose(actual: Buffer, expectedDigest: Digest, store: ImageStore, output: string) {
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'actual.png'), actual);
  const observed = identifyPng(actual);
  let report: Record<string, unknown>;
  try {
    const expected = await store.get(expectedDigest);
    await writeFile(resolve(output, 'expected.png'), expected);
    const [a, b] = await Promise.all([sharp(actual).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
      sharp(expected).ensureAlpha().raw().toBuffer({ resolveWithObject: true })]);
    const sameDimensions = a.info.width === b.info.width && a.info.height === b.info.height;
    const samePixels = sameDimensions && a.data.equals(b.data);
    const classification = observed.blobDigest === expectedDigest ? 'identical' : samePixels ? 'encoding-only' : 'pixels-changed';
    let changedPixels = 0;
    if (sameDimensions) {
      const diff = Buffer.alloc(a.data.length);
      for (let i = 0; i < diff.length; i += 4) {
        const changed = !a.data.subarray(i, i + 4).equals(b.data.subarray(i, i + 4));
        if (changed) { diff[i] = 255; diff[i + 3] = 255; changedPixels++; }
      }
      await sharp(diff, { raw: { width: a.info.width, height: a.info.height, channels: 4 } }).png().toFile(resolve(output, 'diff.png'));
    }
    report = { classification, expectedDigest, actual: observed, changedPixels: sameDimensions ? changedPixels : null };
  } catch (error) {
    report = { classification: 'diagnostic-error', expectedDigest, actual: observed, error: String(error) };
  }
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}
