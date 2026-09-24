import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTokenChangeListener, pushDestination } from '../src/lib/push-model.ts';

const site = 'https://sinisa.alwaysdata.net';
const valid = { version: 1, siteUrl: site, collection: 'announcements', id: 73 };
test('fetching the same Android token during registration does not start a registration loop', () => {
  let registrations = 0;
  let current = 'first-fcm-token';
  const listener = createTokenChangeListener(() => {
    registrations++;
    listener({ type: 'android', data: current }); // SDK emits during getDevicePushTokenAsync.
  });
  listener({ type: 'android', data: current });
  listener({ type: 'android', data: current });
  assert.equal(registrations, 1);
  current = 'rotated-fcm-token';
  listener({ type: 'android', data: current });
  assert.equal(registrations, 2);
});
test('notification tap opens only a supported article from this backend', () => {
  assert.deepEqual(pushDestination(valid, site), { collection: 'announcements', id: 73 });
  assert.deepEqual(pushDestination({ ...valid, collection: 'news' }, site), { collection: 'news', id: 73 });
  for (const data of [null, {}, { ...valid, siteUrl: 'https://other.invalid' }, { ...valid, id: '73' },
    { ...valid, id: -1 }, { ...valid, id: 1.5 }, { ...valid, collection: 'users' }, { ...valid, version: 2 }]) {
    assert.equal(pushDestination(data, site), null);
  }
});
