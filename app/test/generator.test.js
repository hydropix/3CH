const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const G = require('../renderer/generator');

const themesDir = path.join(__dirname, '..', 'themes');
const themes = fs.readdirSync(themesDir).map((f) => require(path.join(themesDir, f)));
const seq = (...values) => { let i = 0; return () => values[i++ % values.length]; };

test('every bundled theme is valid and rolls a full sentence', () => {
  assert.ok(themes.length >= 6);
  for (const theme of themes) {
    assert.strictEqual(G.validateTheme(theme), null, theme.name);
    const shapes = theme.structures ? theme.structures.map((_, i) => G.shape(theme, i)) : [theme];
    for (const shaped of shapes) {
      for (let i = 0; i < 200 / shapes.length + 1; i++) {
        const { sentence } = G.render(G.inflect(theme, G.roll(shaped)), theme.lang);
        assert.match(sentence, /^[A-ZÀÂÉÈÊÎÔÙÛÇ(].*[.)]$/, `${theme.name}: ${sentence}`);
        assert.doesNotMatch(sentence, /\s{2}|\s[,;:]|\n|[{}[\]|@#]/, `${theme.name}: ${sentence}`);
        if (theme.lang === 'fr') {
          // Elision and contracted articles went through: no "le arbre", "de le", "' ".
          assert.doesNotMatch(sentence, /(^|[\s'])(le|la|de|que|ne|se) [aeiouàâéèêîôûœ]/i, `${theme.name}: ${sentence}`);
          assert.doesNotMatch(sentence, /(^|\s)(de|à) les?\s|'\s/i, `${theme.name}: ${sentence}`);
        }
      }
    }
  }
});

test('every bundled theme says its language, and every language has the same themes', () => {
  const ids = (lang) => themes.filter((t) => t.lang === lang).map((t) => t.id.replace(/-[a-z]{2}$/, '')).sort();
  for (const theme of themes) assert.match(theme.lang ?? '', /^[a-z]{2}$/, theme.name);
  assert.deepStrictEqual(ids('fr'), ids('en'));
});

test('structures parse into slots, forms and glued punctuation', () => {
  assert.deepStrictEqual(G.parseStructure('while a {being} {vi}, the {being.pl} {vt.base} it'), [
    { text: 'while a' },
    'being',
    'vi',
    { text: ',', glue: true },
    { text: 'the' },
    { list: 'being', form: 'pl' },
    { list: 'vt', form: 'base' },
    { text: 'it' },
  ]);
});

const chimera = {
  structures: ['a {adj} {being} {vt} a {being}', 'while {being.pl} {vi.base}, a {adj} {being} {vi}'],
  lists: {
    adj: ['old', 'red'],
    being: [{ text: 'wolf', pl: 'wolves' }, { text: 'owl', pl: 'owls' }, { text: 'eel', pl: 'eels' }],
    vt: [{ text: 'eats', base: 'eat', ing: 'eating' }],
    vi: [{ text: 'sleeps', base: 'sleep', ing: 'sleeping' }, { text: 'sings', base: 'sing', ing: 'singing' }],
  },
};

test('forms, a/an and punctuation render in a multi-structure theme', () => {
  const parts = G.roll(G.shape(chimera, 1), null, new Set(), seq(0, 0, 0, 0, 0.9));
  assert.deepStrictEqual(parts.filter((p) => !p.literal).map((p) => p.raw), ['wolf', 'sleeps', 'old', 'owl', 'sings']);
  assert.strictEqual(G.render(G.inflect(chimera, parts)).sentence, 'While wolves sleep, an old owl sings.');
  assert.strictEqual(G.combinations(chimera), 2n * 3n * 1n * 3n + 3n * 2n * 2n * 3n * 2n);
});

test('reshape carries locked words into a structure with room for them', () => {
  const first = G.reshape(chimera, null, new Set(), {}, seq(0));
  assert.strictEqual(first.structure, 0);
  // Lock the verb: only structure 0 has a {vt}, so it must stay.
  const vt = first.parts.find((p) => p.list === 'vt').index;
  const kept = G.reshape(chimera, first.parts, new Set([vt]), { current: 0 }, seq(0.9));
  assert.strictEqual(kept.structure, 0);
  assert.deepStrictEqual([...kept.locked], [vt]);
  // Lock the adjective: it moves to the other structure, at its new index.
  const adj = first.parts.find((p) => p.list === 'adj');
  const moved = G.reshape(chimera, first.parts, new Set([adj.index]), { current: 0 }, seq(0));
  assert.strictEqual(moved.structure, 1);
  const [index] = moved.locked;
  assert.strictEqual(moved.parts[index].list, 'adj');
  assert.strictEqual(moved.parts[index].raw, adj.raw);
});

test('reshape with keepAll carries every word that finds a slot', () => {
  const first = G.reshape(chimera, null, new Set(), {}, seq(0));
  const beings = first.parts.filter((p) => p.list === 'being').map((p) => p.raw);
  const next = G.reshape(chimera, first.parts, new Set(), { current: 0, keepAll: true }, seq(0));
  assert.strictEqual(next.structure, 1);
  assert.deepStrictEqual(next.parts.filter((p) => p.list === 'being').map((p) => p.raw), beings);
  assert.strictEqual(next.locked.size, 0);
});

test('multi-structure validation names the broken structure', () => {
  const theme = (structures, lists = chimera.lists) => ({ structures, lists });
  assert.strictEqual(G.validateTheme(chimera), null);
  assert.match(G.validateTheme(theme([])), /"structures" is empty/);
  assert.match(G.validateTheme(theme(['a {adj} {being}', 'a {ghost}'])), /structure 2: list "ghost"/);
  assert.match(G.validateTheme(theme(['a {adj.pl} {being}'])), /structure 1: list "adj", entry 1: no "pl" form/);
  assert.match(G.validateTheme(theme(['a {adj} {being'])), /unmatched/);
  assert.match(G.validateTheme(theme(['nothing to draw'])), /no \{slot\}/);
  assert.match(G.validateTheme(theme([42])), /expected text/);
});

test('a/an agrees with the following word', () => {
  const parts = (...raws) => raws.map((raw, index) => ({ index, raw, literal: false }));
  assert.strictEqual(G.render(parts('A', 'omnivorous fish')).sentence, 'An omnivorous fish.');
  assert.strictEqual(G.render(parts('an hyper-evoluted', 'bird')).sentence, 'A hyper-evoluted bird.');
  assert.strictEqual(G.render(parts('a', 'apocalyptic warrior')).sentence, 'An apocalyptic warrior.');
  assert.strictEqual(G.render(parts('a', 'unicorn')).sentence, 'A unicorn.');
  assert.strictEqual(G.render(parts('a', 'hour')).sentence, 'An hour.');
});

test('empty draws leave no double space', () => {
  const parts = [
    { index: 0, raw: 'a fish with', literal: false },
    { index: 1, raw: '', literal: false },
    { index: 2, raw: 'scaly fins', literal: false },
  ];
  assert.strictEqual(G.render(parts).sentence, 'A fish with scaly fins.');
});

test('locked slots survive a roll, others change', () => {
  const theme = { structure: ['a', { text: 'and' }, 'b'], lists: { a: ['x', 'y'], b: ['p', 'q'] } };
  const first = G.roll(theme, null, new Set(), seq(0, 0));
  assert.deepStrictEqual(first.map((p) => p.raw), ['x', 'and', 'p']);
  const second = G.roll(theme, first, new Set([0]), seq(0.9));
  assert.deepStrictEqual(second.map((p) => p.raw), ['x', 'and', 'q']);
});

test('weights skew the odds', () => {
  const entries = ['rare', { text: 'common', weight: 3 }];
  assert.strictEqual(G.pick(entries, () => 0.1), 'rare');
  assert.strictEqual(G.pick(entries, () => 0.3), 'common');
});

test('combinations count distinct entries', () => {
  const theme = { structure: ['a', { text: 'x' }, 'a'], lists: { a: ['1', '2', { text: '3', weight: 4 }] } };
  assert.strictEqual(G.combinations(theme), 9n);
});

test('a subject never repeats a word drawn from the same list', () => {
  const theme = { structure: ['adj', 'adj', 'adj'], lists: { adj: ['red', 'blue', 'green'] } };
  for (let i = 0; i < 100; i++) {
    const raws = G.roll(theme).map((p) => p.raw);
    assert.strictEqual(new Set(raws).size, 3, raws.join(' '));
  }
  const parts = G.roll(theme);
  const next = G.rerollSlot(theme, parts, 0);
  assert.strictEqual(next[0].raw, parts[0].raw, 'only one free word left: it must stay unique');
});

test('theme validation rejects entries that would break a roll', () => {
  const theme = (lists, extra = {}) => ({ structure: ['a'], lists, ...extra });
  assert.strictEqual(G.validateTheme(theme({ a: ['x', { text: 'y', weight: 2 }, { text: '' }] })), null);
  assert.match(G.validateTheme(theme({ a: ['x', null] })), /entry 2/);
  assert.match(G.validateTheme(theme({ a: [42] })), /entry 1/);
  assert.match(G.validateTheme(theme({ a: [{ text: 'x', weight: '3' }] })), /weight/);
  assert.match(G.validateTheme(theme({ a: [{ text: 'x', weight: 0 }] })), /weight/);
  assert.match(G.validateTheme(theme({ a: [{ text: 'x', weight: -1 }] })), /weight/);
  assert.match(G.validateTheme({ structure: ['constructor'], lists: {} }), /missing or empty/);
  assert.match(G.validateTheme({ structure: [], lists: {} }), /empty/);
  assert.match(G.validateTheme(theme({ a: ['x'] }, { name: 3 })), /"name"/);
  assert.match(G.validateTheme({ structure: ['a'], lists: null }), /missing/);
});

const french = {
  lang: 'fr',
  structures: [
    '[un|une@a] {being#a} {adj@a} {vt} [le|la@b] {being#b}',
    'des {being.pl#a} [couverts|couvertes@a] de {part.pl} {vi.pl} près de le {being}',
  ],
  lists: {
    being: [
      { text: 'loup', pl: 'loups', g: 'm' },
      { text: 'sorcière', pl: 'sorcières', g: 'f' },
      { text: 'hibou', pl: 'hiboux', g: 'm' },
      { text: 'araignée', pl: 'araignées', g: 'f' },
    ],
    adj: [{ text: 'vert', f: 'verte', pl: 'verts', fpl: 'vertes' }, 'en bois'],
    vt: [{ text: 'dévore', pl: 'dévorent' }],
    vi: [{ text: 'dort', pl: 'dorment' }],
    part: [{ text: 'œil', pl: 'yeux' }, { text: 'écaille', pl: 'écailles' }],
  },
};

test('agreement syntax parses into tags, agreeing slots and variants', () => {
  assert.deepStrictEqual(G.parseStructure('[un|une@a] {being.pl#a} {adj@a}'), [
    { text: 'un', variants: ['un', 'une'], agree: 'a' },
    { list: 'being', form: 'pl', tag: 'a' },
    { list: 'adj', agree: 'a' },
  ]);
});

test('French words agree with the slot they follow, even after a reroll', () => {
  const say = (parts) => G.render(G.inflect(french, parts), 'fr').sentence;
  const parts = G.roll(G.shape(french, 0), null, new Set(), seq(0.3, 0, 0, 0.6));
  assert.strictEqual(say(parts), 'Une sorcière verte dévore le hibou.');
  const rerolled = parts.map((p) => (p.tag === 'a' ? { ...p, raw: 'loup' } : p));
  assert.strictEqual(say(rerolled), 'Un loup vert dévore le hibou.');
  const other = parts.map((p) => (p.tag === 'b' ? { ...p, raw: 'araignée' } : p.list === 'adj' ? { ...p, raw: 'en bois' } : p));
  assert.strictEqual(say(other), "Une sorcière en bois dévore l'araignée.");
  const plural = G.roll(G.shape(french, 1), null, new Set(), seq(0.3, 0, 0, 0.6));
  assert.strictEqual(say(plural), "Des sorcières couvertes d'yeux dorment près du hibou.");
});

test('French elision and contracted articles', () => {
  const parts = (...raws) => raws.map((raw, index) => ({ index, raw, literal: false }));
  const say = (...raws) => G.render(parts(...raws), 'fr').sentence;
  assert.strictEqual(say('le', 'arbre'), "L'arbre.");
  assert.strictEqual(say('la', 'hydre'), "L'hydre.");
  assert.strictEqual(say('le', 'hibou'), 'Le hibou.');
  assert.strictEqual(say('près de le', 'loup'), 'Près du loup.');
  assert.strictEqual(say('près de le', 'ogre'), "Près de l'ogre.");
  assert.strictEqual(say('à les', 'hiboux'), 'Aux hiboux.');
  assert.strictEqual(say('de les', 'yeux'), 'Des yeux.');
  assert.strictEqual(say('à le', 'héros'), 'Au héros.');
  assert.strictEqual(say('couvert de', 'écailles'), "Couvert d'écailles.");
  assert.strictEqual(say('couvert de', 'huit', 'yeux'), 'Couvert de huit yeux.');
  assert.strictEqual(say('un loup que', 'il', 'avale'), "Un loup qu'il avale.");
  assert.strictEqual(say('ce', 'homme'), 'Cet homme.');
  assert.strictEqual(say('le', 'yéti'), 'Le yéti.');
  assert.strictEqual(say('sa', 'aile'), 'Son aile.');
  assert.ok(G.elides('humain') && G.elides('herbe') && G.elides('héroïne'));
  assert.ok(!G.elides('hache') && !G.elides('hérisson') && !G.elides('héros') && !G.elides('hurlement'));
});

test('agreement validation names what is missing', () => {
  const theme = (structures, lists = french.lists) => ({ lang: 'fr', structures, lists });
  assert.strictEqual(G.validateTheme(french), null);
  assert.match(G.validateTheme(theme(['{being} {adj@a}'])), /@a agrees with no \{slot#a\}/);
  assert.match(G.validateTheme(theme(['{being#a} {being#a}'])), /#a names two slots/);
  assert.match(G.validateTheme(theme(['{adj#a} {being}'])), /list "adj", entry 1: no gender/);
  assert.match(G.validateTheme(theme(['{being#a} {vt@a}'])), /list "vt", entry 1: an agreeing entry needs/);
  assert.match(G.validateTheme(theme(['{being#a} {adj.pl@a}'])), /form or agrees, not both/);
  assert.match(G.validateTheme(theme(['[un|une] {being#a}'])), /unmatched \[/);
  assert.match(G.validateTheme({ ...french, lang: 3 }), /"lang"/);
});
