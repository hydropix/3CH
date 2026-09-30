# 3CH: notes for Claude

The user is **Hydropix**, one of the original 3CH authors, and owns
github.com/hydropix/3CH. They write in French: answer in French. The app UI, the
code, the comments and the docs are in English.

## What this is

A random subject generator for concept art and speed painting, with a speed
painting timer. `app/` is a 2026 Electron rebuild of a 2005 .NET 1.1 WinForms
app, which is kept byte for byte in `Legacy/`.

- `README.md`: user-facing (download buttons, features, shortcuts, release steps)
- `app/README.md`: theme JSON format, code map, dev commands
- `CHANGELOG.md`: one `## [x.y.z]` section per release, used as the release notes
- `CREDITS.md`: original team (Hydropix, Vyle, Viag, Sparth, BARoNTiERi)

## Commands (run in `app/`)

```bash
npm install
npm start
npm test                 # node:test: generator, timer, themes, legacy parser (22 tests)
npm run dist:win         # dist/3CH-Setup.exe + dist/3CH-Portable.exe
npm run dist:mac         # dist/3CH-mac.dmg (universal, needs a Mac)
npm run convert-legacy   # ../Legacy -> JSON; skips the hand-reworked themes
npm run icon             # build/icon.png + icon.ico + renderer/logo.png (Python)
npm run logo             # same, plus docs/logo.gif (needs ffmpeg)
```

## Releasing

1. `npm version 2.x.y --no-git-tag-version` in `app/`.
2. Add a `## [2.x.y]` section to `CHANGELOG.md`.
3. Commit, then `git tag v2.x.y && git push origin main v2.x.y`.

`.github/workflows/build.yml` then runs the tests, builds Windows and macOS, and
publishes the release. The artifact names (`3CH-Setup.exe`, `3CH-Portable.exe`,
`3CH-mac.dmg`) are fixed on purpose: the README buttons link to
`releases/latest/download/<name>`. Do not rename them.

## Things that bit us

- **The lockfile must list every platform's optional deps.** After adding a
  dependency on Windows, `npm ci` failed on Linux and macOS CI ("Missing:
  @electron/windows-sign... from lock file"). The fix is to regenerate
  `package-lock.json` from scratch: `npm install --package-lock-only` in an empty
  folder that only holds `package.json`, then copy the lockfile back.
- **The CSP (`style-src 'self'`) blocks inline `style` attributes.** Set styles
  through CSSOM (`el.style.setProperty`) instead. `el()` in `app.js` handles a
  `style` object that way.
- `renderer/generator.js` and `renderer/timer.js` are UMD-style classic scripts:
  `window.Generator` / `window.Timer` in the page, `module.exports` in Node for
  the tests. Keep them free of DOM and Electron code.
- `themes/chimera.json` is hand-written (99 `structures`, lists sorted by
  grammatical role, every noun and verb form spelled out). The five legacy
  themes were reworked the same way (`"source": "legacy-reworked"`): the 2005
  words and weights, typos fixed, 31 to 34 structures, plus new words at
  weight 1. New words must be drawable: concrete creatures, objects, places,
  materials and visual traits, not abstract ideas. They are hand-edited
  sources now; their one-off build scripts were not kept. Adjectives such as
  "white" or "black" are avoided on beings, since they read as skin colour.
  `convert-legacy` skips any existing file whose `source` is not `legacy`. A
  slot stores the entry (`raw`), the form is applied at render time by
  `inflect()`.
- A local LLM mode (node-llama-cpp, Qwen 1.5B) was prototyped and dropped:
  asked to write or to be "wild", the model drifts back to plausible, clichéd
  associations or breaks the grammar. The LLM is only useful offline (writing
  structures, sorting and inflecting the lexicon), never at runtime.
- `Legacy/**` is `-text` in `.gitattributes`: the original files are
  Windows-1252 with CRLF and must not be normalised.
- `backgroundThrottling: false` keeps the timer exact while the window is hidden.
- On Windows, the mini window's always-on-top flag was once lost; `main.js`
  re-asserts it on `blur` and `always-on-top-changed`.
- The UI is dark only, matched to the logo (black, hot pink `#FF2E7A`, neon
  glow). `scripts/make-logo.py` draws the mascot; `build/icon.ico` uses a
  simplified face for 16-48 px, since the full mascot is unreadable there.
- Builds are unsigned (Windows) and ad-hoc signed (macOS, `identity: "-"`). The
  README explains the SmartScreen and Gatekeeper steps. The macOS build has
  never been run on a real Mac.

## Open points

- The public commits use the user's personal e-mail. Rewriting the history would
  need a force-push: ask before doing it.
- The co-authors have not been asked to agree to the MIT license for the word
  lists. They are credited in `CREDITS.md`.
- Ideas not started: fixing the English typos in the legacy-derived word lists
  ("trough", "menacant"...; Chimera's lists are already fixed), a French
  Chimera (needs gender and agreement links between slots), an in-app theme editor, linking timer sessions to the
  history, code signing.
