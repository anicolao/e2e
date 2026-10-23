import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { imageUrl, type Catalog } from '../../src/store.ts';
import type { Image } from '../../src/index.ts';

const [captures, story, destination] = process.argv.slice(2);
if (!captures || !story || !destination) throw new Error('Usage: render-story.ts captures.jsonl story-id output-directory');
const catalog = JSON.parse(await readFile(new URL('./catalog.json', import.meta.url), 'utf8')) as Catalog;
type Row = { story: string; title: string; stepId: string; project: string; caption: string; player?: string; assertions: string[]; actual: Image; matches: boolean };
const rows = (await readFile(captures, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as Row).filter(row => row.story === story);
if (!rows.length || rows.some(row => !row.matches)) throw new Error('Story needs verified captures');
const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function view(stepId: string, project: string) {
  const selected = rows.filter(row => row.stepId === stepId && row.project === project);
  if (selected.length !== 1) throw new Error(`Expected one view: ${stepId}/${project}`);
  const row = selected[0], stored = catalog.images[row.actual.blobDigest];
  if (!stored || stored.byteLength !== row.actual.byteLength || stored.width !== row.actual.width || stored.height !== row.actual.height) throw new Error('Capture absent from catalog');
  const url = imageUrl(catalog, row.actual.blobDigest);
  return `<a href="${url}"><img src="${url}" alt="${escape(row.caption)}" width="${project === 'phone' ? 240 : project === 'desktop' ? 720 : 960}"></a>`;
}
const body = [`# ${rows[0].title}`, '', 'Verified captures stored in a separate public GitHub repository.', ''];
for (const row of rows.filter(row => row.project === 'desktop')) {
  body.push(`## ${row.caption}`, '');
  if (row.player) body.push(`Viewpoint: **${row.player}**.`, '');
  body.push('<table><tr><th>Desktop</th><th>Phone</th></tr>', `<tr><td>${view(row.stepId, 'desktop')}</td><td>${view(row.stepId, 'phone')}</td></tr></table>`, '', '<details><summary>4K screenshot</summary>', '', view(row.stepId, 'tabletop-4k'), '', '</details>', '', ...row.assertions.map(text => '- [x] ' + text), '');
}
if (!rows.some(row => row.project === 'desktop')) throw new Error('Story has no desktop steps');
await mkdir(destination, { recursive: true });
await writeFile(resolve(destination, 'README.md'), body.join('\n'));
