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
- An entry is a string, or `{ "text", "weight" }` to make it more likely. An
  empty `text` means "nothing here", which is useful for optional words.
- `a` / `an` agree with the next word automatically, and the sentence gets a
  capital letter and a full stop.
- `labels` (optional) sets the small caption shown under each word.

The bundled themes live in `themes/`. Your own themes go in the folder opened
by **Themes folder** (`%APPDATA%\3CH\themes` on Windows,
`~/Library/Application Support/3CH/themes` on macOS). A theme there with the
same `id` as a bundled one replaces it.

### Legacy themes

**Import legacy theme** converts a v1 folder (`structure.txt` plus one
comma-separated `.txt` per slot). You can pick a single theme folder or a parent
holding several. The bundled themes were generated from `../Legacy` with:

```bash
npm run convert-legacy
```

The conversion keeps the original data and odds, and fixes the v1 parsing bugs:
Windows-1252 accents, missing commas, `;` typed instead of `,`, and accidental
empty entries. Duplicate entries become weights.

## Development

```bash
npm install
npm start          # run the app
npm test           # unit tests (generator, timer, legacy conversion)
npm run dist:win   # Windows installer + portable exe in dist/
npm run dist:mac   # universal macOS .dmg in dist/ (on a Mac)
npm run icon       # regenerate build/icon.png, build/icon.ico, renderer/logo.png
npm run logo       # same, plus the README header ../docs/logo.gif
```

CI (`.github/workflows/build.yml`) runs the tests and builds both platforms on
every push. A `v*` tag also publishes a GitHub Release, with the matching
[CHANGELOG](../CHANGELOG.md) section as its notes.

- `main.js`: window and file system access (themes, import, export, clipboard),
  timer taskbar progress and notification, mini mode
- `preload.js`: the small API the page can call (`window.ch3`)
- `renderer/generator.js`: generation logic, shared with the tests
- `renderer/app.js`, `index.html`, `styles.css`: the interface
- `renderer/timer.js`: speed painting countdown, shared with the tests
- `src/legacy.js`: v1 → v2 theme conversion
- `src/themes.js`: loads bundled and user themes
- `scripts/`: legacy conversion, and `make-logo.py` for the logo, the icons and
  the README GIF (Python 3 with numpy and Pillow, the Windows fonts Impact and
  Ink Free, and ffmpeg for the GIF)
