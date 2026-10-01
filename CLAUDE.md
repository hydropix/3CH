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
npm test                 # node:test: generator, timer, voice, announcer, i18n, themes, legacy parser (53 tests)
npm run dist:win         # dist/3CH-Setup.exe + dist/3CH-Portable.exe
npm run dist:mac         # dist/3CH-mac.dmg (universal, needs a Mac)
npm run convert-legacy   # ../Legacy -> JSON; skips the hand-reworked themes
npm run sample -- themes/chimera-fr.json 4   # validate a theme, print 4 subjects per structure (proofreading)
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
- `renderer/generator.js`, `renderer/timer.js`, `renderer/voice.js` and
  `renderer/announcer.js` are UMD-style classic scripts: `window.Generator` /
  `window.Timer` / `window.Voice` / `window.Announcer` in the page, `module.exports` in Node for the tests. Keep them free of DOM and Electron code.
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
- **Anti-repetition memory**: a pure random draw reused a word from the last
  10 subjects in 20% (Chimera) to 60% (Darwin, Urban) of the rolls. The
  generator now takes a `memory` (`createMemory()`, plain data saved in
  `localStorage` as `3ch.memory`, per theme id): a word, or a structure, is
  avoided until 75% of its list has been drawn since (`RECENT_SHARE`). Empty
  entries keep their original share of the draw.
- **Lexicon enrichment** (after 2.4.0): every list of every theme roughly
  doubled, EN and FR together (Chimera ~1140 to ~1945 entries, the others to
  950-1390), written by parallel subagents, then validated and proofread with
  `npm run sample`. With the memory, words now almost never repeat within 50
  subjects; the 31 to 36 structures of the legacy-reworked themes are the next
  limit (Chimera has 99).
- A local LLM mode (node-llama-cpp, Qwen 1.5B) was prototyped and dropped:
  asked to write or to be "wild", the model drifts back to plausible, clichéd
  associations or breaks the grammar. The LLM is only useful offline (writing
  structures, sorting and inflecting the lexicon), never at runtime.
- **Multilingual** (2.4.0): a theme has a `lang` field (`"en"` when missing;
  the legacy conversion writes `"en"`). The language menu in the top bar picks
  the themes shown, the UI strings (`renderer/i18n.js`) and the voices: the
  subject voice follows the theme language, the timer voice the UI language.
  The French themes are hand-edited sources (`"source": "translated"`) with
  `-fr` ids (`chimera-fr`) and the same list names as the English twin, which
  is how switching language finds the same theme. The agreement syntax lives in
  `generator.js`: `{list#a}` names a slot (entries need `"g"`), `{list@a}` takes
  the form that agrees (`text`/`f`/`pl`/`fpl`), `[masc|fem@a]` is a fixed word
  chosen by the gender of slot a. `render(parts, lang)` then does the French
  fix-up (elision with an h aspiré list, contractions); `npm run sample` and
  the tests catch what it misses. French rules we follow: adjectives go after
  the noun only (no pre-noun adjective handling), never `de les` before a verb
  (it would become "des"), no `;` or `:`, and a being with a complement makes
  the following adjective ambiguous ("un loup couvert d'écailles vert": which
  one is green?).
- **Chinese** (2.6.0): six Simplified Chinese twins (`-zh`, `"source":
  "translated"`), written by parallel subagents from a shared spec, then
  proofread with `npm run sample`. A noun entry holds its measure word
  (`{ "text": "狼", "mw": "只" }`) and `[.mw@a]` reads that field from slot a
  at render time (any field name works; a slot read only that way needs no
  gender; Chimera's places also have `loc`, 里 or 上, read as
  `在{place#p}[.loc@p]`). `render(parts, 'zh')` joins without spaces and ends
  with `。`. Entries are looked up by `text`, so two entries with the same text
  cannot carry different fields. No Latin letters in Chinese themes, except
  the 2005 team names in Urban (Viag, Rainart, BARoNTiERi, Vyle, Feerik), kept
  on purpose; the sample script and the tests allow those.
  Adjectives carry their `的` so an empty entry leaves no lone `的`; Darwin and
  Constructor also need predicate adjectives, so their `adj` entries have a
  `bare` form. Settings go before the verb, never at the end. The UI strings
  are in `i18n.js` (`formatCombos` counts in 万 / 亿), the timer lines in
  `announcer.js`. With no Chinese system voice, SAPI renders an empty WAV
  (Hortense reads nothing): the app shows `noVoiceLang` once per language.
  `speech.js` prefers the main culture (zh-CN before zh-HK / zh-TW).
- **Robot voice** (auto on by default, `V` replays, `Shift`+`V` toggles auto):
  `speechSynthesis` cannot be routed into Web Audio, so the main process
  renders the system voice to a WAV (`src/speech.js`, one voice per language:
  on Windows the first enabled SAPI voice of the culture, else the default
  voice; on macOS a preferred `say` voice, else the first of the locale, else
  the default, untested on a real Mac) and `renderer/voice.js` breaks it in JS.
  It sings rather than glitches at random: `compose()` draws a style per
  playback (scale, root, tempo, melody contour, harmony voices, glides,
  vibrato, rubato, tuned comb, echo on the beat), the speech is sped up and
  slowed down *before* the vocoder (formants move, the pitch stays in key),
  and the glitches are cut on a sixteenth-note grid and keep whole steps
  (rolls climbing the harmonic series, grains frozen at a note's period,
  gates, octave shifts, rests). The dry speech comes back only high-passed,
  for the consonants, since its own pitch is out of key. The countdown
  shares one style and walks down the scale to the root at 1.
  On Windows one PowerShell process stays alive, warmed up at launch: one
  process per sentence cost ~1 s, a sentence now takes 20-80 ms. Only the latest request waits
  (older ones resolve to null), and a new sentence cuts the voice off. The
  recording is cached per sentence; the glitches are redrawn every time.
- **Timer voice**: `renderer/announcer.js` holds the lines (original ones in
  the tone of a passive-aggressive lab AI; no Portal quotes or names) and the
  marks. A session draws its lines at start and renders them ahead
  (`speakLine`, which queues instead of keeping only the latest). The 10 to 1
  countdown is scheduled on the AudioContext clock at 11.5 s left. The timer
  voice cuts the subject voice off; the subject is read again afterwards.
  Muted by the sound alerts button.
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
  ("trough", "menacant"...; Chimera's lists are already fixed), an in-app
  theme editor, linking timer sessions to the history, code signing.
