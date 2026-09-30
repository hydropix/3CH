# Changelog

Each `## [x.y.z]` section is used as the GitHub release notes for tag `vx.y.z`.

## [Unreleased]

### Added
- **Chimera**, a new theme that changes the shape of the sentence on every
  roll, not only the words: 99 sentence shapes, filled with creatures,
  objects, body parts, places, adjectives and actions drawn at random.
  - Locked words follow into the next shape, and take the form it needs
    (plural, "-ing"...).
  - **Reshape** (`S`) keeps the words and changes the shape. **Lock shape**
    keeps the shape, so Generate only changes the words.
- Themes can hold several structures (`structures`), with word forms such as
  `{being.pl}`. See [app/README.md](app/README.md).

### Changed
- **Fantasy** now has 32 sentence shapes instead of one, with Reshape and Lock
  shape like Chimera. It keeps its 2005 words and odds, with the English typos
  fixed ("menacant", "surpuissant", "lyche"...), plus a few fantasy objects
  (sword, grimoire, relic...) and verbs without an object (prays, howls...).
  Fantasy rolls from the history of an older version can no longer be
  restored.
- **Hollywood action** (34 shapes) and **Urban** (33 shapes) are reworked the
  same way. Hollywood action keeps its camera directions ("(fisheye lens)",
  "(looking up)"...) at the end of some shapes, and gains action-movie props
  (detonator, microfilm...). Urban gains street props (spray can, manhole
  cover...) and keeps the original team's names.
- **Darwin** (33 shapes) and **Constructor** (31 shapes) are reworked too, and
  stay design briefs: a creature's body, hunting, defence, habitat and life
  cycle; a place's structure, materials, state and point of view. Darwin gains
  habitats and behaviours, Constructor gains materials and states ("half
  flooded", "covered in scaffolding"...).
- Words that read badly on a person were changed: "white" and "black" became
  "ghost-white", "snow-white", "jet-black", "white-clad" or "black-clad"
  depending on the theme, and "transvestite", "native Indian" and "gypsy"
  became "drag queen", "Native American" and "Romani woman". "midget" became
  "pygmy", and "crippling" (a place) became "crumbling".

### Fixed
- macOS: Cmd+Q, Cmd+W and copy/paste work again. The app had no menu, and
  macOS takes these shortcuts from it.
- A hand-written theme with a bad entry (`null`, a number, a weight written as
  text, or a weight of 0 or less) is now reported when the themes load, instead
  of breaking the Generate button or skewing the odds. One invalid file no
  longer hides the other themes.
- Importing a legacy theme from a large folder no longer fails silently when a
  subfolder cannot be read: unreadable folders are skipped and counted. The
  scan stops four levels down, and errors are no longer hidden by the success
  message.

## [2.1.0] - 2026-09-29

### Changed
- New logo and icon: the old die is now a neon mascot on a hot pink paint splat.
- The interface is dark only and matches the logo: black, hot pink accents and
  a neon glow.
- The Windows icon uses a simplified face at small sizes, so it stays readable
  in the taskbar.
- README: animated logo, new screenshots and matching download buttons.

## [2.0.1] - 2026-09-29

### Added
- MIT license, and credits for the original 3CH team ([CREDITS.md](https://github.com/hydropix/3CH/blob/main/CREDITS.md)).
  Both files now ship with the app.
- Download buttons in the README, and this changelog.

### Changed
- Release notes now come from this changelog.

## [2.0.0] - 2026-09-29

First release of the rebuild of *3CH kilogeneratormorphic v1.0* (2005).

### Added
- Windows (installer and portable) and universal macOS builds.
- The 5 original themes: Fantasy, Urban, Hollywood action, Darwin and
  Constructor. They are converted to UTF-8 JSON with the same words and odds,
  and the v1 parsing bugs are fixed (accents, missing commas, stray semicolons,
  empty entries).
- Click a word to reroll only that word, or lock it between rolls.
- Automatic a/an agreement. No word appears twice in one subject.
- Kept subjects and a 100-roll history, both saved between sessions, with copy
  and `.txt` export.
- Speed painting timer:
  - Choose a preset or a custom length.
  - The time left shows in the window title and the taskbar.
  - A beep marks the last minute. At the end, a chime plays and a notification appears.
- Mini mode: a small always-on-top window with the subject and the timer.
- Import of legacy theme folders, and a user themes folder.
