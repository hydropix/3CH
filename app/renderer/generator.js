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
  function slotsOf(theme) {
    return theme.structure.map((item, index) =>
      typeof item === 'string'
        ? { index, list: item, literal: false }
        : { index, list: null, literal: true, text: item.text }
    );
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
      p.raw.split(' ').filter(Boolean).forEach((w) => words.push({ pi, w }));
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
    let sentence = visible.map((p) => p.display).join(' ');
    sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
    if (sentence && !/[.!?)]$/.test(sentence)) sentence += '.';
    if (visible.length) {
      const first = visible[0];
      first.display = first.display.charAt(0).toUpperCase() + first.display.slice(1);
    }
    return { parts: fixed, sentence };
  }

  function combinations(theme) {
    return theme.structure.reduce((n, item) => {
      if (typeof item !== 'string') return n;
      return n * BigInt(new Set(theme.lists[item].map(text)).size);
    }, 1n);
  }

  function validateTheme(theme) {
    if (!theme || !Array.isArray(theme.structure) || typeof theme.lists !== 'object') {
      return 'missing "structure" or "lists"';
    }
    for (const item of theme.structure) {
      if (typeof item === 'string') {
        const list = theme.lists[item];
        if (!Array.isArray(list) || list.length === 0) return `list "${item}" is missing or empty`;
      } else if (!item || typeof item.text !== 'string') {
        return 'literal structure items need a "text" field';
      }
    }
    return null;
  }

  const api = { pick, slotsOf, roll, rerollSlot, render, fixArticles, combinations, validateTheme };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Generator = api;
})(typeof window !== 'undefined' ? window : globalThis);
