// Speed painting countdown: a small state machine driven by timestamps, so it
// stays exact even when the window is hidden. Shared by the renderer and tests.
(function (root) {
  'use strict';

  const WARN_BEFORE_MS = 60 * 1000;

  function createTimer({
    now = () => Date.now(),
    setInterval = root.setInterval.bind(root),
    clearInterval = root.clearInterval.bind(root),
    onChange = () => {},
    onWarn = () => {},
    onDone = () => {},
  } = {}) {
    const t = { status: 'idle', duration: 0, remaining: 0, endsAt: 0, warned: false };
    let handle = null;

    const emit = () => onChange(snapshot());
    const stopTicking = () => {
      if (handle !== null) clearInterval(handle);
      handle = null;
    };
    const startTicking = () => {
      stopTicking();
      handle = setInterval(tick, 250);
    };

    function snapshot() {
      const progress = t.duration ? 1 - t.remaining / t.duration : 0;
      return { status: t.status, duration: t.duration, remaining: t.remaining, progress };
    }

    function setDuration(ms) {
      if (t.status === 'running' || t.status === 'paused') return;
      t.duration = Math.max(1000, Math.round(ms));
      t.remaining = t.duration;
      t.status = 'idle';
      emit();
    }

    function start() {
      if (t.status === 'running' || !t.duration) return;
      if (t.status !== 'paused') {
        t.remaining = t.duration;
        // Only warn when there is a real "last minute" to announce.
        t.warned = t.duration <= 2 * WARN_BEFORE_MS;
      }
      t.endsAt = now() + t.remaining;
      t.status = 'running';
      startTicking();
      emit();
    }

    function pause() {
      if (t.status !== 'running') return;
      t.remaining = Math.max(0, t.endsAt - now());
      t.status = 'paused';
      stopTicking();
      emit();
    }

    function toggle() {
      if (t.status === 'running') pause();
      else start();
    }

    function reset() {
      stopTicking();
      t.status = 'idle';
      t.remaining = t.duration;
      emit();
    }

    function tick() {
      if (t.status !== 'running') return;
      t.remaining = Math.max(0, t.endsAt - now());
      if (!t.warned && t.remaining <= WARN_BEFORE_MS) {
        t.warned = true;
        onWarn(snapshot());
      }
      if (t.remaining === 0) {
        t.status = 'done';
        stopTicking();
        emit();
        onDone(snapshot());
        return;
      }
      emit();
    }

    return { setDuration, start, pause, toggle, reset, tick, snapshot };
  }

  // 90s -> "01:30", 3600s -> "1:00:00". Rounds up so "00:00" only shows at the end.
  function formatTime(ms) {
    const total = Math.ceil(Math.max(0, ms) / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  const api = { createTimer, formatTime, WARN_BEFORE_MS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Timer = api;
})(typeof window !== 'undefined' ? window : globalThis);
