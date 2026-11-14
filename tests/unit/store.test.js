import test from 'node:test';
import assert from 'node:assert/strict';

import { store } from '../../web/js/store.js';

test('store notifies only keyed subscribers and skips identical values', () => {
  const calls = [];
  const unsubscribe = store.subscribe('unit-test', (value) => calls.push(value));
  store.set('unit-test', 1);
  store.set('unit-test', 1);
  store.set('other', 2);
  assert.deepEqual(calls, [1]);
  unsubscribe();
});
