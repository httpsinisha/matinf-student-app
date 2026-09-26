import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reminderPlan } from '../src/lib/reminder-model.ts';
import { pushDestination, isNotificationForPost } from '../src/lib/push-model.ts';
const exam = { id: 'exam-21-first', courseId: 21, course: { title: 'Algebra' }, room: 'A1', year: 4, date: '2027-01-15', start: '09:00', startsAt: '2027-01-15T09:00:00+01:00' };
test('reminders use the campus offset, stable identities and isolated regular/graduate scopes', () => {
  const plan = reminderPlan(exam, 7, 4, false, 60, 0);
  assert.equal(new Date(plan.fireAt).toISOString(), '2027-01-15T07:00:00.000Z');
  const changed = reminderPlan({ ...exam, startsAt: '2027-07-15T09:00:00+02:00' }, 7, 4, false, 1440, 0);
  assert.equal(new Date(changed.fireAt).toISOString(), '2027-07-14T07:00:00.000Z');
  assert.equal(changed.notificationId, plan.notificationId);
  assert.notEqual(reminderPlan(exam, 7, 4, true, 60, 0).key, plan.key);
  assert.notEqual(reminderPlan(exam, 8, 4, false, 60, 0).key, plan.key);
});
test('late, ambiguous and unsupported reminders are rejected before scheduling', () => {
  for (const changed of [{ ...exam, id: undefined }, { ...exam, startsAt: '2027-01-15T09:00:00' }, { ...exam, startsAt: 'invalidZ' }]) assert.throws(() => reminderPlan(changed, 7, 4, false, 60, 0));
  assert.throws(() => reminderPlan(exam, 7, 4, false, 5, 0));
  assert.throws(() => reminderPlan(exam, 7, 4, false, 60, Date.parse(exam.startsAt)));
});
test('reminder taps open the right schedule and never match article tray cleanup', () => {
  const site = 'https://sinisa.alwaysdata.net';
  const data = { version: 1, siteUrl: site, kind: 'exam-reminder', collection: 'schedule', programId: 7, year: 4, scheduleMode: 'graduate' };
  assert.deepEqual(pushDestination(data, site), { collection: 'schedule', programId: 7, year: 4, scheduleMode: 'graduate' });
  assert.deepEqual(pushDestination({ ...data, examId: 'exam-21-first' }, site), { collection: 'schedule', programId: 7, year: 4, scheduleMode: 'graduate', examId: 'exam-21-first' });
  assert.equal(isNotificationForPost(data, site, 7), false);
  for (const changed of [{ ...data, programId: -1 }, { ...data, year: 0 }, { ...data, siteUrl: 'https://other.invalid' }, { ...data, scheduleMode: 'other' }]) assert.equal(pushDestination(changed, site), null);
});
