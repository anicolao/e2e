import { createHash } from 'node:crypto';

export type Digest = `sha256:${string}`;
export type Image = { blobDigest: Digest; byteLength: number; width: number; height: number };
export type Comparison = { ok: boolean; expected: Image; actual: Image };
const signature = Buffer.from('89504e470d0a1a0a', 'hex');

/** Hash original PNG bytes. Reading IHDR does not decode or change pixels. */
export function identifyPng(bytes: Buffer): Image {
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature) ||
      bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error('Invalid PNG header');
  }
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (width === 0 || height === 0) throw new Error('Invalid PNG dimensions');
  return { blobDigest: `sha256:${createHash('sha256').update(bytes).digest('hex')}`, byteLength: bytes.length, width, height };
}

export function validateImage(value: Image): void {
  if (!value || !/^sha256:[a-f0-9]{64}$/.test(value.blobDigest) ||
      !Number.isSafeInteger(value.byteLength) || value.byteLength < 33 ||
      !Number.isSafeInteger(value.width) || value.width < 1 ||
      !Number.isSafeInteger(value.height) || value.height < 1) {
    throw new Error('Invalid image manifest entry');
  }
}

export function comparePng(bytes: Buffer, expected: Image): Comparison {
  validateImage(expected);
  const actual = identifyPng(bytes);
  return { ok: actual.blobDigest === expected.blobDigest && actual.byteLength === expected.byteLength &&
    actual.width === expected.width && actual.height === expected.height, expected, actual };
}

/** Required steps are unique and ordered; completion checks that none were omitted. */
export class StepInventory {
  private position = 0;
  private readonly expected: readonly string[];
  constructor(expected: readonly string[]) {
    if (expected.some(id => typeof id !== 'string' || !id.trim())) throw new Error('Step IDs must be nonempty strings');
    this.expected = [...expected];
    if (new Set(expected).size !== expected.length) throw new Error('Duplicate expected step');
  }
  record(id: string): void {
    if (id !== this.expected[this.position]) {
      throw new Error(`Unexpected step ${id}; expected ${this.expected[this.position] ?? 'end of story'}`);
    }
    this.position++;
  }
  finish(): void {
    if (this.position !== this.expected.length) throw new Error(`Missing ${this.expected.length - this.position} steps`);
  }
}
