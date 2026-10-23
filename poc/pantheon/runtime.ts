import { appendFileSync, mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { relative, resolve, dirname } from 'node:path';
import { comparePng, identifyPng, StepInventory, type Image } from '../../src/index.ts';

const root = process.cwd();
const manifest = JSON.parse(readFileSync(resolve(root, '.e2e-poc/baselines.json'), 'utf8')) as { source: { commit: string }; images: Record<string, Image> };
const mode = process.env.E2E_POC_MODE ?? 'observe';
if (!['observe', 'verify'].includes(mode)) throw new Error(`Unknown POC mode ${mode}`);
const output = resolve(process.env.E2E_POC_OUTPUT ?? 'poc-output');
mkdirSync(output, { recursive: true });

const inventories = new Map<string, StepInventory>();
const slug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function inventory(file: string, title: string, project: string): StepInventory {
  const key = `${file}:${title}:${project}`;
  let item = inventories.get(key);
  if (!item) {
    const prefix = `${dirname(relative(root, file))}/screenshots/${slug(title)}/`;
    const expected = Object.keys(manifest.images).filter(p => p.startsWith(prefix) && p.endsWith(`-${project}-${process.platform}.png`)).sort();
    item = new StepInventory(expected); inventories.set(key, item);
  }
  return item;
}

type Capture = { baseline: string; file: string; story: string; title: string; stepId: string;
  caption: string; assertions: string[]; player?: string; project: string; elapsedMs: number };
export function recordCapture(bytes: Buffer, metadata: Capture): void {
  const path = relative(root, metadata.baseline);
  inventory(metadata.file, metadata.title, metadata.project).record(path);
  const expected = manifest.images[path];
  const started = performance.now();
  const comparison = expected ? comparePng(bytes, expected) : undefined;
  const actual = comparison?.actual ?? identifyPng(bytes);
  const matches = comparison?.ok ?? false;
  const comparisonMs = performance.now() - started;
  appendFileSync(resolve(output, 'captures.jsonl'), JSON.stringify({ ...metadata,
    baseline: path, file: relative(root, metadata.file), actual, expected, matches, mode,
    comparisonMs, sourceCommit: manifest.source.commit }) + '\n');
  if (!matches) {
    const folder = resolve(output, 'actual');
    mkdirSync(folder, { recursive: true });
    const destination = resolve(folder, actual.blobDigest.slice(7) + '.png');
    if (!existsSync(destination)) writeFileSync(destination, bytes);
  }
  if (mode === 'verify' && !matches) throw new Error(`PNG bytes differ: ${path}; expected ${expected?.blobDigest ?? 'missing'}, actual ${actual.blobDigest}`);
}
export function recordTest(info: { file: string; title: string; status?: string; expectedStatus: string; project: { name: string } }): void {
  if (info.status === 'passed') inventory(info.file, info.title, info.project.name).finish();
  appendFileSync(resolve(output, 'tests.jsonl'), JSON.stringify({ title: info.title, project: info.project.name,
    status: info.status, expectedStatus: info.expectedStatus }) + '\n');
}
