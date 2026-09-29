const test = require('node:test');
const assert = require('node:assert');
const { createTimer, formatTime } = require('../renderer/timer');

function fakeClock() {
  let time = 0;
  return {
    now: () => time,
    advance: (ms) => (time += ms),
    setInterval: () => 1,
    clearInterval: () => {},
  };
}

const MIN = 60 * 1000;

test('counts down, pauses without losing time, then finishes', () => {
  const clock = fakeClock();
  const events = [];
  const timer = createTimer({ ...clock, onWarn: () => events.push('warn'), onDone: () => events.push('done') });
  timer.setDuration(5 * MIN);
  timer.start();

  clock.advance(2 * MIN);
  timer.tick();
  assert.strictEqual(timer.snapshot().remaining, 3 * MIN);

  timer.pause();
  clock.advance(10 * MIN); // paused time does not count
  timer.tick();
  assert.strictEqual(timer.snapshot().remaining, 3 * MIN);
  assert.strictEqual(timer.snapshot().status, 'paused');

  timer.start();
  clock.advance(2 * MIN + 1);
  timer.tick();
  assert.deepStrictEqual(events, ['warn']);

  clock.advance(MIN);
  timer.tick();
  assert.deepStrictEqual(events, ['warn', 'done']);
  const end = timer.snapshot();
  assert.strictEqual(end.status, 'done');
  assert.strictEqual(end.remaining, 0);
  assert.strictEqual(end.progress, 1);
});

test('short sessions skip the last-minute warning', () => {
  const clock = fakeClock();
  let warned = false;
  const timer = createTimer({ ...clock, onWarn: () => (warned = true) });
  timer.setDuration(2 * MIN);
  timer.start();
  clock.advance(90 * 1000);
  timer.tick();
  assert.strictEqual(warned, false);
});

test('duration is locked while a session is in progress', () => {
  const clock = fakeClock();
  const timer = createTimer(clock);
  timer.setDuration(10 * MIN);
  timer.start();
  timer.setDuration(1 * MIN);
  assert.strictEqual(timer.snapshot().duration, 10 * MIN);
  timer.reset();
  timer.setDuration(1 * MIN);
  assert.strictEqual(timer.snapshot().duration, 1 * MIN);
  assert.strictEqual(timer.snapshot().status, 'idle');
});

test('formats minutes and hours', () => {
  assert.strictEqual(formatTime(90 * 1000), '01:30');
  assert.strictEqual(formatTime(59 * MIN + 59 * 1000), '59:59');
  assert.strictEqual(formatTime(60 * MIN), '1:00:00');
  assert.strictEqual(formatTime(1), '00:01');
  assert.strictEqual(formatTime(0), '00:00');
});
