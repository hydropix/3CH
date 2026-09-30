// Timer announcer: what the robot says during a speed painting session, and
// when. A passive-aggressive facility AI running a painting experiment.
// Pure logic, shared by the renderer and the Node tests.
(function (root) {
  'use strict';

  const MIN = 60 * 1000;
  const COUNTDOWN_FROM = 10;

  const LINES = {
    start: [
      'Painting session initiated. Your progress will be monitored. And graded. Harshly.',
      'Timer engaged. Please begin painting. The facility is watching.',
      'Creative test sequence activated. Failure is statistically likely. Begin.',
      'Session started. Every brushstroke is being recorded, for science.',
      'Welcome to the painting chamber. The door has been locked for your convenience.',
      'Test subject detected. Canvas detected. Talent: still scanning.',
    ],
    resume: [
      'Session resumed. The break has been noted in your file.',
      'Welcome back. Time did not wait for you. Neither will I.',
      'Resuming test. Your absence lowered the average quality of this room.',
      'Painting resumed. Please try to look busy.',
    ],
    pause: [
      'Session paused. The clock is patient. I am not.',
      'Pause acknowledged. Your brush is getting cold.',
      'Test suspended. I will use this time to reconsider your potential.',
      'Paused. Do not touch the canvas. Do not touch anything.',
    ],
    halfway: [
      'Halfway point reached. Your painting is fifty percent complete. Probably less.',
      'Half of your time is gone. The other half is already leaving.',
      'Midpoint analysis complete. Recommendation: stop admiring your sketch.',
      'You are halfway there. That is not encouragement. It is a measurement.',
    ],
    pressure: [
      'Please paint faster. This is not a suggestion.',
      'Your canvas looks promising. That was sarcasm.',
      'Increasing brush speed is strongly recommended.',
      'Reminder: details are optional. Deadlines are not.',
      'Do not panic. Panicking wastes valuable painting time.',
      'Your painting has been analyzed. Result: incomplete.',
      'A finished sketch beats a perfect nothing.',
      'The previous test subject finished early. The previous test subject was a toaster.',
      'Stop zooming in. The problem is not the pixels.',
      'Your color choices have been forwarded to the ethics committee.',
    ],
    lastMinute: [
      'Begin final adjustments. Or begin crying. Both are acceptable.',
      'Stop blending. Start finishing.',
      'This is your one minute warning. There will be no other warning. Except the next one.',
      'Final minute. Please remain calm while your deadline approaches at full speed.',
    ],
    lastSeconds: [
      'Put down the eraser. Slowly.',
      'Last strokes. Make them count.',
      'Emergency finishing protocol engaged.',
      'Signature now. Details never.',
    ],
    done: [
      'Time is up. Brushes down. Step away from the canvas.',
      'Session complete. Your painting has been saved in my memory. Forever.',
      'Time is up. Congratulations. You are finished, whether you are finished or not.',
      'Test complete. The results are art. Probably.',
      'Painting session terminated. Please collect your dignity on the way out.',
    ],
  };

  function pickLine(kind, rand = Math.random) {
    const pool = LINES[kind];
    return pool[Math.floor(rand() * pool.length)];
  }

  function timeLeft(at) {
    if (at >= 60 * MIN) {
      const h = at / (60 * MIN);
      return `${h} hour${h > 1 ? 's' : ''} remaining.`;
    }
    const m = at / MIN;
    if (m >= 1) return `${m} minute${m > 1 ? 's' : ''} remaining.`;
    return `${at / 1000} seconds remaining.`;
  }

  // The moments of a session that get a line, as time left in ms. Marks too
  // close to the start (under 20 s in) are dropped, and the halfway line only
  // comes when no other mark is near it.
  function milestones(duration, rand = Math.random) {
    const marks = [180, 120, 60, 30, 15, 10, 5, 2, 1].map((m) => m * MIN).concat(30 * 1000);
    const fits = (at) => duration - at >= 20 * 1000;
    const list = marks.filter(fits).map((at) => {
      const kind = at === MIN ? 'lastMinute' : at < MIN ? 'lastSeconds' : 'pressure';
      return { at, kind, text: `${timeLeft(at)} ${pickLine(kind, rand)}` };
    });
    const half = Math.round(duration / 2 / 1000) * 1000;
    if (duration >= 4 * MIN && list.every((m) => Math.abs(m.at - half) > 45 * 1000)) {
      list.push({ at: half, kind: 'halfway', text: pickLine('halfway', rand) });
    }
    return list.sort((a, b) => b.at - a.at);
  }

  // The whole minute of time left passed between two readings (5 for 5:00),
  // or 0 when none was. The start itself is not a minute passed.
  function minutePassed(before, after) {
    const m = Math.ceil(after / MIN);
    return m > 0 && Math.ceil(before / MIN) > m ? m : 0;
  }

  // Milestones passed between two readings of the time left.
  function crossed(list, before, after) {
    return list.filter((m) => m.at < before && m.at >= after);
  }

  // The countdown numbers still to say with `remaining` ms left, and in how
  // many ms each one is due: "10" at 10 s left... "1" at 1 s left.
  function countdown(remaining) {
    const out = [];
    for (let n = COUNTDOWN_FROM; n >= 1; n--) {
      const delay = remaining - n * 1000;
      if (delay >= -150) out.push({ n, text: String(n), delay: Math.max(0, delay) });
    }
    return out;
  }

  const api = { LINES, COUNTDOWN_FROM, pickLine, milestones, minutePassed, crossed, countdown };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Announcer = api;
})(typeof window !== 'undefined' ? window : globalThis);
