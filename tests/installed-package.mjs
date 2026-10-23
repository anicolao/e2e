import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const scratch = await mkdtemp(resolve(tmpdir(), 'e2e-package-'));
try {
  const packed = JSON.parse(execFileSync('npm', ['pack', '--json', '--pack-destination', scratch], { encoding: 'utf8' }))[0];
  assert.ok(packed.files.some(file => file.path === 'dist/index.js'));
  assert.ok(packed.files.every(file => !file.path.endsWith('.png') && !file.path.startsWith('poc/')));
  await writeFile(resolve(scratch, 'package.json'), '{"type":"module","private":true}\n');
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', resolve(scratch, packed.filename)], { cwd: scratch, stdio: 'pipe' });
  await writeFile(resolve(scratch, 'check.mjs'), `
    import assert from 'node:assert/strict';
    import { identifyPng } from '@anicolao/e2e';
    import { ImageStore, loadCatalog } from '@anicolao/e2e/store';
    import { diagnose } from '@anicolao/e2e/diagnose';
    import { checkCandidate } from '@anicolao/e2e/candidate';
    import { checkSuite } from '@anicolao/e2e/suite';
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
    assert.equal(identifyPng(png).width, 1);
    assert.equal(typeof ImageStore, 'function'); assert.equal(typeof loadCatalog, 'function');
    assert.equal(typeof diagnose, 'function'); assert.equal(typeof checkCandidate, 'function');
    assert.equal(checkSuite([{id:'test'}],[{id:'test',status:'passed',attempts:1}]).ok,true);
  `);
  await writeFile(resolve(scratch, 'check.ts'), `import { identifyPng } from '@anicolao/e2e'; import { ImageStore } from '@anicolao/e2e/store'; const image = identifyPng(Buffer.alloc(0)); const width: number = image.width; const store: typeof ImageStore = ImageStore;`);
  execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--target', 'ES2023', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--typeRoots', resolve('node_modules/@types'), 'check.ts'], { cwd: scratch, stdio: 'inherit' });
  execFileSync(process.execPath, ['check.mjs'], { cwd: scratch, stdio: 'inherit' });
  console.log(`Installed tarball works in a separate consumer: ${packed.size} bytes, ${packed.files.length} files`);
} finally { await rm(scratch, { recursive: true, force: true }); }
