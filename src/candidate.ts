import { createHash } from 'node:crypto';
import { StepInventory, validateImage, type Digest, type Image } from './index.ts';

export type Candidate = { schemaVersion: 1; sourceRevision: string; parentManifestDigest: Digest;
  environmentDigest: Digest; captures: { id: string; image: Image }[] };
export type Approval = { candidateDigest: Digest; reviewer: string };

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  if (value === undefined || typeof value === 'number' && !Number.isFinite(value)) throw new Error('Unsupported candidate value');
  return JSON.stringify(value);
}
export function candidateDigest(candidate: Candidate): Digest {
  return `sha256:${createHash('sha256').update(canonical(candidate)).digest('hex')}`;
}

/** The publisher supplies the approval from its trusted review workflow. */
export function checkCandidate(candidate: Candidate, current: { sourceRevision: string;
  manifestDigest: Digest; environmentDigest: Digest; requiredSteps: readonly string[] }, approval: Approval): void {
  if (![candidate.parentManifestDigest, candidate.environmentDigest].every(value => /^sha256:[a-f0-9]{64}$/.test(value))) throw new Error('Invalid candidate digest');
  if (candidate.schemaVersion !== 1 || !/^[a-f0-9]{40}$/.test(candidate.sourceRevision)) throw new Error('Invalid candidate source');
  if (candidate.sourceRevision !== current.sourceRevision) throw new Error('Candidate source changed');
  if (candidate.parentManifestDigest !== current.manifestDigest) throw new Error('Starting baseline changed');
  if (candidate.environmentDigest !== current.environmentDigest) throw new Error('Candidate environment changed');
  const steps = new StepInventory(current.requiredSteps);
  for (const capture of candidate.captures) { steps.record(capture.id); validateImage(capture.image); }
  steps.finish();
  if (!approval.reviewer.trim() || candidateDigest(candidate) !== approval.candidateDigest) throw new Error('Review does not approve this candidate');
}
