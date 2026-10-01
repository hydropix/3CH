https://github.com/user-attachments/assets/6ad86c5e-5fcb-4526-ba17-81c438e555da

<p align="center">
  <b>Random subject generator for concept art and speed painting</b><br>
  with a built-in speed painting timer
</p>

<p align="center">
  <a href="https://github.com/hydropix/3CH/actions/workflows/build.yml"><img src="https://github.com/hydropix/3CH/actions/workflows/build.yml/badge.svg" alt="Build status"></a>
  <a href="https://github.com/hydropix/3CH/releases/latest"><img src="https://img.shields.io/github/v/release/hydropix/3CH?label=latest%20release" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/hydropix/3CH" alt="MIT license"></a>
</p>

## ⬇️ Download

<p align="center">
  <a href="https://github.com/hydropix/3CH/releases/latest/download/3CH-Setup.exe"><img src="docs/download-windows.svg" width="344" alt="Download for Windows"></a>
  &nbsp;
  <a href="https://github.com/hydropix/3CH/releases/latest/download/3CH-mac.dmg"><img src="docs/download-macos.svg" width="344" alt="Download for macOS"></a>
</p>

<p align="center">
  No install on Windows? Get the <a href="https://github.com/hydropix/3CH/releases/latest/download/3CH-Portable.exe"><b>portable version</b></a>, which runs from anywhere, even a USB stick.<br>
  <sub>The buttons always download the latest version. See every version on the <a href="https://github.com/hydropix/3CH/releases">Releases page</a>. The builds are made automatically by GitHub Actions from this repository.</sub>
</p>

<details>
<summary><b>First launch: "Windows protected your PC" / "Apple could not verify 3CH"</b></summary>

The builds are not signed with a paid code-signing certificate, so the system warns
you the first time.

- **Windows**: in the SmartScreen dialog, click **More info**, then **Run anyway**.
- **macOS**: open the `.dmg` and drag 3CH into **Applications**. Try to open it
  once, then go to **System Settings → Privacy & Security** and click
  **Open Anyway** next to the 3CH message. Or, in Terminal:
  ```bash
  xattr -dr com.apple.quarantine /Applications/3CH.app
  ```
</details>

<p align="center">
  <img src="docs/screenshot.png" width="880" alt="3CH main window">
</p>



## What it does

Press **Space** and 3CH gives you a subject to paint:

> *A tight altar area with protruding radiating pillars and bumpy translucent platforms.*

> *A headless frog crosses iron with a chameleon in a field of meteorites.*

> *While a wild boar crashes to pieces, a nauseous old god dissects the tentacles of a penguin.*

It also speaks French:

> *Une mouche abyssale jaillit d'une idole sur la tombe d'un géant.*

- **English and French**: pick the language in the top bar (**English** /
  **Français**). It changes the themes, the interface and the voice at once,
  and your choice is saved. The first time, 3CH follows the language of your
  system. Switching keeps the same theme in the other language. In French,
  adjectives and articles agree with the noun ("une plante carnivore
  minuscule"), and "le arbre" becomes "l'arbre".
- **6 themes** in each language: Fantasy, Urban, Hollywood action, Darwin
  (creatures), Constructor (environments) and Chimera.
- **Every roll changes the shape of the sentence**, not only the words: over
  30 sentence shapes per theme, 99 for Chimera, which mixes the words of every
  theme so nothing makes sense except the grammar. Locked words follow into the
  next shape, **Reshape** keeps the words and changes the shape, and **Lock
  shape** keeps the shape.
- **Click a word to reroll only that word**, or lock it to keep it while
  everything else changes.
- **Keep** the subjects you like. They stay saved, and you can copy them or export
  them to a `.txt` file. The last 100 rolls are in the history.
- **A broken robot voice** reads the subject aloud: the system's own voice,
  vocoded, stuttering and glitching differently every time. **Speak** reads it,
  **Auto voice** (on by default) reads every new subject as soon as it is
  rolled. It reads the subject in the language of its theme. For French
  speech, install a French voice in Windows (Settings → Time & language →
  Speech); without one, the default voice reads the French text.
- **Speed painting timer** (5 to 60 min, or any length up to 4 hours):
  - The time left shows in the taskbar.
  - A very soft tick on every minute, a beep for the last one, and a chime
    plus a notification at the end.
  - The same robot voice runs the session like a passive-aggressive lab AI:
    it announces the time left, puts on the pressure, counts down from 10 and
    calls the end, in the language of the interface. The sound button mutes
    it with the other alerts.
- **Mini mode**: a small always-on-top window with just the subject and the
  clock, so they stay in sight over Photoshop, Krita or Procreate.

<p align="center">
  <img src="docs/mini.png" width="480" alt="Mini mode">
</p>

### Shortcuts

| Action | Key |
|---|---|
| New subject | `Space` |
| Reroll word 1 to 9 / lock it | `1`–`9` / `Shift` + `1`–`9` |
| Keep / copy the subject | `Enter` / `C` |
| Read the subject aloud / auto voice on or off | `V` / `Shift` + `V` |
| Unlock every word | `U` |
| New sentence shape, same words | `S` |
| Previous / next theme | `←` `→` |
| Start or pause the timer / reset it | `T` / `R` |
| Mini window / leave it | `M` / `Esc` |

## Make your own themes

A theme is a small JSON file: the sentence structure plus word lists, with
optional weights, or several structures like the bundled themes. A theme
says its language (`"lang": "fr"`) and shows up under that language in the
top bar. Themes in a language with genders can link words so that adjectives
and articles agree with the noun. Drop it in the folder opened by
**Themes folder**, or use **Import legacy theme** to convert a theme folder
from the original 2005 app. See [app/README.md](app/README.md) for the format.

## Build from source

```bash
cd app
npm install
npm start          # run
npm test           # tests
npm run dist:win   # build Windows installers into app/dist
npm run dist:mac   # build the macOS .dmg (on a Mac)
```

To publish a new version:
1. Bump `version` in `app/package.json` (`npm version 2.x.y --no-git-tag-version` in `app/`).
2. Add a `## [2.x.y]` section to [CHANGELOG.md](CHANGELOG.md). It becomes the release notes.
3. Commit, then tag and push. GitHub Actions builds both platforms and attaches them to a new release:

```bash
git tag v2.x.y
git push origin v2.x.y
```

## History

3CH, the *kilogeneratormorphic*, started in 2005 as a small .NET tool shared
between concept artists. The original app and its word lists are kept as they
were in [`Legacy/`](Legacy). Version 2 is a rebuild with the same themes. It
fixes the original data-parsing bugs and adds rerolling and locking single
words, kept subjects, the timer and mini mode.

**Original credits:** Hydropix, Vyle, Viag, Sparth, BARoNTiERi. They wrote the
original app and all the word lists that the themes are built from. See
[CREDITS.md](CREDITS.md).

## License

[MIT](LICENSE) © Hydropix and the 3CH contributors. The word lists (in `Legacy/`
and `app/themes/`) are by the original 3CH team: please keep their credit when
you reuse them ([CREDITS.md](CREDITS.md)).
