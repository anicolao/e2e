import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSuite } from '../src/suite.ts';

test('suite checks catch missing nonvisual tests, unplanned skips, retries, and duplicate results', () => {
  const required = [{ id: 'journey' }, { id: 'behavior' }, { id: 'unsupported-phone-layout', excluded: true }];
  const actual = [{ id: 'journey', status: 'passed', attempts: 1 }, { id: 'behavior', status: 'passed', attempts: 1 },
    { id: 'unsupported-phone-layout', status: 'skipped', attempts: 1 }];
  assert.equal(checkSuite(required, actual).ok, true);
  assert.equal(checkSuite(required, actual.filter(row => row.id !== 'behavior')).ok, false);
  assert.equal(checkSuite(required, actual.map(row => row.id === 'behavior' ? { ...row, status: 'skipped' } : row)).ok, false);
  assert.equal(checkSuite(required, actual.map(row => ({ ...row, attempts: 2 }))).ok, false);
  assert.equal(checkSuite(required, [...actual, actual[0]]).ok, false);
  assert.equal(checkSuite(required, [...actual, { id: 'other', status: 'passed', attempts: 1 }]).ok, false);
});
