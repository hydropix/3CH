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
// Captions for the list names of the legacy themes (I18n keys).
const LABELS = {
  caracteristique: 'labelTrait',
  characteristic: 'labelTrait',
  trophie: 'labelDiet',
  adverbe: 'labelAdverb',
  partie: 'labelBodyPart',
  object: 'labelSubject',
  object2: 'labelTarget',
};

const state = {
  // The language picks the interface strings, the themes shown and the voice.
  lang: 'en',
  themes: [],
  theme: null,
  // The last theme used in each language: { en: 'chimera', fr: 'chimera-fr' }.
  lastTheme: load('3ch.themeByLang', {}),
  parts: null,
  locked: new Set(),
  // Themes with several structures: the one in use, and whether it is kept.
  structure: null,
  structureLocked: false,
  kept: false,
  selected: load('3ch.selected', []),
  history: load('3ch.history', []),
  // Recent words and structures per theme id, so that they come back rarely.
  memory: load('3ch.memory', {}),
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

// The interface string `key` in the language in use.
const tr = (key, vars) => I18n.t(state.lang, key, vars);

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

function labelFor(list) {
  if (state.theme.labels?.[list]) return state.theme.labels[list];
  return LABELS[list] ? tr(LABELS[list]) : list.replace(/\d+$/, '').replace(/[_-]+/g, ' ');
}

// ---------- Languages ----------

const langOf = (theme) => theme?.lang ?? 'en';
const themesIn = (lang = state.lang) => state.themes.filter((t) => langOf(t) === lang);

// The languages that have at least one theme, in the order of I18n.LANGUAGES.
function languages() {
  const order = I18n.LANGUAGES.map((l) => l.code);
  const rank = (code) => (order.includes(code) ? order.indexOf(code) : order.length);
  return [...new Set(state.themes.map(langOf))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

// "chimera-fr" is "chimera" in French: same base id, other language.
function baseId(theme) {
  const suffix = `-${langOf(theme)}`;
  return langOf(theme) !== 'en' && theme.id.endsWith(suffix) ? theme.id.slice(0, -suffix.length) : theme.id;
}
function counterpart(theme, lang) {
  return theme ? themesIn(lang).find((t) => baseId(t) === baseId(theme)) : undefined;
}

function renderLangs() {
  const codes = languages();
  if (!codes.includes(state.lang)) codes.unshift(state.lang);
  $('langSelect').replaceChildren(
    ...codes.map((code) => el('option', { value: code, lang: code, text: I18n.languageName(code) }))
  );
  $('langSelect').value = state.lang;
}

// Every string of the interface: the data-i18n attributes of the page, then
// what app.js writes itself.
function applyLang() {
  document.documentElement.lang = state.lang;
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = tr(node.dataset.i18n);
  for (const attr of ['title', 'aria-label', 'placeholder']) {
    for (const node of document.querySelectorAll(`[data-i18n-${attr}]`)) {
      node.setAttribute(attr, tr(node.getAttribute(`data-i18n-${attr}`)));
    }
  }
  window.ch3.setLang(state.lang);
  renderLangs();
  renderSelected();
  renderHistory();
  renderPresets();
  renderTimer();
  renderMini();
}

// Takes `preferId` when it is in that language, else the same theme in that
// language, else the last one used in it, else its first theme.
function setLang(lang, preferId) {
  const changed = lang !== state.lang;
  state.lang = lang;
  applyLang();
  const list = themesIn(lang);
  const ids = [preferId, counterpart(state.theme, lang)?.id, state.lastTheme[lang]];
  selectTheme(ids.find((id) => list.some((t) => t.id === id)) ?? list[0]?.id);
  if (!changed) return;
  if (voice.auto || timerUi.sound) window.ch3.speechWarmUp(lang);
  // A session under way gets its lines again, in the new language.
  const snap = timer.snapshot();
  if (snap.status === 'running' || snap.status === 'paused') planSession(snap.duration);
}

// A language the user picked (the menu, a history entry): kept for next time.
function chooseLang(lang, preferId) {
  save('3ch.lang', lang);
  setLang(lang, preferId);
}

// ---------- Themes ----------

function renderThemes() {
  const bar = $('themes');
  bar.replaceChildren(
    ...themesIn().map((t) =>
      el(
        'button',
        {
          class: 'theme-tab',
          role: 'tab',
          'aria-selected': String(t.id === state.theme?.id),
          onclick: () => selectTheme(t.id),
        },
        [t.name, t.origin === 'user' ? el('span', { class: 'badge', text: tr('mine') }) : null]
      )
    )
  );
  if (state.theme) {
    const shapes = state.theme.structures?.length;
    const count = G.combinations(state.theme);
    $('combos').replaceChildren(
      el('strong', { text: I18n.formatCombos(count, state.lang) }),
      ` ${tr('possibleSubjects', { count: Number(count) })}`,
      shapes ? ` · ${tr('sentenceShapes', { count: shapes })}` : ''
    );
  }
}

// Only the themes of the language in use can be selected.
function selectTheme(id, { keepParts = false } = {}) {
  const list = themesIn();
  const theme = list.find((t) => t.id === id) ?? list[0];
  if (!theme) return;
  const changed = theme.id !== state.theme?.id;
  state.theme = theme;
  state.lastTheme[state.lang] = theme.id;
  save('3ch.theme', theme.id);
  save('3ch.themeByLang', state.lastTheme);
  if (changed && !keepParts) {
    state.parts = null;
    state.locked.clear();
    state.structure = null;
    state.structureLocked = false;
  }
  renderThemes();
  renderSubject();
}

function cycleTheme(step) {
  const list = themesIn();
  const i = list.findIndex((t) => t.id === state.theme?.id);
  const next = list[(i + step + list.length) % list.length];
  if (next) selectTheme(next.id);
}

async function refreshThemes(preferId) {
  const { themes, errors } = await window.ch3.listThemes();
  state.themes = themes;
  if (errors.length) toast(tr('themesNotLoaded', { errors: errors.join(' · ') }), true);
  if (!themes.length) {
    renderLangs();
    $('subject').replaceChildren(el('span', { class: 'placeholder', text: tr('noTheme') }));
    return;
  }
  // A theme just imported shows in its own language. Otherwise: the language
  // in use, the one picked last time, the OS one, English.
  const prefer = themes.find((t) => t.id === preferId);
  const lang = prefer
    ? langOf(prefer)
    : I18n.pickLanguage(languages(), [state.theme ? state.lang : null, load('3ch.lang', null), ...navigator.languages]);
  setLang(lang, preferId ?? state.theme?.id ?? state.lastTheme[lang] ?? load('3ch.theme', null));
}

// ---------- Subject ----------

const isMulti = () => Boolean(state.theme?.structures);

// The theme seen through the structure in use (the theme itself for classic ones).
function shaped() {
  return G.shape(state.theme, state.structure ?? 0);
}

function current() {
  return state.parts ? G.render(G.inflect(state.theme, state.parts), langOf(state.theme)) : null;
}

function wordSlots() {
  return state.parts ? state.parts.filter((p) => !p.literal).map((p) => p.index) : [];
}

function renderSubject(flashIndex = null) {
  const box = $('subject');
  const view = current();
  const hasSubject = Boolean(view);
  sentenceChanged(view?.sentence ?? null);

  $('keepBtn').disabled = !hasSubject || state.kept;
  $('copyBtn').disabled = !hasSubject;
  $('speakBtn').disabled = !hasSubject;
  $('unlockBtn').disabled = state.locked.size === 0 && !state.structureLocked;
  $('reshapeBtn').hidden = $('shapeLockBtn').hidden = !isMulti();
  $('reshapeBtn').disabled = $('shapeLockBtn').disabled = !hasSubject;
  $('shapeLockBtn').setAttribute('aria-pressed', String(state.structureLocked));
  $('hint').textContent = tr(isMulti() ? 'hintMulti' : 'hint');
  $('hint').style.visibility = hasSubject ? 'visible' : 'hidden';

  if (!view) {
    box.replaceChildren(el('span', { class: 'placeholder', text: tr('placeholder') }));
    return;
  }

  const slots = wordSlots();
  const animate = flashIndex === null;
  box.replaceChildren(
    ...view.parts.map((p, i) => {
      const style = animate ? { '--i': String(i) } : { animation: 'none' };
      // `elided`: a French "l'" or "d'" that the next word sticks to.
      const elided = p.elided ? ' elided' : '';
      if (p.literal) return el('span', { class: `literal${p.glue ? ' glue' : ''}${elided}`, text: p.display, style });

      const n = slots.indexOf(p.index) + 1;
      const locked = state.locked.has(p.index);
      const lock = el('span', {
        class: 'lock',
        role: 'button',
        title: tr(locked ? 'unlockWord' : 'lockWord'),
        onclick: (e) => {
          e.stopPropagation();
          toggleLock(p.index);
        },
      });
      lock.append(icon(locked ? 'lock' : 'unlock'));

      const chip = el(
        'button',
        {
          class: `chip${locked ? ' locked' : ''}${p.display ? '' : ' empty'}${p.index === flashIndex ? ' flash' : ''}${elided}`,
          style,
          title: tr('chipTitle', { locked, n: n <= 9 ? n : 0 }),
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
  fitSubject();
}

// Shrinks the words (down to --fit-min) so the subject stays on one line when
// that is enough. Longer subjects wrap at full size instead.
function fitSubject() {
  const box = $('subject');
  const first = box.firstElementChild;
  const last = box.lastElementChild;
  box.style.setProperty('--fit', '1');
  box.classList.remove('one-line');
  if (!first || first.classList.contains('placeholder')) return;

  box.classList.add('one-line');
  const min = parseFloat(getComputedStyle(box).getPropertyValue('--fit-min')) || 1;
  const width = () => last.getBoundingClientRect().right - first.getBoundingClientRect().left;
  let fit = 1;
  // Labels and paddings do not scale with the font, so this takes a few steps.
  for (let i = 0; i < 6 && fit > min && width() > box.clientWidth; i++) {
    fit = Math.max(min, fit * (box.clientWidth / width()) - 0.005);
    box.style.setProperty('--fit', fit.toFixed(3));
  }
  if (width() > box.clientWidth) {
    box.classList.remove('one-line');
    box.style.setProperty('--fit', '1');
  }
}

window.addEventListener('resize', fitSubject);
document.fonts.ready.then(fitSubject);

function logHistory() {
  const view = current();
  state.history.unshift({
    id: crypto.randomUUID(),
    themeId: state.theme.id,
    themeName: state.theme.name,
    raws: state.parts.map((p) => p.raw),
    structure: isMulti() ? state.theme.structures[state.structure] : undefined,
    sentence: view.sentence,
    t: Date.now(),
  });
  state.history.length = Math.min(state.history.length, HISTORY_MAX);
  save('3ch.history', state.history);
  renderHistory();
}

// The draws remembered for the theme in use, saved after every roll.
function memory() {
  if (!state.memory || typeof state.memory !== 'object' || Array.isArray(state.memory)) state.memory = {};
  const m = state.memory[state.theme.id];
  if (!m || typeof m !== 'object') state.memory[state.theme.id] = G.createMemory();
  return state.memory[state.theme.id];
}

function applyShape({ structure, parts, locked }) {
  state.structure = structure;
  state.parts = parts;
  state.locked = locked;
}

// Themes with several structures change shape on every roll, unless the
// shape is locked. Locked words follow into the new shape.
function generate() {
  if (!state.theme) return;
  if (isMulti() && !state.structureLocked) {
    applyShape(G.reshape(state.theme, state.parts, state.locked, { current: state.structure, memory: memory() }));
  } else {
    state.parts = G.roll(shaped(), state.parts, state.locked, undefined, memory());
  }
  save('3ch.memory', state.memory);
  state.kept = false;
  renderSubject();
  logHistory();
}

// A new shape that keeps every word it has room for.
function reshape() {
  if (!isMulti() || !state.parts) return;
  state.structureLocked = false;
  applyShape(G.reshape(state.theme, state.parts, state.locked, { current: state.structure, keepAll: true, memory: memory() }));
  save('3ch.memory', state.memory);
  state.kept = false;
  renderSubject();
  logHistory();
}

function toggleShapeLock() {
  if (!isMulti() || !state.parts) return;
  state.structureLocked = !state.structureLocked;
  renderSubject(-1);
}

function rerollWord(index) {
  if (!state.parts || state.locked.has(index)) return;
  state.parts = G.rerollSlot(shaped(), state.parts, index, undefined, memory());
  save('3ch.memory', state.memory);
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
  state.structureLocked = false;
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
  toast(tr('kept'));
}

async function copy(textToCopy, message = tr('copied')) {
  await window.ch3.copy(textToCopy);
  toast(message);
}

function restore(entry) {
  const theme = state.themes.find((t) => t.id === entry.themeId);
  if (!theme) return toast(tr('themeGone', { name: entry.themeName }), true);
  const structure = theme.structures ? theme.structures.indexOf(entry.structure) : null;
  const slots = structure === -1 ? [] : G.slotsOf(G.shape(theme, structure ?? 0));
  if (slots.length !== entry.raws.length) return toast(tr('themeChanged'), true);
  if (langOf(theme) !== state.lang) chooseLang(langOf(theme), theme.id);
  selectTheme(theme.id, { keepParts: true });
  state.locked.clear();
  state.structure = structure;
  state.structureLocked = false;
  state.parts = slots.map((s, i) => ({ ...s, raw: entry.raws[i] }));
  state.kept = state.selected.some((s) => s.sentence === entry.sentence);
  renderSubject();
}

// ---------- Lists ----------

function timeLabel(t) {
  const d = new Date(t);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString(state.lang, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(state.lang, { day: 'numeric', month: 'short' });
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
        rowButton('copy', tr('copy'), () => copy(s.sentence)),
        rowButton('remove', tr('remove'), () => {
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
        el('button', { class: 'restore', title: tr('bringBack'), onclick: () => restore(h) }, [
          el('span', { class: 'text', text: h.sentence }),
          el('span', { class: 'tag', text: h.themeName }),
          el('span', { class: 'meta', text: timeLabel(h.t) }),
        ]),
        rowButton('copy', tr('copy'), () => copy(h.sentence)),
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
$('reshapeBtn').addEventListener('click', reshape);
$('shapeLockBtn').addEventListener('click', toggleShapeLock);
$('copyAllBtn').addEventListener('click', () => copy(selectedAsText(), tr('copiedAll', { count: state.selected.length })));
$('exportBtn').addEventListener('click', async () => {
  const stamp = new Date().toISOString().slice(0, 10);
  const file = await window.ch3.exportText(selectedAsText(), tr('exportName', { date: stamp }));
  if (file) toast(tr('exported'));
});
$('clearSelectedBtn').addEventListener('click', () => {
  if (!confirm(tr('clearSelectedConfirm', { count: state.selected.length }))) return;
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
  let result;
  try {
    result = await window.ch3.importLegacy();
  } catch (err) {
    return toast(tr('importFailed', { error: err.message }), true);
  }
  const { imported, errors } = result;
  if (imported.length) await refreshThemes(imported[0]);
  // One toast: a success message would otherwise hide the errors.
  const done = imported.length ? tr('imported', { count: imported.length }) : '';
  if (errors.length) toast([done, ...errors].filter(Boolean).join(' · '), true);
  else if (done) toast(done);
});
$('folderBtn').addEventListener('click', () => window.ch3.openThemesFolder());
$('langSelect').addEventListener('change', (e) => {
  chooseLang(e.target.value);
  e.target.blur(); // Space, the arrows and the letters are shortcuts again
});

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
// A very soft tick on every whole minute left.
function playMinute() {
  if (!timerUi.sound) return;
  tone(1320, 0, 0.18, 0.03);
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
    toast(tr('oneMinuteLeft'));
  },
  onDone: () => {
    playChime();
    toast(tr('timesUpToast'));
    window.ch3.timerDone(current()?.sentence ?? '');
  },
});

function renderPresets() {
  const box = $('timerPresets');
  const custom = box.querySelector('.timer-custom');
  box.querySelectorAll('.preset').forEach((b) => b.remove());
  for (const m of PRESETS) {
    box.insertBefore(
      el('button', { class: 'preset', 'data-minutes': String(m), title: tr('presetTitle', { n: m }), onclick: () => setMinutes(m) }, [
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
  $('timerStartLabel').textContent = tr(
    { idle: 'timerStart', running: 'timerPause', paused: 'timerResume', done: 'timerRestart' }[snap.status]
  );
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
    done: `${tr('timesUp')} · 3CH`,
  }[snap.status];

  // Taskbar progress: only talk to the main process when something visible changes.
  timerTalk(snap);

  const taskbar = busy ? `${snap.status}:${snap.progress.toFixed(3)}` : 'off';
  if (taskbar !== timerUi.lastTaskbar) {
    timerUi.lastTaskbar = taskbar;
    if (busy) window.ch3.timerProgress(Math.max(snap.progress, 0.01), snap.status);
    else if (snap.status === 'idle') window.ch3.timerProgress(-1);
  }
}

// ---------- Robot voice ----------

// The system voice renders each text once (a few tens of ms once the engine
// is up); every playback then breaks it in a new way. Two voices share the
// speakers: the subject, and the timer, which always wins. A subject cut off
// or held back by the timer is read once the timer is quiet. The subject is
// read in the language of its theme.
const voice = {
  recordings: new Map(), // "<lang> <sentence>" -> recording
  subject: null,
  request: 0,
  sentence: null,
  owed: false,
  auto: load('3ch.voice.auto', true),
};

function playRobot(speech, when = 0) {
  const ctx = audio();
  const samples = Voice.robotize(speech.samples, speech.sampleRate);
  if (!samples.length) return null;
  const buffer = ctx.createBuffer(1, samples.length, speech.sampleRate);
  buffer.copyToChannel(samples, 0);
  const node = ctx.createBufferSource();
  node.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = 0.8;
  node.connect(gain).connect(ctx.destination);
  node.start(when);
  return node;
}

async function speak() {
  const view = current();
  if (!view) return;
  audio(); // on this user gesture, before the wait
  const request = ++voice.request;
  stopSubject();
  if (timerTalking()) return void (voice.owed = true);

  const lang = langOf(state.theme);
  const key = `${lang} ${view.sentence}`;
  let speech = voice.recordings.get(key);
  if (!speech) {
    $('speakBtn').classList.add('busy');
    let wav;
    try {
      wav = await window.ch3.speak(view.sentence, lang);
    } catch (err) {
      if (request === voice.request) toast(tr('noVoice', { error: err.message }), true);
      return;
    } finally {
      if (request === voice.request) $('speakBtn').classList.remove('busy');
    }
    if (!wav) return; // overtaken by a newer sentence
    speech = Voice.parseWav(wav);
    if (voice.recordings.size >= 20) voice.recordings.delete(voice.recordings.keys().next().value);
    voice.recordings.set(key, speech);
  }
  // Pressed again, or moved on to another sentence, while waiting.
  if (request !== voice.request) return;
  if (timerTalking()) return void (voice.owed = true);

  const node = playRobot(speech);
  if (!node) return;
  node.onended = () => {
    if (voice.subject !== node) return;
    voice.subject = null;
    $('subject').classList.remove('speaking');
  };
  voice.subject = node;
  $('subject').classList.add('speaking');
}

function stopSubject() {
  const node = voice.subject;
  voice.subject = null;
  node?.stop();
  $('subject').classList.remove('speaking');
}

// A new sentence cuts the voice off, and is read aloud when Auto voice is on.
function sentenceChanged(sentence) {
  if (sentence === voice.sentence) return;
  voice.sentence = sentence;
  voice.request++;
  voice.owed = false;
  stopSubject();
  $('speakBtn').classList.remove('busy');
  if (sentence && voice.auto) speak();
}

function toggleAutoSpeak() {
  voice.auto = !voice.auto;
  save('3ch.voice.auto', voice.auto);
  renderAutoSpeak();
  if (voice.auto) {
    window.ch3.speechWarmUp(state.lang);
    speak();
  } else {
    voice.request++;
    voice.owed = false;
    stopSubject();
  }
}

function renderAutoSpeak() {
  $('autoSpeakBtn').setAttribute('aria-pressed', String(voice.auto));
}

$('speakBtn').addEventListener('click', speak);
$('autoSpeakBtn').addEventListener('click', toggleAutoSpeak);

// ---------- Timer voice ----------

// The facility AI comments on the session (see announcer.js), with a 10 to 1
// countdown timed on the audio clock. Part of the sound alerts: muted with them.
// It speaks the interface language.
const COUNTDOWN_AT = (Announcer.COUNTDOWN_FROM + 1.5) * 1000;
const talk = {
  lines: new Map(), // "<lang> <text>" -> Promise of a recording ("10" is "dix" in French)
  nodes: new Set(),
  plan: [],
  done: '',
  before: 0,
  status: 'idle',
  gen: 0,
};

function timerTalking() {
  return talk.nodes.size > 0;
}

function recording(text, lang = state.lang) {
  const key = `${lang} ${text}`;
  if (!talk.lines.has(key)) {
    const rec = window.ch3
      .speakLine(text, lang)
      .then((wav) => (wav ? Voice.parseWav(wav) : null))
      .catch(() => {
        talk.lines.delete(key);
        return null;
      });
    talk.lines.set(key, rec);
  }
  return talk.lines.get(key);
}

const line = (kind) => Announcer.pickLine(kind, Math.random, state.lang);

// Draws the lines of a session and renders them ahead of time.
function planSession(duration) {
  talk.plan = Announcer.milestones(duration, Math.random, state.lang);
  talk.done = line('done');
  for (const m of talk.plan) recording(m.text);
  for (let n = Announcer.COUNTDOWN_FROM; n >= 1; n--) recording(String(n));
  recording(talk.done);
}

// Says `text` in `delay` ms. A line cuts off the previous ones, except for
// the countdown numbers (`keep`), which are all scheduled at once.
async function say(text, delay = 0, { keep = false } = {}) {
  const gen = talk.gen;
  const asked = performance.now();
  const speech = await recording(text);
  if (!speech || gen !== talk.gen || !timerUi.sound) return;
  if (!keep) for (const n of talk.nodes) n.stop();
  const ctx = audio();
  const wait = Math.max(0, delay - (performance.now() - asked)) / 1000;
  const node = playRobot(speech, ctx.currentTime + wait);
  if (!node) return;
  if (voice.subject) {
    stopSubject();
    voice.owed = true;
  }
  talk.nodes.add(node);
  $('timer').classList.add('speaking');
  node.onended = () => {
    talk.nodes.delete(node);
    if (timerTalking()) return;
    $('timer').classList.remove('speaking');
    if (voice.owed) {
      voice.owed = false;
      speak();
    }
  };
}

function hush() {
  talk.gen++;
  for (const n of talk.nodes) n.stop();
}

function countdown(remaining) {
  for (const c of Announcer.countdown(remaining)) say(c.text, c.delay, { keep: true });
}

function timerTalk(snap) {
  const prev = talk.status;
  const before = talk.before;
  talk.status = snap.status;
  talk.before = snap.remaining;
  if (snap.status === prev && snap.status !== 'running') return;

  if (snap.status === 'running' && prev !== 'running') {
    if (prev === 'paused') {
      say(line('resume'));
    } else {
      say(line('start'));
      planSession(snap.duration);
    }
    if (snap.remaining <= COUNTDOWN_AT) countdown(snap.remaining);
  } else if (snap.status === 'running') {
    // The last minute already gets the warning beeps.
    const minute = Announcer.minutePassed(before, snap.remaining);
    if (minute && !(minute === 1 && snap.duration > 2 * Timer.WARN_BEFORE_MS)) playMinute();
    for (const m of Announcer.crossed(talk.plan, before, snap.remaining)) {
      say(m.text, m.at === Timer.WARN_BEFORE_MS ? 900 : 0); // after the warning beeps
    }
    if (before > COUNTDOWN_AT && snap.remaining <= COUNTDOWN_AT) countdown(snap.remaining);
  } else if (snap.status === 'paused') {
    hush();
    say(line('pause'));
  } else if (snap.status === 'done') {
    say(talk.done, 1200); // after the first chime
  } else {
    hush(); // reset
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
  fitSubject();
  renderMini();
}

function renderMini() {
  $('miniLabel').textContent = tr(timerUi.mini ? 'exitMini' : 'mini');
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
  if (timerUi.sound) {
    tone(988, 0, 0.25, 0.12);
    window.ch3.speechWarmUp(state.lang);
  } else {
    hush();
  }
});
$('miniBtn').addEventListener('click', () => setMini(!timerUi.mini));

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  // Typing minutes or picking a language, not shortcuts.
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
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
  } else if (e.key === 'v' || e.key === 'V') {
    if (e.shiftKey) toggleAutoSpeak();
    else speak();
  } else if (e.key === 'u' || e.key === 'U') {
    unlockAll();
  } else if (e.key === 's' || e.key === 'S') {
    reshape();
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
  if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)) {
    e.preventDefault();
  }
});

// The language picked last time (or the OS one) until the themes are in: the
// page then never shows English first.
state.lang = I18n.pickLanguage(I18n.LANGUAGES.map((l) => l.code), [load('3ch.lang', null), ...navigator.languages]);
applyLang();
renderSound();
renderAutoSpeak();
if (voice.auto || timerUi.sound) window.ch3.speechWarmUp(state.lang);
setMinutes(timerUi.minutes);
refreshThemes();
