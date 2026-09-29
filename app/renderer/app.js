'use strict';

const G = window.Generator;
const $ = (id) => document.getElementById(id);

const HISTORY_MAX = 100;
const ICONS = {
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  remove: '<path d="M6 6l12 12M18 6 6 18"/>',
};
const LABELS = {
  caracteristique: 'trait',
  characteristic: 'trait',
  trophie: 'diet',
  adverbe: 'adverb',
  partie: 'body part',
  object: 'subject',
  object2: 'target',
};

const state = {
  themes: [],
  theme: null,
  parts: null,
  locked: new Set(),
  kept: false,
  selected: load('3ch.selected', []),
  history: load('3ch.history', []),
};

// Storage can be unavailable or corrupted: the app must still work.
function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function icon(name) {
  const span = document.createElement('span');
  span.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
  return span.firstChild;
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    // CSP forbids inline style attributes; CSSOM properties are allowed.
    else if (k === 'style') for (const [p, pv] of Object.entries(v)) node.style.setProperty(p, pv);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) node.append(c);
  return node;
}

let toastTimer;
function toast(message, isError = false) {
  const t = $('toast');
  t.textContent = message;
  t.classList.toggle('error', isError);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), isError ? 4000 : 1600);
}

const UNITS = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion'];
function formatCombos(n) {
  if (n < 1000000n) return Number(n).toLocaleString('en-US');
  const digits = n.toString().length;
  const group = Math.min(Math.floor((digits - 1) / 3), UNITS.length - 1);
  const value = Number(n) / 10 ** (group * 3);
  return `${value.toFixed(value < 10 ? 1 : 0)} ${UNITS[group]}`;
}

function labelFor(list) {
  if (state.theme.labels?.[list]) return state.theme.labels[list];
  return LABELS[list] ?? list.replace(/\d+$/, '').replace(/[_-]+/g, ' ');
}

// ---------- Themes ----------

function renderThemes() {
  const bar = $('themes');
  bar.replaceChildren(
    ...state.themes.map((t) =>
      el(
        'button',
        {
          class: 'theme-tab',
          role: 'tab',
          'aria-selected': String(t.id === state.theme?.id),
          onclick: () => selectTheme(t.id),
        },
        [t.name, t.origin === 'user' ? el('span', { class: 'badge', text: 'mine' }) : null]
      )
    )
  );
  if (state.theme) {
    $('combos').replaceChildren(
      el('strong', { text: formatCombos(G.combinations(state.theme)) }),
      ' possible subjects'
    );
  }
}

function selectTheme(id, { keepParts = false } = {}) {
  const theme = state.themes.find((t) => t.id === id) ?? state.themes[0];
  if (!theme) return;
  const changed = theme.id !== state.theme?.id;
  state.theme = theme;
  save('3ch.theme', theme.id);
  if (changed && !keepParts) {
    state.parts = null;
    state.locked.clear();
  }
  renderThemes();
  renderSubject();
}

function cycleTheme(step) {
  const i = state.themes.findIndex((t) => t.id === state.theme?.id);
  const next = state.themes[(i + step + state.themes.length) % state.themes.length];
  if (next) selectTheme(next.id);
}

async function refreshThemes(preferId) {
  const { themes, errors } = await window.ch3.listThemes();
  state.themes = themes;
  if (errors.length) toast(`Some themes could not be loaded: ${errors.join(' · ')}`, true);
  if (!themes.length) {
    $('subject').replaceChildren(el('span', { class: 'placeholder', text: 'No theme found.' }));
    return;
  }
  selectTheme(preferId ?? state.theme?.id ?? load('3ch.theme', null));
}

// ---------- Subject ----------

function current() {
  return state.parts ? G.render(state.parts) : null;
}

function wordSlots() {
  return state.parts ? state.parts.filter((p) => !p.literal).map((p) => p.index) : [];
}

