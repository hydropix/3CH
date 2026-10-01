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
  // so one subject never repeats a word ("ethereal ethereal fabrics"). Empty
  // entries ("nothing here") keep their share of the draw however many words
  // are skipped.
  function pick(entries, rand = randomFloat, exclude = null) {
    let pool = entries;
    let blankScale = 1;
    if (exclude && exclude.size) {
      const allowed = entries.filter((e) => !text(e) || !exclude.has(text(e)));
      if (allowed.length) {
        const words = (list) => list.reduce((sum, e) => sum + (text(e) ? weight(e) : 0), 0);
        const before = words(entries);
        if (before > 0) blankScale = words(allowed) / before;
        pool = allowed;
      }
    }
    const w = (e) => (text(e) ? weight(e) : weight(e) * blankScale);
    const total = pool.reduce((sum, e) => sum + w(e), 0);
    let r = rand() * total;
    for (const e of pool) {
      r -= w(e);
      if (r < 0) return text(e);
    }
    return text(pool[pool.length - 1]);
  }

  // Draws remembered across rolls: a word, or a structure, comes back only once
  // most of its list has been drawn since (a shuffle bag that keeps the
  // weights). Plain data, so the app can save it: { words: { list: [raw...] },
  // structures: [index...] }, most recent last.
  const RECENT_SHARE = 0.75;
  const recentSize = (n) => Math.floor(n * RECENT_SHARE);
  const createMemory = () => ({ words: {}, structures: [] });
  const recentOf = (queue) => (Array.isArray(queue) ? queue : []);

  function remember(queue, item, size) {
    const i = queue.indexOf(item);
    if (i !== -1) queue.splice(i, 1);
    queue.push(item);
    if (queue.length > size) queue.splice(0, queue.length - size);
    return queue;
  }

  // One word for a slot of `list`: never one already in the subject (`used`),
  // and not a recent one while the list has others.
  function draw(theme, list, used, rand, memory) {
    const entries = theme.lists[list];
    if (!memory) return pick(entries, rand, used);
    const recent = recentOf(memory.words?.[list]);
    const avoid = new Set([...used, ...recent]);
    const fresh = entries.some((e) => !text(e) || !avoid.has(text(e)));
    const raw = pick(entries, rand, fresh ? avoid : used);
    if (raw) {
      if (!memory.words || typeof memory.words !== 'object' || Array.isArray(memory.words)) memory.words = {};
      const size = recentSize(new Set(entries.map(text).filter(Boolean)).size);
      memory.words[list] = remember([...recent], raw, size);
    }
    return raw;
  }

  // Slots describe the theme structure; literal words ("with", "and") are fixed.
  // A slot can ask for a form of its word: { list: "being", form: "pl" }, be
  // named so other words agree with it (tag), or agree with a named slot (agree).
  function slotsOf(theme) {
    return theme.structure.map((item, index) => {
      if (typeof item === 'string') return { index, list: item, literal: false };
      if (item.list) return { index, list: item.list, form: item.form, tag: item.tag, agree: item.agree, literal: false };
      const slot = { index, list: null, literal: true, text: item.text, glue: Boolean(item.glue) };
      return item.variants ? { ...slot, variants: item.variants, agree: item.agree } : slot;
    });
  }

  // Themes with several structures ("structures") write them as text:
  // "while a {being} {vi}, a {adj} {being.pl} ...". {list} draws a word,
  // {list.form} shows one of its forms. Leading punctuation sticks to the
  // previous word.
  // Agreement, for languages with genders: {being#a} names a slot, {adj@a}
  // shows the form of its word that agrees with slot a (gender and number),
  // and [un|une@a] is a fixed word, masculine or feminine after slot a.
  const NAME = '[^{}\\[\\].\\s#@|]+';
  const SLOT = new RegExp(`\\{(${NAME})(?:\\.(${NAME}))?(?:#(${NAME}))?(?:@(${NAME}))?\\}`, 'g');
  const VARIANT = new RegExp(`\\[([^\\[\\]{}|@]*)\\|([^\\[\\]{}|@]*)@(${NAME})\\]`, 'g');
  const TOKEN = new RegExp(`${SLOT.source}|${VARIANT.source}`, 'g');
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
    for (const m of source.matchAll(TOKEN)) {
      literal(source.slice(last, m.index));
      const [, list, form, tag, agree, masc, fem, variantAgree] = m;
      if (list) {
        const slot = { list };
        if (form) slot.form = form;
        if (tag) slot.tag = tag;
        if (agree) slot.agree = agree;
        items.push(Object.keys(slot).length > 1 ? slot : list);
      } else {
        items.push({ text: masc.trim(), variants: [masc.trim(), fem.trim()], agree: variantAgree });
      }
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
  // drawn); with keepAll, the other words follow where a slot is left. With a
  // memory (createMemory), recent structures and words are avoided.
  function reshape(theme, previous = null, locked = new Set(), { current = null, keepAll = false, memory = null } = {}, rand = randomFloat) {
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
    if (memory) {
      const recent = recentOf(memory.structures);
      const fresh = candidates.filter((i) => !recent.includes(i));
      if (fresh.length) candidates = fresh;
    }
    const structure = candidates[Math.floor(rand() * candidates.length)];
    if (memory) memory.structures = remember([...recentOf(memory.structures)], structure, recentSize(theme.structures.length));

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
    return { structure, parts: roll(shaped, carried, taken, rand, memory), locked: nextLocked };
  }

  // Slots with a form show that form of their entry ("werewolf" -> "werewolves").
  const entryMaps = new WeakMap();
  function entryOf(list, raw) {
    if (!entryMaps.has(list)) entryMaps.set(list, new Map(list.map((e) => [text(e), e])));
    return entryMaps.get(list).get(raw);
  }
  // A named slot ({being#a}) passes on the gender of its entry ("g": "m" or
  // "f") and its number (plural when the slot shows the "pl" form).
  function agreementOf(theme, parts) {
    const tags = new Map();
    for (const p of parts) {
      if (p.literal || !p.tag) continue;
      const entry = entryOf(theme.lists[p.list] ?? [], p.raw);
      tags.set(p.tag, { f: entry?.g === 'f', pl: p.form === 'pl' });
    }
    return tags;
  }

  // The form an agreeing entry shows: "text" (masculine singular), "f", "pl"
  // or "fpl". A string entry never changes.
  function agreedForm(entry, raw, agreement) {
    if (!agreement || typeof entry !== 'object') return raw;
    const key = agreement.f ? (agreement.pl ? 'fpl' : 'f') : agreement.pl ? 'pl' : null;
    return key && typeof entry[key] === 'string' ? entry[key] : raw;
  }

  function inflect(theme, parts) {
    const tags = parts.some((p) => p.agree) ? agreementOf(theme, parts) : null;
    return parts.map((p) => {
      if (p.literal) return p.variants ? { ...p, word: p.variants[tags.get(p.agree)?.f ? 1 : 0] } : p;
      const entry = p.agree || p.form ? entryOf(theme.lists[p.list] ?? [], p.raw) : null;
      if (p.agree) return { ...p, word: agreedForm(entry, p.raw, tags.get(p.agree)) };
      if (!p.form) return p;
      return { ...p, word: typeof entry?.[p.form] === 'string' ? entry[p.form] : p.raw };
    });
  }

  // Rolls every unlocked slot. `previous` keeps locked words across rolls.
  function roll(theme, previous = null, locked = new Set(), rand = randomFloat, memory = null) {
    const slots = slotsOf(theme);
    const keep = (slot) => !slot.literal && previous && locked.has(slot.index);
    const used = new Set(slots.filter(keep).map((slot) => previous[slot.index].raw));
    return slots.map((slot) => {
      if (slot.literal) return { ...slot, raw: slot.text };
      if (keep(slot)) return { ...slot, raw: previous[slot.index].raw };
      const raw = draw(theme, slot.list, used, rand, memory);
      used.add(raw);
      return { ...slot, raw };
    });
  }

  // Rerolls one word, always to a different one when the list allows it.
  function rerollSlot(theme, parts, index, rand = randomFloat, memory = null) {
    const used = new Set(parts.filter((p) => !p.literal).map((p) => p.raw));
    const entries = theme.lists[parts[index].list];
    if (entries.every((e) => text(e) && used.has(text(e)))) return parts;
    const raw = draw(theme, parts[index].list, used, rand, memory);
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

  // French: elision ("le arbre" -> "l'arbre", "de un" -> "d'un") and the
  // contracted articles ("de le" -> "du", "à les" -> "aux"). A word starting
  // with an h aspiré keeps the vowel before it ("le hibou", "de huit").
  const H_ASPIRE = new RegExp(
    '^h(?:' +
      [
        'ach', 'aie', 'aill', 'ain', 'aï', 'alet', 'alèt', 'alls?$', 'alle$', 'alles$', 'alleb', 'alo', 'alte$',
        'altes$', 'amac', 'amma', 'aub', 'ameau', 'amster', 'amburger', 'anch', 'andi', 'anga', 'anne', 'ant', 'app', 'arc',
        'ard', 'are', 'arg', 'ari', 'arn', 'arp', 'as', 'ât', 'auss', 'aut', 'avr', 'enn', 'ern', 'ers',
        'ériss', 'éron', 'éros$', 'êtr', 'eurt', 'ibou', 'ideu', 'iérarch', 'igh', 'iss', 'och', 'ockey', 'old',
        'ollandais', 'omard', 'oo', 'ippie', 'usk', 'ongr', 'ont', 'oqu', 'orde', 'ors', 'otte', 'ot-dog', 'ou', 'ublot', 'uche', 'ue$',
        'ues$', 'uée', 'uer', 'uit', 'ulott', 'upp', 'url', 'uss', 'utt', 'yène',
      ].join('|') +
      ')'
  );
  const FR_VOWEL = /^[aeiouàâäéèêëîïôöùûüœæ]/;
  function elides(word) {
    const w = word.toLowerCase().replace(/^[^a-zà-ÿœæ]+/, '');
    if (w[0] === 'h') return !H_ASPIRE.test(w);
    if (w[0] === 'y') return w === 'y' || w.startsWith('yeu');
    return FR_VOWEL.test(w);
  }

  const ELIDED = {
    le: "l'", la: "l'", de: "d'", que: "qu'", ne: "n'", se: "s'", me: "m'", te: "t'", je: "j'",
    jusque: "jusqu'", lorsque: "lorsqu'", puisque: "puisqu'", ce: 'cet', ma: 'mon', ta: 'ton', sa: 'son',
  };
  const CONTRACTED = { 'de le': 'du', 'à le': 'au', 'de les': 'des', 'à les': 'aux' };
  const sameCase = (from, to) => (from[0] === from[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to);
  const elided = (s) => s.endsWith("'");
  const joinWords = (words) => words.reduce((s, w) => (!s ? w : elided(s) ? s + w : `${s} ${w}`), '');

  function fixFrench(parts) {
    const words = [];
    parts.forEach((p, pi) => {
      (p.word ?? p.raw).split(' ').filter(Boolean).forEach((w) => words.push({ pi, w }));
    });
    const elide = (which) => {
      for (let i = 0; i < words.length - 1; i++) {
        const lower = words[i].w.toLowerCase();
        if (which.includes(lower) && elides(words[i + 1].w)) words[i].w = sameCase(words[i].w, ELIDED[lower]);
      }
    };
    // "à le arbre" -> "à l'arbre" first, so that only "à le hibou" -> "au hibou".
    elide(['le', 'la']);
    for (let i = 0; i < words.length - 1; i++) {
      const pair = CONTRACTED[`${words[i].w.toLowerCase()} ${words[i + 1].w.toLowerCase()}`];
      if (!pair) continue;
      words[i].w = sameCase(words[i].w, pair);
      words.splice(i + 1, 1);
    }
    elide(['de', 'que', 'ne', 'se', 'me', 'te', 'je', 'jusque', 'lorsque', 'puisque', 'ce', 'ma', 'ta', 'sa']);
    for (let i = 0; i < words.length - 1; i++) {
      if (/^si$/i.test(words[i].w) && /^ils?$/i.test(words[i + 1].w)) words[i].w = sameCase(words[i].w, "s'");
    }
    return parts.map((p, pi) => ({ ...p, display: joinWords(words.filter((x) => x.pi === pi).map((x) => x.w)) }));
  }

  // A language without its own fix-up shows the words as they are.
  const asWritten = (parts) => parts.map((p) => ({ ...p, display: (p.word ?? p.raw).split(' ').filter(Boolean).join(' ') }));
  const FIXES = { en: fixArticles, fr: fixFrench };

  function render(parts, lang = 'en') {
    const fixed = (FIXES[lang] ?? asWritten)(parts);
    const visible = fixed.filter((p) => p.display);
    const french = lang === 'fr';
    let sentence = visible.reduce(
      (s, p) => (s && !p.glue && !(french && elided(s)) ? `${s} ${p.display}` : s + p.display),
      ''
    );
    sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
    if (sentence && !/[.!?)]$/.test(sentence)) sentence += '.';
    if (visible.length) {
      const first = visible[0];
      first.display = first.display.charAt(0).toUpperCase() + first.display.slice(1);
    }
    // "l'", "d'"... at the end of a part: the next word sticks to it.
    if (french) for (const p of visible) if (elided(p.display)) p.elided = true;
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

  const hasGender = (e) => typeof e === 'object' && (e.g === 'm' || e.g === 'f');
  const AGREED_FORMS = ['f', 'pl', 'fpl'];

  function checkStructure(structure, lists) {
    const tags = new Set();
    for (const item of structure) {
      if (!item?.tag) continue;
      if (tags.has(item.tag)) return `#${item.tag} names two slots`;
      tags.add(item.tag);
    }
    for (const item of structure) {
      const name = listOf(item);
      if (item?.agree && !tags.has(item.agree)) return `@${item.agree} agrees with no {slot#${item.agree}}`;
      if (name) {
        const list = Object.hasOwn(lists, name) ? lists[name] : undefined;
        if (!Array.isArray(list) || list.length === 0) return `list "${name}" is missing or empty`;
        const bad = list.findIndex((e) => !validEntry(e));
        if (bad !== -1) {
          return `list "${name}", entry ${bad + 1}: expected a string or { "text", "weight" } with a weight above 0`;
        }
        if (item.form && item.agree) return `{${name}.${item.form}@${item.agree}}: a slot takes a form or agrees, not both`;
        if (item.form) {
          const missing = list.findIndex((e) => typeof e !== 'object' || typeof e[item.form] !== 'string');
          if (missing !== -1) return `list "${name}", entry ${missing + 1}: no "${item.form}" form`;
        }
        if (item.tag) {
          const missing = list.findIndex((e) => !hasGender(e));
          if (missing !== -1) return `list "${name}", entry ${missing + 1}: no gender ("g": "m" or "f") for #${item.tag}`;
        }
        if (item.agree) {
          const missing = list.findIndex((e) => typeof e === 'object' && AGREED_FORMS.some((f) => typeof e[f] !== 'string'));
          if (missing !== -1) return `list "${name}", entry ${missing + 1}: an agreeing entry needs "f", "pl" and "fpl" forms`;
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
    for (const key of ['id', 'name', 'lang']) {
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
      if (/[{}]/.test(source.replace(TOKEN, ''))) return `${where}: unmatched { or }`;
      if (/[[\]]/.test(source.replace(TOKEN, ''))) return `${where}: unmatched [ or ], or [masc|fem] without @tag`;
      const structure = parseStructure(source);
      if (!structure.some(listOf)) return `${where}: no {slot}`;
      const problem = checkStructure(structure, theme.lists);
      if (problem) return `${where}: ${problem}`;
    }
    return null;
  }

  const api = {
    pick, slotsOf, roll, rerollSlot, render, fixArticles, combinations, validateTheme,
    parseStructure, shape, reshape, inflect, elides, createMemory,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Generator = api;
})(typeof window !== 'undefined' ? window : globalThis);
