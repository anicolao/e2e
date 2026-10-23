import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const root = resolve(process.argv[2] ?? 'poc-output');
const folders: string[] = [];
async function scan(path: string) {
  for (const item of await readdir(path, { withFileTypes: true })) {
    if (item.isDirectory() && item.name !== 'actual') await scan(resolve(path, item.name));
    if (item.isFile() && item.name === 'captures.jsonl') folders.push(path);
  }
}
await scan(root);
const sets: Map<string, string>[] = [];
const results = [];
for (const folder of folders.sort()) {
  const records = (await readFile(resolve(folder, 'captures.jsonl'), 'utf8')).trim().split('\n').map(l => JSON.parse(l));
  const tests = (await readFile(resolve(folder, 'tests.jsonl'), 'utf8')).trim().split('\n').map(l => JSON.parse(l));
  const seen = new Map<string, string>();
  for (const record of records) {
    if (seen.has(record.baseline)) throw new Error(`Duplicate capture ${record.baseline} in ${folder}`);
    seen.set(record.baseline, record.actual.blobDigest);
  }
  sets.push(seen);
  results.push({ folder: relativePath(folder), captures: records.length,
    importedMatches: records.filter(r => r.matches).length, tests: tests.length,
    failedTests: tests.filter(t => t.status !== 'passed'), maxCapturePreparationMs: Math.max(...records.map(r => r.elapsedMs)) });
}
function relativePath(path: string) { return path.slice(root.length + 1); }
if (sets.length < 3) throw new Error(`Need at least three runs, found ${sets.length}`);
const differences = [];
for (let i = 1; i < sets.length; i++) {
  for (const key of new Set([...sets[0].keys(), ...sets[i].keys()])) {
    if (sets[0].get(key) !== sets[i].get(key)) differences.push({ run: i, baseline: key, expected: sets[0].get(key), actual: sets[i].get(key) });
  }
}
const summary = { runs: results, repeatable: differences.length === 0, differences };
await mkdir(root, { recursive: true });
await writeFile(resolve(root, 'analysis.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
if (differences.length || results.some(r => r.failedTests.length) || !sets[0].size) process.exitCode = 1;
