import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePreferences, restoreProgramId, toggleSelection } from '../src/lib/onboarding-model.ts';

const saved = {
  version: 1, completed: true, programYears: ['demo-mi:1'], courseIds: [],
  notificationsRequested: false, permission: 'not-requested', syncStatus: 'not-needed',
};

test('restore selected program instead of first alphabetical program, including legacy selections', () => {
  const programs = [{ id: '51' }, { id: '30' }, { id: '21' }];
  const courses = [{ id: '101', programId: '30' }];
  assert.equal(restoreProgramId({ ...saved, programYears: ['30:4'] }, programs, courses), '30');
  assert.equal(restoreProgramId({ ...saved, programYears: [], courseIds: ['101'] }, programs, courses), '30');
  const value = parsePreferences(JSON.stringify({ ...saved, programYears: ['21:4'], selectedProgramId: '30' }));
  assert.equal(restoreProgramId(value, programs, courses), '30');
  assert.equal(restoreProgramId({ ...saved, selectedProgramId: 'deleted', programYears: ['30:4'] }, programs, courses), '30');
  assert.equal(restoreProgramId(saved, [], courses), '');
  assert.equal(parsePreferences(JSON.stringify({ ...saved, selectedProgramId: 30 })), null);
});

test('saved opt-out and program selections survive a restart', () => {
  assert.deepEqual(parsePreferences(JSON.stringify(saved)), saved);
});
test('malformed, partial, and future-version records do not skip onboarding', () => {
  for (const raw of [null, 'oops', 'null', '{}', JSON.stringify({ ...saved, version: 2 }),
    JSON.stringify({ ...saved, courseIds: [123] }), JSON.stringify({ ...saved, permission: 'enabled' })]) {
    assert.equal(parsePreferences(raw), null);
  }
});
test('year selections stay associated with their program', () => {
  const original = ['demo-mi:1'];
  const selected = toggleSelection(original, 'demo-i:1');
  assert.deepEqual(selected, ['demo-mi:1', 'demo-i:1']);
  assert.deepEqual(toggleSelection(selected, 'demo-mi:1'), ['demo-i:1']);
  assert.deepEqual(original, ['demo-mi:1']);
});