function renderSubject(flashIndex = null) {
  const box = $('subject');
  const view = current();
  const hasSubject = Boolean(view);

  $('keepBtn').disabled = !hasSubject || state.kept;
  $('copyBtn').disabled = !hasSubject;
  $('unlockBtn').disabled = state.locked.size === 0;
  $('hint').style.visibility = hasSubject ? 'visible' : 'hidden';

  if (!view) {
    box.replaceChildren(el('span', { class: 'placeholder', text: 'Press Space to roll a subject' }));
    return;
  }

  const slots = wordSlots();
  const animate = flashIndex === null;
  box.replaceChildren(
    ...view.parts.map((p, i) => {
      const style = animate ? { '--i': String(i) } : { animation: 'none' };
      if (p.literal) return el('span', { class: 'literal', text: p.display, style });

      const n = slots.indexOf(p.index) + 1;
      const locked = state.locked.has(p.index);
      const lock = el('span', {
        class: 'lock',
        role: 'button',
        title: locked ? 'Unlock' : 'Lock this word',
        onclick: (e) => {
          e.stopPropagation();
          toggleLock(p.index);
        },
      });
      lock.append(icon(locked ? 'lock' : 'unlock'));

      const chip = el(
        'button',
        {
          class: `chip${locked ? ' locked' : ''}${p.display ? '' : ' empty'}${p.index === flashIndex ? ' flash' : ''}`,
          style,
          title: `${locked ? 'Locked' : 'Click to reroll'}${n <= 9 ? ` (${n})` : ''} · right-click to ${locked ? 'unlock' : 'lock'}`,
          onclick: () => rerollWord(p.index),
          oncontextmenu: (e) => {
            e.preventDefault();
            toggleLock(p.index);
          },
        },
        [
          el('span', { class: 'word', text: p.display || '—' }),
          el('span', { class: 'label', text: labelFor(p.list) }),
          lock,
        ]
      );
      return chip;
    })
  );
}

function logHistory() {
  const view = current();
  state.history.unshift({
    id: crypto.randomUUID(),
    themeId: state.theme.id,
    themeName: state.theme.name,
    raws: state.parts.map((p) => p.raw),
    sentence: view.sentence,
    t: Date.now(),
  });
  state.history.length = Math.min(state.history.length, HISTORY_MAX);
  save('3ch.history', state.history);
  renderHistory();
}

function generate() {
  if (!state.theme) return;
  state.parts = G.roll(state.theme, state.parts, state.locked);
  state.kept = false;
  renderSubject();
  logHistory();
}

function rerollWord(index) {
  if (!state.parts || state.locked.has(index)) return;
  state.parts = G.rerollSlot(state.theme, state.parts, index);
  state.kept = false;
  renderSubject(index);
  logHistory();
}

function toggleLock(index) {
  if (state.locked.has(index)) state.locked.delete(index);
  else state.locked.add(index);
  renderSubject(-1);
}

function unlockAll() {
  state.locked.clear();
  renderSubject(-1);
}

function keep() {
  const view = current();
  if (!view || state.kept) return;
  state.selected.unshift({ id: crypto.randomUUID(), sentence: view.sentence, themeName: state.theme.name, t: Date.now() });
  state.kept = true;
  save('3ch.selected', state.selected);
  renderSelected();
  renderSubject(-1);
  toast('Kept');
}

async function copy(textToCopy, message = 'Copied to clipboard') {
  await window.ch3.copy(textToCopy);
  toast(message);
}

function restore(entry) {
  const theme = state.themes.find((t) => t.id === entry.themeId);
  if (!theme) return toast(`Theme "${entry.themeName}" is not available any more`, true);
  const slots = G.slotsOf(theme);
  if (slots.length !== entry.raws.length) return toast('This theme has changed since that roll', true);
  selectTheme(theme.id, { keepParts: true });
  state.locked.clear();
  state.parts = slots.map((s, i) => ({ ...s, raw: entry.raws[i] }));
  state.kept = state.selected.some((s) => s.sentence === entry.sentence);
  renderSubject();
}

// ---------- Lists ----------

