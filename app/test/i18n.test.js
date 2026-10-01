const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const I18n = require('../renderer/i18n');

const html = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'index.html'), 'utf8');
// Group separators are no-break spaces in French: compare with plain ones.
const plain = (s) => s.replace(/\s/g, ' ');

test('every language has every string, of the same kind', () => {
  const keys = Object.keys(I18n.STRINGS.en).sort();
  for (const { code } of I18n.LANGUAGES) {
    const strings = I18n.STRINGS[code];
    assert.ok(strings, code);
    assert.deepStrictEqual(Object.keys(strings).sort(), keys, code);
    for (const key of keys) {
      assert.strictEqual(typeof strings[key], typeof I18n.STRINGS.en[key], `${code}.${key}`);
      const text = I18n.t(code, key, { count: 2, n: 3, locked: false, name: 'X', error: 'E', errors: 'E', date: 'D', language: 'L' });
      assert.ok(text && !/\{\w+\}|undefined/.test(text), `${code}.${key}: ${text}`);
    }
  }
});

test('every data-i18n key of the page exists', () => {
  const used = [...html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(used.length > 30);
  for (const key of used) assert.ok(key in I18n.STRINGS.en, key);
});

test('strings fill their placeholders and fall back to English', () => {
  assert.strictEqual(I18n.t('en', 'presetTitle', { n: 15 }), '15 minutes');
  assert.strictEqual(I18n.t('fr', 'themeGone', { name: 'Darwin' }), 'Le thème « Darwin » n’est plus disponible');
  assert.strictEqual(I18n.t('de', 'generate'), 'Generate');
  assert.strictEqual(I18n.t('fr', 'no-such-key'), 'no-such-key');
  assert.strictEqual(I18n.t('en', 'imported', { count: 1 }), 'Imported 1 theme');
  assert.strictEqual(I18n.t('en', 'imported', { count: 3 }), 'Imported 3 themes');
  assert.strictEqual(I18n.t('fr', 'imported', { count: 1 }), '1 thème importé');
  assert.strictEqual(I18n.t('fr', 'imported', { count: 3 }), '3 thèmes importés');
  assert.strictEqual(I18n.t('fr', 'sentenceShapes', { count: 34 }), '34 formes de phrase');
  assert.strictEqual(I18n.t('fr', 'possibleSubjects', { count: 1 }), 'sujet possible');
  assert.strictEqual(I18n.t('fr', 'possibleSubjects', { count: 5000 }), 'sujets possibles');
  assert.strictEqual(I18n.t('fr', 'possibleSubjects', { count: 4.5e6 }), 'de sujets possibles');
});

test('subject counts: English short scale', () => {
  const f = (n) => I18n.formatCombos(n, 'en');
  assert.strictEqual(f(7n), '7');
  assert.strictEqual(f(123456n), '123,456');
  assert.strictEqual(f(4500000n), '4.5 million');
  assert.strictEqual(f(12345678901n), '12 billion');
  assert.strictEqual(f(1234567890123n), '1.2 trillion');
  assert.strictEqual(f(999700000n), '1.0 billion');
  assert.strictEqual(I18n.formatCombos(4500000n), '4.5 million');
});

test('subject counts: French long scale, French digits and plurals', () => {
  const f = (n) => plain(I18n.formatCombos(n, 'fr'));
  assert.strictEqual(f(7n), '7');
  assert.strictEqual(f(123456n), '123 456');
  assert.strictEqual(f(1500000n), '1,5 million');
  assert.strictEqual(f(4500000n), '4,5 millions');
  assert.strictEqual(f(12345678901n), '12 milliards');
  assert.strictEqual(f(1234567890123n), '1,2 billion');
  assert.strictEqual(f(3400000000000n), '3,4 billions');
  assert.strictEqual(f(250000000000000000n), '250 billiards');
  assert.strictEqual(f(999700000n), '1,0 milliard');
});

test('subject counts: Chinese groups of four digits', () => {
  const f = (n) => I18n.formatCombos(n, 'zh');
  assert.strictEqual(f(7n), '7');
  assert.strictEqual(f(1234n), '1,234');
  assert.strictEqual(f(45000n), '4.5万');
  assert.strictEqual(f(123456789n), '1.2亿');
  assert.strictEqual(f(999970000n), '10亿');
  assert.strictEqual(f(99999000n), '1.0亿');
  assert.strictEqual(f(12345678901234n), '12万亿');
  assert.strictEqual(I18n.t('zh', 'sentenceShapes', { count: 99 }), '99 种句式');
  // 9.97 million rounds to 10, not "10.0".
  assert.strictEqual(I18n.formatCombos(9970000n, 'en'), '10 million');
});

test('the start language follows the OS when there are themes for it', () => {
  assert.strictEqual(I18n.pickLanguage(['en', 'fr'], ['fr-FR', 'en-US']), 'fr');
  assert.strictEqual(I18n.pickLanguage(['en', 'fr'], ['de-DE']), 'en');
  assert.strictEqual(I18n.pickLanguage(['en'], ['fr-FR']), 'en');
  assert.strictEqual(I18n.pickLanguage(['en', 'fr'], [null, 'fr_CA']), 'fr');
  assert.strictEqual(I18n.pickLanguage(['fr'], []), 'fr');
  assert.strictEqual(I18n.pickLanguage(['en', 'fr', 'zh'], ['zh-CN']), 'zh');
});

test('languages are named in their own language', () => {
  assert.strictEqual(I18n.languageName('en'), 'English');
  assert.strictEqual(I18n.languageName('fr'), 'Français');
  assert.strictEqual(I18n.languageName('zh'), '中文');
  assert.strictEqual(I18n.languageName('de'), 'Deutsch');
});
