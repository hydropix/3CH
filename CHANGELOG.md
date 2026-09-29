# Changelog

Each `## [x.y.z]` section is used as the GitHub release notes for tag `vx.y.z`.

## [Unreleased]

### Changed
- New logo and icon: the old die is now a neon mascot on a hot pink paint splat.
- The interface is dark only and matches the logo: black, hot pink accents and
  a neon glow.

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
