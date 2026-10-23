import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identifyPng, comparePng, StepInventory } from '../src/index.ts';

import { png } from './fixtures.ts';
test('byte equality accepts the original and rejects both visible and metadata-only changes', () => {
  const original = png(), expected = identifyPng(original);
  assert.equal(comparePng(original, expected).ok, true);
  assert.equal(comparePng(png(1), expected).ok, false);
  assert.equal(comparePng(png(0, 'same pixels'), expected).ok, false);
  assert.equal(comparePng(original, { ...expected, byteLength: expected.byteLength + 1 }).ok, false);
});
test('invalid PNG headers and malformed manifest hashes fail clearly', () => {
  assert.throws(() => identifyPng(Buffer.from('not a png')), /Invalid PNG/);
  assert.throws(() => comparePng(png(), { ...identifyPng(png()), blobDigest: 'sha256:no' }), /Invalid image/);
});
test('inventory detects omitted, duplicate, unexpected, and reordered steps', () => {
  const valid = new StepInventory(['open', 'join']); valid.record('open'); valid.record('join'); valid.finish();
  assert.throws(() => new StepInventory(['open', 'open']), /Duplicate/);
  assert.throws(() => new StepInventory(['open']).finish(), /Missing/);
  assert.throws(() => new StepInventory(['open', 'join']).record('join'), /Unexpected/);
  assert.throws(() => valid.record('join'), /Unexpected/);
});
test('blank step IDs cannot become accepted expectations', () => {
  assert.throws(() => new StepInventory(['']), /nonempty/);
});