function timeLabel(t) {
  const d = new Date(t);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function rowButton(name, title, onclick) {
  const b = el('button', { class: `row-btn ${name}`, title, 'aria-label': title, onclick });
  b.append(icon(name));
  return b;
}

function renderSelected() {
  const list = $('selectedList');
  list.replaceChildren(
    ...state.selected.map((s) =>
      el('li', {}, [
        el('span', { class: 'text', text: s.sentence }),
        el('span', { class: 'tag', text: s.themeName }),
        rowButton('copy', 'Copy', () => copy(s.sentence)),
        rowButton('remove', 'Remove', () => {
          state.selected = state.selected.filter((x) => x.id !== s.id);
          save('3ch.selected', state.selected);
          renderSelected();
        }),
      ])
    )
  );
  $('selectedCount').textContent = state.selected.length;
  $('selectedEmpty').hidden = state.selected.length > 0;
  $('copyAllBtn').disabled = $('exportBtn').disabled = $('clearSelectedBtn').disabled = !state.selected.length;
}

function renderHistory() {
  const list = $('historyList');
  list.replaceChildren(
    ...state.history.map((h) =>
      el('li', {}, [
        el('button', { class: 'restore', title: 'Bring this subject back', onclick: () => restore(h) }, [
          el('span', { class: 'text', text: h.sentence }),
          el('span', { class: 'tag', text: h.themeName }),
          el('span', { class: 'meta', text: timeLabel(h.t) }),
        ]),
        rowButton('copy', 'Copy', () => copy(h.sentence)),
      ])
    )
  );
  $('historyCount').textContent = state.history.length;
  $('historyEmpty').hidden = state.history.length > 0;
  $('clearHistoryBtn').disabled = !state.history.length;
}

function selectedAsText() {
  return state.selected.map((s) => `- ${s.sentence}`).join('\n') + '\n';
}

// ---------- Wiring ----------

$('generateBtn').addEventListener('click', generate);
$('keepBtn').addEventListener('click', keep);
$('copyBtn').addEventListener('click', () => current() && copy(current().sentence));
$('unlockBtn').addEventListener('click', unlockAll);
$('copyAllBtn').addEventListener('click', () => copy(selectedAsText(), `Copied ${state.selected.length} subjects`));
$('exportBtn').addEventListener('click', async () => {
  const stamp = new Date().toISOString().slice(0, 10);
  const file = await window.ch3.exportText(selectedAsText(), `3ch-subjects-${stamp}.txt`);
  if (file) toast('Exported');
});
$('clearSelectedBtn').addEventListener('click', () => {
  if (!confirm(`Remove all ${state.selected.length} selected subjects?`)) return;
  state.selected = [];
  save('3ch.selected', state.selected);
  renderSelected();
  state.kept = false;
  renderSubject(-1);
});
$('clearHistoryBtn').addEventListener('click', () => {
  state.history = [];
  save('3ch.history', state.history);
  renderHistory();
});
$('importBtn').addEventListener('click', async () => {
  const { imported, errors } = await window.ch3.importLegacy();
  if (errors.length) toast(errors.join(' · '), true);
  if (imported.length) {
    await refreshThemes(imported[0]);
    toast(`Imported ${imported.length} theme${imported.length > 1 ? 's' : ''}`);
  }
});
$('folderBtn').addEventListener('click', () => window.ch3.openThemesFolder());

// ---------- Speed painting timer ----------

const PRESETS = [5, 10, 15, 20, 30, 45, 60];
const timerUi = {
  minutes: clampMinutes(load('3ch.timer.minutes', 30)),
  sound: load('3ch.timer.sound', true),
  mini: false,
  lastTaskbar: null,
};

function clampMinutes(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(240, Math.max(1, n)) : 30;
}

// Alerts are synthesised with Web Audio: no sound files to ship.
let audioCtx = null;
function audio() {
  audioCtx ??= new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function tone(freq, at, length, volume) {
  const ctx = audio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + at;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + length + 0.05);
}
function playWarning() {
  if (!timerUi.sound) return;
  tone(660, 0, 0.35, 0.12);
  tone(660, 0.45, 0.35, 0.12);
}
function playChime() {
  if (!timerUi.sound) return;
  [0, 1.1].forEach((offset) => {
    tone(784, offset, 0.9, 0.2);
    tone(988, offset + 0.18, 0.9, 0.2);
    tone(1319, offset + 0.36, 1.3, 0.2);
  });
}

const timer = Timer.createTimer({
  onChange: renderTimer,
  onWarn: () => {
    playWarning();
    toast('1 minute left');
  },
  onDone: () => {
    playChime();
    toast("Time's up! Put the brush down.");
    window.ch3.timerDone(current()?.sentence ?? '');
  },
});

function renderPresets() {
  const box = $('timerPresets');
  const custom = box.querySelector('.timer-custom');
  box.querySelectorAll('.preset').forEach((b) => b.remove());
  for (const m of PRESETS) {
    box.insertBefore(
      el('button', { class: 'preset', 'data-minutes': String(m), title: `${m} minutes`, onclick: () => setMinutes(m) }, [
        String(m),
      ]),
      custom
    );
  }
}

function setMinutes(m) {
  timerUi.minutes = clampMinutes(m);
  save('3ch.timer.minutes', timerUi.minutes);
  timer.setDuration(timerUi.minutes * 60 * 1000);
}

function renderTimer(snap = timer.snapshot()) {
  const box = $('timer');
  const busy = snap.status === 'running' || snap.status === 'paused';
  const clock = Timer.formatTime(snap.remaining);
  box.dataset.status = snap.status;
  box.classList.toggle('ending', busy && snap.remaining <= Timer.WARN_BEFORE_MS);
  $('timerClock').textContent = clock;
  $('timerBar').style.setProperty('--p', String(snap.progress));
  $('timerStartLabel').textContent = { idle: 'Start', running: 'Pause', paused: 'Resume', done: 'Restart' }[snap.status];
  $('timerResetBtn').disabled = snap.status === 'idle';

  const input = $('timerMinutes');
  if (document.activeElement !== input) input.value = String(timerUi.minutes);
  input.disabled = busy;
  document.querySelectorAll('.preset').forEach((b) => {
    b.disabled = busy;
    b.setAttribute('aria-pressed', String(Number(b.dataset.minutes) === timerUi.minutes));
  });

  document.title = {
    idle: '3CH',
    running: `${clock} · 3CH`,
    paused: `❚❚ ${clock} · 3CH`,
    done: "Time's up · 3CH",
  }[snap.status];

  // Taskbar progress: only talk to the main process when something visible changes.
  const taskbar = busy ? `${snap.status}:${snap.progress.toFixed(3)}` : 'off';
  if (taskbar !== timerUi.lastTaskbar) {
    timerUi.lastTaskbar = taskbar;
    if (busy) window.ch3.timerProgress(Math.max(snap.progress, 0.01), snap.status);
    else if (snap.status === 'idle') window.ch3.timerProgress(-1);
  }
}

function toggleTimer() {
  if (timerUi.sound) audio(); // unlock audio on this user gesture
  timer.toggle();
}

function renderSound() {
  $('soundBtn').setAttribute('aria-pressed', String(timerUi.sound));
}

async function setMini(on) {
  timerUi.mini = await window.ch3.setMini(on);
  document.body.classList.toggle('mini', timerUi.mini);
  $('miniLabel').textContent = timerUi.mini ? 'Exit mini' : 'Mini';
}

$('timerStartBtn').addEventListener('click', toggleTimer);
$('timerResetBtn').addEventListener('click', () => timer.reset());
$('timerMinutes').addEventListener('change', (e) => setMinutes(e.target.value));
$('timerMinutes').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === 'Escape') e.target.blur();
});
$('soundBtn').addEventListener('click', () => {
  timerUi.sound = !timerUi.sound;
  save('3ch.timer.sound', timerUi.sound);
  renderSound();
  if (timerUi.sound) tone(988, 0, 0.25, 0.12);
});
$('miniBtn').addEventListener('click', () => setMini(!timerUi.mini));

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  if (e.target instanceof HTMLInputElement) return; // typing minutes, not shortcuts
  const onButton = e.target instanceof HTMLButtonElement;
  if (e.key === 't' || e.key === 'T') {
    toggleTimer();
  } else if (e.key === 'r' || e.key === 'R') {
    timer.reset();
  } else if (e.key === 'm' || e.key === 'M') {
    setMini(!timerUi.mini);
  } else if (e.key === 'Escape' && timerUi.mini) {
    setMini(false);
  } else if (e.code === 'Space') {
    e.preventDefault();
    generate();
  } else if (e.key === 'Enter' && !onButton) {
    e.preventDefault();
    keep();
  } else if (e.key === 'c' || e.key === 'C') {
    if (current()) copy(current().sentence);
  } else if (e.key === 'u' || e.key === 'U') {
    unlockAll();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    cycleTheme(e.key === 'ArrowLeft' ? -1 : 1);
  } else if (/^Digit[1-9]$/.test(e.code)) {
    const index = wordSlots()[Number(e.code.slice(5)) - 1];
    if (index === undefined) return;
    if (e.shiftKey) toggleLock(index);
    else rerollWord(index);
  }
});

// Space already generated on keydown: stop it from also clicking a focused button.
document.addEventListener('keyup', (e) => {
  if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) e.preventDefault();
});

renderSelected();
renderHistory();
renderPresets();
renderSound();
setMinutes(timerUi.minutes);
refreshThemes();
