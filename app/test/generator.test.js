const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const G = require('../renderer/generator');

const themesDir = path.join(__dirname, '..', 'themes');
const themes = fs.readdirSync(themesDir).map((f) => require(path.join(themesDir, f)));
const seq = (...values) => { let i = 0; return () => values[i++ % values.length]; };

test('every bundled theme is valid and rolls a full sentence', () => {
  assert.ok(themes.length >= 5);
  for (const theme of themes) {
    assert.strictEqual(G.validateTheme(theme), null, theme.name);
    for (let i = 0; i < 200; i++) {
      const { sentence } = G.render(G.roll(theme));
      assert.match(sentence, /^[A-Z(].*[.)]$/, `${theme.name}: ${sentence}`);
      assert.doesNotMatch(sentence, /\s{2}|\n/, `${theme.name}: ${sentence}`);
    }
  }
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
