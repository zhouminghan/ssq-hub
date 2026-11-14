import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { URL } from 'node:url';

import {
  fmtIssue,
  issueSeq,
  issueYear,
  estimatePauseNote,
  nextDrawDate,
  nextIssue,
  pad2,
  structure,
} from '../../web/js/utils/format.js';

test('formats issue and ball numbers', () => {
  assert.equal(pad2(3), '03');
  assert.equal(issueYear('2026130'), '2026');
  assert.equal(issueSeq('2026130'), '130');
  assert.equal(fmtIssue('2026130'), '2026-130');
});

test('advances issues within a year and across a known year boundary', () => {
  const index = { years: [{ year: '2025', count: 151 }, { year: '2026', count: 130 }] };
  assert.equal(nextIssue('2025129', index), '2025130');
  assert.equal(nextIssue('2025151', index), '2026001');
});

test('uses the next Tuesday, Thursday, or Sunday draw', () => {
  assert.equal(nextDrawDate('2026-11-12'), '2026-11-15'); // Thursday -> Sunday
  assert.equal(nextDrawDate('2026-11-15'), '2026-11-17'); // Sunday -> Tuesday
  assert.equal(nextDrawDate('2026-11-16'), '2026-11-17'); // Monday -> Tuesday
  assert.equal(nextDrawDate('2026-12-31'), '2027-01-03');
  assert.equal(
    nextDrawDate('2026-02-12', [{ start: '2026-02-14', end: '2026-02-23' }]),
    '2026-02-24',
  );
});

test('cross-year next issue follows the next draw date year', () => {
  const index = { years: [{ year: '2026', count: 154 }] };
  assert.equal(nextIssue('2026154', index, '2027-01-03'), '2027001');
});

test('uses the provisional 2027 Spring Festival pause window', () => {
  const payload = JSON.parse(
    fs.readFileSync(
      new URL('../../web/config/lottery_pause_windows.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(nextDrawDate('2027-02-04', payload.windows), '2027-02-14');
  assert.equal(
    estimatePauseNote('2027-02-07', '2027-02-14', { loaded: true, windows: payload.windows }),
    '临时保护窗口',
  );
  assert.equal(estimatePauseNote('2027-02-07', '2027-02-14', { loaded: false }), '停售配置未校验');
});

test('calculates draw structure deterministically', () => {
  const result = structure([1, 2, 6, 16, 20, 28]);
  assert.deepEqual(
    {
      sum: result.sum,
      span: result.span,
      odd: result.odd,
      even: result.even,
      small: result.small,
      big: result.big,
      prime: result.prime,
      composite: result.composite,
      zone: result.zone,
    },
    {
      sum: 73,
      span: 27,
      odd: 1,
      even: 5,
      small: 4,
      big: 2,
      prime: 1,
      composite: 5,
      zone: '3:2:1',
    },
  );
  assert.equal(result.oddEvenShape, '奇偶偶偶偶偶');
});
