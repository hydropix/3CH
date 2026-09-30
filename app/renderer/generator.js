// Subject generator: pure logic, shared by the renderer and the Node tests.
(function (root) {
  'use strict';

  const text = (entry) => (typeof entry === 'string' ? entry : entry.text);
  const weight = (entry) => (typeof entry === 'string' ? 1 : entry.weight ?? 1);

  function randomFloat() {
    const buf = new Uint32Array(1);
    root.crypto.getRandomValues(buf);
    return buf[0] / 0x100000000;
  }

  // Weighted draw. Entries whose text is in `exclude` are skipped when possible,
  // so one subject never repeats a word ("ethereal ethereal fabrics").
  function pick(entries, rand = randomFloat, exclude = null) {
    let pool = entries;
    if (exclude && exclude.size) {
      const allowed = entries.filter((e) => !text(e) || !exclude.has(text(e)));
      if (allowed.length) pool = allowed;
    }
    const total = pool.reduce((sum, e) => sum + weight(e), 0);
    let r = rand() * total;
    for (const e of pool) {
      r -= weight(e);
      if (r < 0) return text(e);
    }
    return text(pool[pool.length - 1]);
  }

  // Slots describe the theme structure; literal words ("with", "and") are fixed.
  // A slot can ask for a form of its word: { list: "being", form: "pl" }.
  function slotsOf(theme) {
    return theme.structure.map((item, index) => {
      if (typeof item === 'string') return { index, list: item, literal: false };
      if (item.list) return { index, list: item.list, form: item.form, literal: false };
      return { index, list: null, literal: true, text: item.text, glue: Boolean(item.glue) };
    });
  }

  // Themes with several structures ("structures") write them as text:
  // "while a {being} {vi}, a {adj} {being.pl} ...". {list} draws a word,
  // {list.form} shows one of its forms. Leading punctuation sticks to the
  // previous word.
  const SLOT = /\{([^{}.\s]+)(?:\.([^{}.\s]+))?\}/g;
  function parseStructure(source) {
    const items = [];
    const literal = (chunk) => {
      let t = chunk.trim();
      const punct = t.match(/^[,;:]+/);
      if (punct) {
        items.push({ text: punct[0], glue: true });
        t = t.slice(punct[0].length).trim();
      }
      if (t) items.push({ text: t });
    };
    let last = 0;
    for (const m of source.matchAll(SLOT)) {
      literal(source.slice(last, m.index));
      items.push(m[2] ? { list: m[1], form: m[2] } : m[1]);
      last = m.index + m[0].length;
    }
    literal(source.slice(last));
    return items;
  }

  const parsed = new WeakMap();
  function structureOf(theme, i) {
    if (!theme.structures) return theme.structure;
    if (!parsed.has(theme)) parsed.set(theme, theme.structures.map(parseStructure));
    return parsed.get(theme)[i];
  }

  // The theme seen through one of its structures, for roll() and rerollSlot().
  function shape(theme, i) {
    return theme.structures ? { ...theme, structure: structureOf(theme, i) } : theme;
  }

  const count = (items) => items.reduce((m, list) => m.set(list, (m.get(list) ?? 0) + 1), new Map());

  // Picks a structure and carries words into it. Locked words always move to
  // a slot of the same list (only structures with room for all of them are
  // drawn); with keepAll, the other words follow where a slot is left.
  function reshape(theme, previous = null, locked = new Set(), { current = null, keepAll = false } = {}, rand = randomFloat) {
    const words = (previous ?? []).filter((p) => !p.literal && (keepAll || locked.has(p.index)));
    words.sort((a, b) => locked.has(b.index) - locked.has(a.index));
    const need = count(words.filter((p) => locked.has(p.index)).map((p) => p.list));
    const fits = (i) => {
      const have = count(slotsOf(shape(theme, i)).filter((s) => !s.literal).map((s) => s.list));
      return [...need].every(([list, n]) => (have.get(list) ?? 0) >= n);
    };
    let candidates = theme.structures.map((_, i) => i).filter(fits);
    if (candidates.length > 1) candidates = candidates.filter((i) => i !== current);
    if (!candidates.length) candidates = theme.structures.map((_, i) => i);
    const structure = candidates[Math.floor(rand() * candidates.length)];

    const shaped = shape(theme, structure);
    const slots = slotsOf(shaped);
    const carried = [];
    const taken = new Set();
    const nextLocked = new Set();
    for (const w of words) {
      const slot = slots.find((s) => !s.literal && s.list === w.list && !taken.has(s.index));
      if (!slot) continue;
      taken.add(slot.index);
      carried[slot.index] = { raw: w.raw };
      if (locked.has(w.index)) nextLocked.add(slot.index);
    }
    return { structure, parts: roll(shaped, carried, taken, rand), locked: nextLocked };
  }

  // Slots with a form show that form of their entry ("werewolf" -> "werewolves").
  const entryMaps = new WeakMap();
  function entryOf(list, raw) {
    if (!entryMaps.has(list)) entryMaps.set(list, new Map(list.map((e) => [text(e), e])));
    return entryMaps.get(list).get(raw);
  }
  function inflect(theme, parts) {
    return parts.map((p) => {
      if (p.literal || !p.form) return p;
      const entry = entryOf(theme.lists[p.list] ?? [], p.raw);
      return { ...p, word: typeof entry?.[p.form] === 'string' ? entry[p.form] : p.raw };
    });
  }

  // Rolls every unlocked slot. `previous` keeps locked words across rolls.
  function roll(theme, previous = null, locked = new Set(), rand = randomFloat) {
    const slots = slotsOf(theme);
    const keep = (slot) => !slot.literal && previous && locked.has(slot.index);
    const used = new Set(slots.filter(keep).map((slot) => previous[slot.index].raw));
    return slots.map((slot) => {
      if (slot.literal) return { ...slot, raw: slot.text };
      if (keep(slot)) return { ...slot, raw: previous[slot.index].raw };
      const raw = pick(theme.lists[slot.list], rand, used);
      used.add(raw);
      return { ...slot, raw };
    });
  }

  // Rerolls one word, always to a different one when the list allows it.
  function rerollSlot(theme, parts, index, rand = randomFloat) {
    const used = new Set(parts.filter((p) => !p.literal).map((p) => p.raw));
    const entries = theme.lists[parts[index].list];
    if (entries.every((e) => text(e) && used.has(text(e)))) return parts;
    const raw = pick(entries, rand, used);
    return parts.map((p, i) => (i === index ? { ...p, raw } : p));
  }

  // "a"/"an" is baked into the legacy lists and often wrong once words are
  // combined ("a omnivorous", "a apocalyptic warrior"). Fix it on the output.
  const CONSONANT_SOUND = /^(uni|use|usu|uti|ure|eu|ewe|one|once|ufo|u-)/i;
  const VOWEL_SOUND = /^(hour|honest|honou?r|heir)/i;
  function wantsAn(word) {
    const w = word.replace(/^[^a-z0-9]+/i, '');
    if (!w) return null;
    if (CONSONANT_SOUND.test(w)) return false;
    if (VOWEL_SOUND.test(w)) return true;
    return /^[aeiou]/i.test(w);
  }

  function fixArticles(parts) {
    const words = [];
    parts.forEach((p, pi) => {
      (p.word ?? p.raw).split(' ').filter(Boolean).forEach((w) => words.push({ pi, w }));
    });
    for (let i = 0; i < words.length - 1; i++) {
      const w = words[i].w;
      if (!/^(a|an)$/i.test(w)) continue;
      const an = wantsAn(words[i + 1].w);
      if (an === null) continue;
      const fixed = an ? 'an' : 'a';
      words[i].w = w[0] === w[0].toUpperCase() ? fixed[0].toUpperCase() + fixed.slice(1) : fixed;
    }
    return parts.map((p, pi) => ({
      ...p,
      display: words.filter((x) => x.pi === pi).map((x) => x.w).join(' '),
    }));
  }

  function render(parts) {
    const fixed = fixArticles(parts);
    const visible = fixed.filter((p) => p.display);
    let sentence = visible.reduce((s, p) => (s && !p.glue ? `${s} ${p.display}` : s + p.display), '');
    sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
    if (sentence && !/[.!?)]$/.test(sentence)) sentence += '.';
    if (visible.length) {
      const first = visible[0];
      first.display = first.display.charAt(0).toUpperCase() + first.display.slice(1);
    }
    return { parts: fixed, sentence };
  }

  const listOf = (item) => (typeof item === 'string' ? item : item?.list);

  function combinations(theme) {
    const one = (structure) =>
      structure.reduce((n, item) => {
        const list = listOf(item);
        return list ? n * BigInt(new Set(theme.lists[list].map(text)).size) : n;
      }, 1n);
    if (!theme.structures) return one(theme.structure);
    return theme.structures.reduce((n, _, i) => n + one(structureOf(theme, i)), 0n);
  }

  // A list entry is a string, or { text, weight } with a positive number weight.
  function validEntry(entry) {
    if (typeof entry === 'string') return true;
    if (!entry || typeof entry.text !== 'string') return false;
    const w = entry.weight;
    return w === undefined || (typeof w === 'number' && Number.isFinite(w) && w > 0);
  }

  function checkStructure(structure, lists) {
    for (const item of structure) {
      const name = listOf(item);
      if (name) {
        const list = Object.hasOwn(lists, name) ? lists[name] : undefined;
        if (!Array.isArray(list) || list.length === 0) return `list "${name}" is missing or empty`;
        const bad = list.findIndex((e) => !validEntry(e));
        if (bad !== -1) {
          return `list "${name}", entry ${bad + 1}: expected a string or { "text", "weight" } with a weight above 0`;
        }
        if (item.form) {
          const missing = list.findIndex((e) => typeof e !== 'object' || typeof e[item.form] !== 'string');
          if (missing !== -1) return `list "${name}", entry ${missing + 1}: no "${item.form}" form`;
        }
      } else if (!item || typeof item.text !== 'string') {
        return 'literal structure items need a "text" field';
      }
    }
    return null;
  }

  // Themes can be hand-written JSON: check everything roll() and render() rely on.
  function validateTheme(theme) {
    const many = Array.isArray(theme?.structures);
    if (!theme || !(many || Array.isArray(theme.structure)) || !theme.lists || typeof theme.lists !== 'object') {
      return 'missing "structure" or "lists"';
    }
    for (const key of ['id', 'name']) {
      if (theme[key] !== undefined && typeof theme[key] !== 'string') return `"${key}" must be a string`;
    }
    if (!many) {
      if (!theme.structure.length) return '"structure" is empty';
      return checkStructure(theme.structure, theme.lists);
    }
    if (!theme.structures.length) return '"structures" is empty';
    for (const [i, source] of theme.structures.entries()) {
      const where = `structure ${i + 1}`;
      if (typeof source !== 'string') return `${where}: expected text`;
      if (/[{}]/.test(source.replace(SLOT, ''))) return `${where}: unmatched { or }`;
      const structure = parseStructure(source);
      if (!structure.some(listOf)) return `${where}: no {slot}`;
      const problem = checkStructure(structure, theme.lists);
      if (problem) return `${where}: ${problem}`;
    }
    return null;
  }

  const api = {
    pick, slotsOf, roll, rerollSlot, render, fixArticles, combinations, validateTheme,
    parseStructure, shape, reshape, inflect,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Generator = api;
})(typeof window !== 'undefined' ? window : globalThis);
