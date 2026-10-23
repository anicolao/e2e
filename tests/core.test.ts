import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { identifyPng, comparePng, StepInventory } from '../src/index.ts';

function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length); out.write(type, 4); data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, -4)), out.length - 4);
  return out;
}
export function png(red = 0, note = '') {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr),
    ...(note ? [chunk('tEXt', Buffer.from(`comment\0${note}`))] : []),
    chunk('IDAT', deflateSync(Buffer.from([0, red, 0, 0, 255]))), chunk('IEND', Buffer.alloc(0))]);
}
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
