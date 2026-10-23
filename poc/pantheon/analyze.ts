import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const root = resolve(process.argv[2] ?? 'poc-output');
const folders: string[] = [];
const selection = JSON.parse(await readFile(new URL('./representative.json', import.meta.url), 'utf8')) as { expectedCaptures: string[]; expectedTests: {title:string;project:string}[] };
const representative = process.env.E2E_POC_SCOPE !== 'full';
const imported = JSON.parse(await readFile(new URL('./baselines.json', import.meta.url), 'utf8')) as { images: Record<string, unknown> };
const fullCaptures = Object.keys(imported.images).filter(p => p.endsWith('-linux.png'));
const observing = process.env.E2E_POC_MODE === 'observe';
const activeInventory: Record<string, string[]> = {};
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
  const expectedCaptures = representative ? selection.expectedCaptures : fullCaptures;
  for (const path of (representative || !observing ? expectedCaptures : [])) if (!seen.has(path)) throw new Error(`Missing required capture ${path} in ${folder}`);
  if ((representative || !observing) && seen.size !== expectedCaptures.length) throw new Error(`Unexpected capture count in ${folder}`);
  if (representative) {
    for (const required of selection.expectedTests) {
      const found = tests.filter(t => t.title === required.title && t.project === required.project);
      if (found.length !== 1 || found[0].status !== 'passed') throw new Error(`Required test incomplete: ${required.title} / ${required.project}`);
    }
  }
  if (sets.length === 0) for (const row of records) {
    const key = `${row.file}:${row.title}:${row.project}`;
    (activeInventory[key] ??= []).push(row.baseline);
  }
  sets.push(seen);
  results.push({ folder: relativePath(folder), captures: records.length,
    importedMatches: records.filter(r => r.matches).length, tests: tests.length,
    failedTests: tests.filter(t => t.status !== 'passed' && !(t.status === 'skipped' && t.expectedStatus === 'skipped')),
    declaredSkips: tests.filter(t => t.status === 'skipped' && t.expectedStatus === 'skipped'), maxCapturePreparationMs: Math.max(...records.map(r => r.elapsedMs)) });
}
function relativePath(path: string) { return path.slice(root.length + 1); }
const requiredRuns = representative ? 9 : 3;
if (sets.length !== requiredRuns) throw new Error(`Need ${requiredRuns} runs from three independent runners, found ${sets.length}`);
const differences = [];
for (let i = 1; i < sets.length; i++) {
  for (const key of new Set([...sets[0].keys(), ...sets[i].keys()])) {
    if (sets[0].get(key) !== sets[i].get(key)) differences.push({ run: i, baseline: key, expected: sets[0].get(key), actual: sets[i].get(key) });
  }
}
const unusedBaselines = representative ? [] : fullCaptures.filter(p => !sets[0].has(p));
const summary = { runs: results, repeatable: differences.length === 0, differences, unusedBaselines };
await writeFile(resolve(root, 'active-inventory.json'), JSON.stringify(activeInventory, null, 2) + '\n');
await mkdir(root, { recursive: true });
await writeFile(resolve(root, 'analysis.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
if (differences.length || results.some(r => r.failedTests.length || r.importedMatches !== r.captures) || !sets[0].size) process.exitCode = 1;
