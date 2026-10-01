// Usage: node scripts/sample-theme.js <theme.json> [rolls per structure]
// Checks a theme and prints sample subjects from every structure, to proofread
// a hand-written theme. French themes also get the elision checks of the
// tests, and the list of words starting with "h" (elided or h aspiré).
// Chinese themes are checked for Latin letters, spaces, half-width
// punctuation, a stray 的 and a doubled word (被被).

const fs = require('fs');
const path = require('path');
const G = require('../renderer/generator');

const [file, perArg] = process.argv.slice(2);
if (!file) {
  console.error('Usage: node scripts/sample-theme.js <theme.json> [rolls per structure]');
  process.exit(2);
}
const theme = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
const per = Number(perArg) || 4;

const problem = G.validateTheme(theme);
if (problem) {
  console.error(`INVALID: ${problem}`);
  process.exit(1);
}

const lang = theme.lang ?? 'en';
const french = lang === 'fr';
const chinese = lang === 'zh';
// The names of the 2005 team stay in Latin letters in every language.
const TEAM = /Viag|Rainart|BARoNTiERi|Vyle|Feerik/g;
const LINT = [
  [/\s{2}|\s[,;:]|\n|[{}[\]|@#]/, 'spacing or leftover syntax'],
  ...(french
    ? [
        [/(^|[\s'])(le|la|de|que|ne|se) [aeiouàâéèêîôûœ]/i, 'missing elision'],
        [/(^|\s)(de|à) les?\s/i, 'missing contraction'],
        [/'\s/, 'space after an apostrophe'],
      ]
    : []),
  ...(chinese
    ? [
        [/[A-Za-z]/, 'Latin letters'],
        [/\s/, 'space'],
        [/[,.;:!?()]|[；：]/, 'half-width punctuation, ； or ：'],
        [/的的|的[，。]|，[，。]|^，/, 'stray 的 or comma'],
        [/(被|在|和|与|是|把|从|向|用|像)\1/, 'doubled word (被被, 在在...)'],
      ]
    : []),
];

let bad = 0;
const structures = theme.structures ?? [null];
structures.forEach((source, i) => {
  console.log(`\n#${i + 1} ${source ?? JSON.stringify(theme.structure)}`);
  for (let n = 0; n < per; n++) {
    const { sentence } = G.render(G.inflect(theme, G.roll(G.shape(theme, i))), lang);
    const checked = chinese ? sentence.replace(TEAM, '人') : sentence;
    const issues = LINT.filter(([re]) => re.test(checked)).map(([, why]) => why);
    if (issues.length) bad++;
    console.log(`   ${issues.length ? `!! [${issues.join(', ')}] ` : ''}${sentence}`);
  }
});

const text = (e) => (typeof e === 'string' ? e : e.text);
if (french) {
  const words = new Set();
  const collect = (s) => s.split(/[\s'’()[\]{}|@,]+/).filter((w) => /^h/i.test(w)).forEach((w) => words.add(w));
  for (const list of Object.values(theme.lists)) {
    for (const e of list) for (const v of typeof e === 'string' ? [e] : Object.values(e)) if (typeof v === 'string') collect(v);
  }
  structures.forEach((s) => s && collect(s));
  const sorted = [...words].sort();
  console.log('\nWords starting with h:');
  console.log(`   elided (l'..., d'...): ${sorted.filter((w) => G.elides(w)).join(', ') || '-'}`);
  console.log(`   h aspiré (le ..., de ...): ${sorted.filter((w) => !G.elides(w)).join(', ') || '-'}`);
}

const dupes = Object.entries(theme.lists).flatMap(([name, list]) => {
  const seen = new Set();
  return list.map(text).filter((t) => t && (seen.has(t) ? true : (seen.add(t), false))).map((t) => `${name}: ${t}`);
});
if (dupes.length) console.log(`\nDuplicate entries: ${dupes.join(' · ')}`);

const lists = Object.fromEntries(Object.entries(theme.lists).map(([k, v]) => [k, v.length]));
console.log(`\n${theme.name} (${lang}): ${structures.length} structures, lists ${JSON.stringify(lists)}`);
console.log(`${G.combinations(theme)} combinations, ${bad} flagged sentences`);
process.exit(bad ? 1 : 0);
