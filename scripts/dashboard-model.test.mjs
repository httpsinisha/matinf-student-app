import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyAgenda } from '../src/lib/dashboard-model.ts';
const items = [{ id: 'mon', day: 1, start: '09:00', end: '10:00' }, { id: 'tue', day: 2, start: '11:00', end: '12:00' }];
test('agenda uses Sarajevo time and includes an ongoing lesson', () => {
  const agenda = dailyAgenda(items, new Date('2026-09-28T07:30:00Z'));
  assert.equal(agenda.next.id, 'mon'); assert.equal(agenda.running, true); assert.equal(agenda.today.length, 1);
});
test('at lesson end, the next day is selected rather than the expired lesson', () => {
  const agenda = dailyAgenda(items, new Date('2026-09-28T08:00:00Z'));
  assert.equal(agenda.next.id, 'tue'); assert.equal(agenda.next.offset, 1); assert.equal(agenda.running, false);
});
test('weekend rolls over to Monday and an empty schedule has no next lesson', () => {
  const agenda = dailyAgenda(items, new Date('2026-10-04T10:00:00Z'));
  assert.equal(agenda.today.length, 0); assert.equal(agenda.next.id, 'mon'); assert.equal(agenda.next.offset, 1);
  assert.equal(dailyAgenda([], new Date()).next, undefined);
});
