const test = require('node:test');
const assert = require('node:assert');
const { LINES, milestones, minutePassed, crossed, countdown } = require('../renderer/announcer');

const MIN = 60 * 1000;
const first = () => 0;

test('a 30 minute session gets its marks, time left first', () => {
  const list = milestones(30 * MIN, first);
  assert.deepStrictEqual(
    list.map((m) => m.at),
    [15, 10, 5, 2, 1].map((m) => m * MIN).concat(30 * 1000)
  );
  assert.strictEqual(list[0].text, `15 minutes remaining. ${LINES.pressure[0]}`);
  assert.strictEqual(list[4].text, `1 minute remaining. ${LINES.lastMinute[0]}`);
  assert.strictEqual(list[5].text, `30 seconds remaining. ${LINES.lastSeconds[0]}`);
  // Halfway would be 15 minutes: already a mark.
  assert.ok(!list.some((m) => m.kind === 'halfway'));
});

test('halfway only when no other mark is near, never right after the start', () => {
  assert.ok(milestones(45 * MIN, first).some((m) => m.kind === 'halfway' && m.at === 22.5 * MIN));
  assert.ok(!milestones(3 * MIN, first).some((m) => m.kind === 'halfway'));
  assert.deepStrictEqual(milestones(40 * 1000, first).map((m) => m.at), []);
  assert.deepStrictEqual(milestones(MIN, first).map((m) => m.at), [30 * 1000]);
  assert.strictEqual(milestones(2 * 60 * MIN, first)[0].text.split('.')[0], '1 hour remaining');
});

test('marks fire once, when the time left goes past them', () => {
  const list = milestones(10 * MIN, first);
  assert.deepStrictEqual(crossed(list, 5 * MIN + 100, 5 * MIN - 150).map((m) => m.at), [5 * MIN]);
  assert.deepStrictEqual(crossed(list, 5 * MIN - 150, 5 * MIN - 400), []);
  // A long jump (window asleep) catches up on every mark it skipped.
  assert.deepStrictEqual(crossed(list, 6 * MIN, 90 * 1000).map((m) => m.at), [5 * MIN, 2 * MIN]);
});

test('the countdown says each number on its second', () => {
  assert.deepStrictEqual(
    countdown(11500).map((c) => [c.text, c.delay]),
    [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => [String(n), 11500 - n * 1000])
  );
  // Resumed at 4.2 s: only 4 to 1 are left, "4" right away.
  assert.deepStrictEqual(countdown(4200).map((c) => [c.text, c.delay]), [['4', 200], ['3', 1200], ['2', 2200], ['1', 3200]]);
});

test('a tick on every whole minute left, not at the start nor the end', () => {
  assert.strictEqual(minutePassed(5 * MIN, 5 * MIN - 250), 0); // just started at 5:00
  assert.strictEqual(minutePassed(4 * MIN + 100, 4 * MIN - 150), 4);
  assert.strictEqual(minutePassed(4 * MIN - 150, 4 * MIN - 400), 0);
  assert.strictEqual(minutePassed(MIN + 50, MIN - 200), 1);
  assert.strictEqual(minutePassed(200, 0), 0);
});
