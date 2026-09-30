---
name: launch
description: Launch the 3CH Electron app from app/ and, when a change needs checking, drive it (click, keys, read the DOM, screenshot) over the DevTools protocol. Use when asked to run, start, launch or screenshot 3CH, or to confirm a UI change works in the real app rather than only in the tests.
---

# Launch 3CH

The app lives in `app/`. Every command below runs from there.

## 1. Dependencies

If `app/node_modules/.bin/electron` is missing, run `npm install` first.
Run `npm test` when the change touched `generator.js`, `timer.js`, `src/` or a
theme JSON: it is fast and catches most breakage before the window opens.

## 2. Just open it for the user

```bash
npm start
```

Run it in the background (Bash `run_in_background`), since Electron keeps the
shell busy until the window is closed. The user's own data (history, selected
subjects, user themes) is used, as in a normal run.

## 3. Open it to check a change yourself

Start it with a debugging port and a throwaway profile, so the checks never
touch the user's history, selected list or imported themes:

```bash
npx electron . --remote-debugging-port=9222 --user-data-dir="$TEMP/3ch-dev"
```

(also in the background; on macOS or Linux use `"${TMPDIR:-/tmp}/3ch-dev"`).
Then drive it with `.claude/skills/launch/drive.mjs` (Node 22+):

```bash
node ../.claude/skills/launch/drive.mjs wait                    # page loaded
node ../.claude/skills/launch/drive.mjs eval "document.querySelector('#subject').innerText"
node ../.claude/skills/launch/drive.mjs click "#generateBtn"
node ../.claude/skills/launch/drive.mjs key Space               # app shortcuts: Space, Enter, C, U, S, T, R, M, 1-9, Escape...
node ../.claude/skills/launch/drive.mjs shot "$TEMP/3ch.png"    # then Read the PNG to look at it
node ../.claude/skills/launch/drive.mjs quit
```

`CDP_PORT` changes the port if 9222 is taken. Always `quit` when done, wait a
few seconds for the Electron processes to exit (the profile stays locked until
then), and delete the throwaway profile and screenshots.

Keys go through `Input.dispatchKeyEvent` with both `key` and `code`, since the
app reads `e.code` for Space and the digits. Some shortcuts depend on state:
Enter (Keep) only works once a subject is on screen, and switching theme
clears it.

Useful ids in `renderer/index.html`: `#themes` (theme tabs), `#subject`,
`#generateBtn`, `#keepBtn`, `#copyBtn`, `#reshapeBtn`, `#timerClock`,
`#timerStartBtn`, `#miniBtn`, `#selectedList`, `#historyList`, `#toast`.

## Limits

- Native dialogs (legacy import, export .txt) block the page: do not trigger
  them while driving, or ask the user to handle the dialog.
- Mini mode resizes the real window; the screenshot then shows the mini layout.
- The CSP blocks inline styles, but `eval` through CDP is not affected by it.
- Launching `dist/` builds is out of scope here: see the release steps in
  `CLAUDE.md`.
