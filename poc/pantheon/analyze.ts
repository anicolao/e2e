import { checkSuite, reportCases, type RequiredCase } from '../../src/suite.ts';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const root = resolve(process.argv[2] ?? 'poc-output');
const folders: string[] = [];
const scope = process.env.E2E_POC_SCOPE ?? 'representative';
const selection = JSON.parse(await readFile(new URL(scope === 'readiness' ? './readiness.json' : scope === 'regressions' ? './regressions.json' : './representative.json', import.meta.url), 'utf8')) as { expectedCaptures: string[]; expectedTests: {title:string;project:string;excluded?:boolean}[] };
const representative = scope !== 'full';
if (scope === 'oracle') {
  selection.expectedCaptures = selection.expectedCaptures.filter(path => path.includes('/oracle-draw-reveals-and-lands-in-its-sorted-hand-layer/'));
  selection.expectedTests = selection.expectedTests.filter(test => test.title.startsWith('Oracle draw'));
}
const suite = JSON.parse(await readFile(new URL('./suite.json', import.meta.url), 'utf8')) as { platforms: { linux: RequiredCase[] } };
const imported = JSON.parse(await readFile(new URL('./baselines.json', import.meta.url), 'utf8')) as { images: Record<string, unknown> };
const fullCaptures = Object.keys(imported.images).filter(p => p.endsWith('-linux.png'));
const acceptedInventory = await readFile(new URL('./active-inventory.json', import.meta.url), 'utf8').then(text => JSON.parse(text) as Record<string, string[]>, error => { if (error.code === 'ENOENT') return undefined; throw error; });
const requiredFullCaptures = acceptedInventory ? Object.values(acceptedInventory).flat() : fullCaptures;
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
  const browserReport = JSON.parse(await readFile(resolve(folder, 'playwright.json'), 'utf8'));
  const suiteCheck = representative ? { ok: true, errors: [] } : checkSuite(suite.platforms.linux, reportCases(browserReport));
  const tests = (await readFile(resolve(folder, 'tests.jsonl'), 'utf8')).trim().split('\n').map(l => JSON.parse(l));
  const seen = new Map<string, string>();
  for (const record of records) {
    if (seen.has(record.baseline)) throw new Error(`Duplicate capture ${record.baseline} in ${folder}`);
    seen.set(record.baseline, record.actual.blobDigest);
  }
  const expectedCaptures = representative ? selection.expectedCaptures : requiredFullCaptures;
  const required = representative || !observing ? expectedCaptures : [];
  const missingCaptures = required.filter(path => !seen.has(path));
  const unexpectedCaptures = required.length ? [...seen.keys()].filter(path => !required.includes(path)) : [];
  const incompleteTests: typeof selection.expectedTests = [];
  if (representative) {
    for (const required of selection.expectedTests) {
      const found = reportCases(browserReport).filter(t => { const id = JSON.parse(t.id); return id.at(-2) === required.title && id.at(-1) === required.project; });
      if (found.length !== 1 || !(found[0].status === 'passed' || required.excluded && found[0].status === 'skipped')) incompleteTests.push(required);
    }
  }
  if (sets.length === 0) for (const row of records) {
    const key = `${row.file}:${row.title}:${row.project}`;
    (activeInventory[key] ??= []).push(row.baseline);
  }
  sets.push(seen);
  results.push({ folder: relativePath(folder), firestoreVersion: records[0]?.firestoreVersion, captures: records.length, browserStats: browserReport.stats, browserErrors: browserReport.errors, suiteCheck, missingCaptures, unexpectedCaptures, incompleteTests,
    importedMatches: records.filter(r => r.matches).length, tests: tests.length,
    failedTests: tests.filter(t => t.status !== 'passed' && !(t.status === 'skipped' && t.expectedStatus === 'skipped')),
    declaredSkips: tests.filter(t => t.status === 'skipped' && t.expectedStatus === 'skipped'), maxCapturePreparationMs: Math.max(...records.map(r => r.elapsedMs)) });
}
function relativePath(path: string) { return path.slice(root.length + 1); }
const requiredRuns = scope === 'oracle' ? 1 : representative ? 9 : 3;
if (sets.length !== requiredRuns) throw new Error(`Need ${requiredRuns} runs from three independent runners, found ${sets.length}`);
const differences = [];
for (let i = 1; i < sets.length; i++) {
  for (const key of new Set([...sets[0].keys(), ...sets[i].keys()])) {
    if (sets[0].get(key) !== sets[i].get(key)) differences.push({ run: i, baseline: key, expected: sets[0].get(key), actual: sets[i].get(key) });
  }
}
const unusedBaselines = representative ? [] : fullCaptures.filter(p => !sets[0].has(p));
const hashDifferences = differences.filter(row => row.expected !== undefined && row.actual !== undefined);
const coverageDifferences = differences.filter(row => row.expected === undefined || row.actual === undefined);
const summary = { runs: results, repeatable: differences.length === 0, hashDifferences, coverageDifferences, differences, unusedBaselines };
await writeFile(resolve(root, 'active-inventory.json'), JSON.stringify(activeInventory, null, 2) + '\n');
await mkdir(root, { recursive: true });
await writeFile(resolve(root, 'analysis.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
if (differences.length || results.some(r => r.missingCaptures.length || r.unexpectedCaptures.length || r.incompleteTests.length || r.failedTests.length || r.importedMatches !== r.captures || r.browserStats.unexpected || r.browserStats.flaky || r.browserErrors.length || !r.suiteCheck.ok) || !sets[0].size) process.exitCode = 1;
