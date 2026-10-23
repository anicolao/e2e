import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidateDigest, checkCandidate, type Candidate } from '../src/candidate.ts';
import { identifyPng, type Digest } from '../src/index.ts';
import { png } from './fixtures.ts';

test('publication binds review to complete steps, exact source, baseline, and environment', () => {
  const digest = `sha256:${'a'.repeat(64)}` as Digest;
  const candidate: Candidate = { schemaVersion: 1, sourceRevision: 'b'.repeat(40), parentManifestDigest: digest,
    environmentDigest: digest, captures: [{ id: 'open', image: identifyPng(png()) }, { id: 'join', image: identifyPng(png(1)) }] };
  const current = { sourceRevision: candidate.sourceRevision, manifestDigest: digest, environmentDigest: digest, requiredSteps: ['open', 'join'] };
  const approval = { candidateDigest: candidateDigest(candidate), reviewer: 'maintainer' };
  checkCandidate(candidate, current, approval);
  assert.throws(() => checkCandidate(candidate, { ...current, sourceRevision: 'c'.repeat(40) }, approval), /source changed/);
  assert.throws(() => checkCandidate(candidate, { ...current, manifestDigest: `sha256:${'c'.repeat(64)}` }, approval), /baseline changed/);
  assert.throws(() => checkCandidate(candidate, { ...current, environmentDigest: `sha256:${'c'.repeat(64)}` }, approval), /environment changed/);
  assert.throws(() => checkCandidate({ ...candidate, captures: candidate.captures.slice(1) }, current, approval), /Unexpected/);
  assert.throws(() => checkCandidate({ ...candidate, captures: candidate.captures.slice(0, 1) }, current, approval), /Missing/);
  assert.throws(() => checkCandidate(candidate, current, { ...approval, reviewer: '' }), /Review/);
  assert.throws(() => checkCandidate({ ...candidate, captures: candidate.captures.map(c => ({ ...c, image: identifyPng(png(2)) })) }, current, approval), /Review/);
});
