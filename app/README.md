# 3CH v2: developer notes

Downloads, features and shortcuts are in the [main README](../README.md). This
page covers the theme format and the code.

## Themes

A theme is a JSON file:

```json
{
  "format": "3ch-theme/2",
  "id": "darwin",
  "name": "Darwin",
  "structure": ["trait", "type", { "text": "with" }, "adjective", "part"],
  "lists": {
    "trait": ["A giant", "An aggressive", { "text": "A", "weight": 2 }],
    "type": ["fish", "reptile"],
    "adjective": ["scaly", "venomous", { "text": "", "weight": 10 }],
    "part": ["claws", "tentacles"]
  },
  "labels": { "trait": "trait", "part": "body part" }
}
```

- `structure`: the words of the sentence, in order. A string names a list, and
  `{ "text": ... }` is a fixed word. A list can be used several times, and one
  subject never draws the same word twice.
- Across rolls, the app remembers the words drawn from each list and avoids
  them until three quarters of the list has come up (structures too), so
  repetitions stay rare even with short lists. Weights still apply among the
  words left, and empty entries keep their share. The memory is kept per
  theme between sessions.
- An entry is a string, or `{ "text", "weight" }` (a number above 0) to make it
  more likely. An empty `text` means "nothing here", which is useful for
  optional words.
- `a` / `an` agree with the next word automatically, and the sentence gets a
  capital letter and a full stop.
- `labels` (optional) sets the small caption shown under each word.
- `lang` (optional) is the language of the theme: `"en"` when missing. The
  language menu in the top bar lists the languages that have a theme, and
  shows only the themes of the language in use. The language also picks the
  grammar fix-up (below) and the system voice that reads the subject. A theme
  in a language the interface has no strings for still works: the interface
  stays in English.

### Themes with several structures

Instead of `structure`, a theme can list `structures`, written as text. Every
roll draws one of them, then fills its slots. This is how Chimera works:

```json
{
  "format": "3ch-theme/2",
  "id": "chimera",
  "name": "Chimera",
  "structures": [
    "a {adj} {being} {vt} a {adj} {being} {setting}",
    "while a {being} {vi}, a {adj} {being} {vt} the {part.pl} of a {being}"
  ],
  "lists": {
    "being": [{ "text": "werewolf", "pl": "werewolves" }, { "text": "zombie", "pl": "zombies" }],
    "vt": [{ "text": "devours", "base": "devour", "ing": "devouring" }]
  }
}
```

- `{list}` draws a word from `list`. `{list.form}` shows one form of that word:
  the entry must have that field (`"pl"`, `"base"`, `"ing"`… any name works).
  Every form is written in the JSON: the app knows no English grammar besides
  `a` / `an`.
- A slot keeps the entry, not the form. A locked word can move to a slot that
  wants another form ("werewolves" becomes "werewolf").
- `,` `;` `:` stick to the word before them.
- When the shape changes, a locked word moves to the first slot of the same
  list. Only structures with room for every locked word are drawn.

### Languages with genders

A language like French needs more than forms: an adjective follows the gender
and the number of its noun. Three markers in a structure link the words:

```json
{
  "format": "3ch-theme/2",
  "id": "chimera-fr",
  "name": "Chimère",
  "lang": "fr",
  "source": "translated",
  "structures": [
    "[un|une@a] {being#a} {adj@a} {vt} [le|la@b] {being#b}",
    "des {being.pl#a} {adj@a} {vi.pl} près de le {place}"
  ],
  "lists": {
    "being": [
      { "text": "loup", "pl": "loups", "g": "m" },
      { "text": "sorcière", "pl": "sorcières", "g": "f" }
    ],
    "adj": [
      { "text": "vert", "f": "verte", "pl": "verts", "fpl": "vertes" },
      "en bois"
    ],
    "vt": [{ "text": "dévore", "pl": "dévorent" }],
    "vi": [{ "text": "dort", "pl": "dorment" }],
    "place": [{ "text": "marais", "pl": "marais" }]
  }
}
```

- `{being#a}` names the slot `a`. Every entry of that list needs a gender,
  `"g": "m"` or `"g": "f"`. The slot passes on that gender, and its number:
  plural when the slot shows the `pl` form (`{being.pl#a}`). A name can be
  used by one slot only.
