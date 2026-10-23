import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { identifyPng } from '../../src/index.ts';

const root = resolve(process.argv[2] ?? '../games/pantheon');
const output = resolve(process.argv[3] ?? 'poc-output/pantheon-inventory.json');
const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
const source = { repository: 'anicolao/pantheon', commit: git('rev-parse', 'HEAD') };
const paths = git('ls-files', '-z', '--', 'tests/e2e').split('\0').filter(p => p.endsWith('.png')).sort();
const images: Record<string, ReturnType<typeof identifyPng>> = {};
const unique = new Map<string, number>();
let totalBytes = 0;
for (const path of paths) {
  const image = identifyPng(await readFile(resolve(root, path)));
  images[path] = image;
  unique.set(image.blobDigest, image.byteLength);
  totalBytes += image.byteLength;
}
const references: { file: string; target: string; exists: boolean }[] = [];
const { access } = await import('node:fs/promises');
for (const file of git('ls-files', '-z', '--', 'tests/e2e').split('\0').filter(p => p.endsWith('.md'))) {
  const text = await readFile(resolve(root, file), 'utf8');
  for (const match of text.matchAll(/(?:src=["']|\]\()([^"')]+\.png)(?:["')])/g)) {
    const target = match[1];
    if (/^https?:/.test(target)) continue;
    const exists = await access(resolve(root, dirname(file), target)).then(() => true, () => false);
    references.push({ file, target, exists });
  }
}
const platformCounts = Object.fromEntries(['darwin', 'linux'].map(platform => [platform,
  Object.keys(images).filter(p => p.endsWith(`-${platform}.png`)).length]));
const summary = { images: paths.length, totalBytes, uniqueImages: unique.size,
  uniqueBytes: [...unique.values()].reduce((a, b) => a + b, 0), platformCounts,
  references: references.length, missingReferences: references.filter(r => !r.exists).length };
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({ schemaVersion: 1, source, summary, images, references }, null, 2) + '\n');
console.log(JSON.stringify({ output, ...source, ...summary }, null, 2));