- `{adj@a}` shows the form of the word that agrees with slot `a`: `text` for
  masculine singular, `f`, `pl` or `fpl` (feminine plural). An entry that is
  an object needs `f`, `pl` and `fpl`. A string entry never changes ("en
  bois").
- `[un|une@a]` is a fixed word, the first one after a masculine slot `a` and
  the second one after a feminine one. Use it for articles and for the
  adjectives and participles that are written in the structure.
- A slot takes a form (`.pl`) or agrees (`@a`), not both.
- The agreement is worked out at render time from the entry the slot holds.
  Reroll or lock a noun, or move it to another shape, and the words that agree
  with it follow its gender and number.
- Validation reports a missing gender, a missing form, an `@` with no matching
  `#`, or a `[masc|fem]` without `@`.

After the words are chosen, the French fix-up cleans the sentence. Structures
are written with the plain words ("de le", "le arbre"), and the fix-up does the
rest:

- Elision: `le`, `la`, `de`, `que`, `ne`, `se`, `me`, `te`, `je`, `jusque`,
  `lorsque` and `puisque` before a vowel or a silent h ("le arbre" becomes
  "l'arbre", "de huile" becomes "d'huile"). `ce` becomes `cet`, `ma` / `ta` /
  `sa` become `mon` / `ton` / `son`, and `si il` becomes `s'il`.
- Contractions, after the elision: `de le` becomes `du`, `à le` becomes
  `au`, `de les` becomes `des`, `à les` becomes `aux`. So `près de le {place}`
  gives "près du marais" or "près de l'étang".
- H aspiré: a word that starts with an aspirated h keeps its article ("le
  hibou", "de hiboux", "au héros"). The list of those words is in
  `renderer/generator.js` (`elides()` tells which is which). When a theme uses
  a h aspiré word that the list does not know, add its start to the list.

`themes/chimera.json` is written by hand, not generated from `../Legacy`. Its
lists were sorted from the legacy lists by role (`being`, `object`, `part`,
`place`, `setting`, `adj`, `vt` for verbs with an object, `vi` for verbs
without one), with the English typos fixed. The `vi` verbs are new: the legacy
lists had only one.

The bundled themes live in `themes/`. Each one exists in English and French
(`chimera.json`, `chimera-fr.json`...). Your own themes go in the folder opened
by **Themes folder** (`%APPDATA%\3CH\themes` on Windows,
`~/Library/Application Support/3CH/themes` on macOS). A theme there with the
same `id` as a bundled one replaces it.

The six French themes (`themes/<id>-fr.json`, `"lang": "fr"`, `"source":
"translated"`) are written by hand like Chimera. Each has the same list names
as its English twin, which is how the language menu finds the same theme in the
other language (`chimera` and `chimera-fr`). Rules the French themes follow:
adjectives come after the noun and agree with it, a structure never writes
`de les` before a verb (the fix-up would turn it into `des`), and `;` and `:` are not used.

### Legacy themes

**Import legacy theme** converts a v1 folder (`structure.txt` plus one
comma-separated `.txt` per slot). You can pick a single theme folder or a parent
holding several, up to four levels down (unreadable folders are skipped).

The conversion keeps the original data and odds, and fixes the v1 parsing bugs:
Windows-1252 accents, missing commas, `;` typed instead of `,`, and accidental
empty entries. Duplicate entries become weights.

The five bundled legacy themes started from that conversion of `../Legacy`,
then were rewritten by hand (`"source": "legacy-reworked"`): the 2005 words and
weights in typed lists, the spelling fixed, 31 to 34 structures each, and new
words added at weight 1 (things a concept artist can draw). The
2005 versions can still be brought back with **Import legacy theme** on the
matching `../Legacy` folder. `npm run convert-legacy` writes the plain
conversion to `themes/`, but skips any file whose `source` is not `legacy`, so
it leaves the reworked themes alone.

## Development

```bash
npm install
npm start          # run the app
npm test           # unit tests (generator, timer, voice, announcer, i18n, themes, legacy conversion)
npm run dist:win   # Windows installer + portable exe in dist/
npm run dist:mac   # universal macOS .dmg in dist/ (on a Mac)
npm run sample -- themes/chimera-fr.json 4   # proofread a theme (see below)
npm run icon       # regenerate build/icon.png, build/icon.ico, renderer/logo.png
npm run logo       # same, plus the README header ../docs/logo.gif
```

`npm run sample -- <theme.json> [n]` is for people who write themes. It
validates the theme, then prints `n` subjects (4 by default) for every
structure, so you can read them. A French theme also gets the elision checks of
the tests: a sentence with a missing elision or contraction is flagged with
`!!`, and the script exits with an error. It ends with the words that start
with an h, split into elided and h aspiré, so you can spot a wrong one, then
duplicate entries, the number of structures and the count of combinations.

CI (`.github/workflows/build.yml`) runs the tests and builds both platforms on
every push. A `v*` tag also publishes a GitHub Release, with the matching
[CHANGELOG](../CHANGELOG.md) section as its notes.

- `main.js`: window and file system access (themes, import, export, clipboard),
  timer taskbar progress and notification, mini mode
- `preload.js`: the small API the page can call (`window.ch3`)
- `renderer/generator.js`: generation logic, shared with the tests
- `renderer/app.js`, `index.html`, `styles.css`: the interface
- `renderer/i18n.js`: the interface strings per language (`data-i18n`
  attributes in `index.html`), the language list and the subject counts
  ("12 billion", "12 milliards"), shared with the main process and the tests
- `renderer/timer.js`: speed painting countdown, shared with the tests
- `renderer/voice.js`: robot voice DSP (vocoder, glitches), shared with the tests
- `renderer/announcer.js`: what the timer voice says and when (lines in
  every language, milestones, countdown), shared with the tests
- `src/speech.js`: text to WAV with a system voice of the right language
  (SAPI through one long-lived PowerShell process on Windows, `say` on macOS)
- `src/legacy.js`: v1 → v2 theme conversion
- `src/themes.js`: loads bundled and user themes
- `scripts/`: legacy conversion, `sample-theme.js` to proofread a theme, and `make-logo.py` for the logo, the icons and
  the README GIF (Python 3 with numpy and Pillow, the Windows fonts Impact and
  Ink Free, and ffmpeg for the GIF)
