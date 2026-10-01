# Changelog

Each `## [x.y.z]` section is used as the GitHub release notes for tag `vx.y.z`.

## [2.7.0] - 2026-10-01

### Changed
- **The robot voice sings.** Every reading draws a key (pentatonic, dorian,
  phrygian, whole tone...), a tempo and a tune: a melody, sometimes with
  harmony voices, slides and vibrato, still broken but in tune.
- The words rush and drag without leaving the key, and the glitches fall on
  the beat: rolls, frozen notes, gates, octave jumps, rests, sometimes a
  metallic resonance or an echo in time.
- The timer countdown is sung down a scale, 10 to 1, and lands on the root.

## [2.6.0] - 2026-10-01

This release also ships 2.5.0, which was not published on its own: about
twice as many words in every theme, and words that almost never repeat
within 50 subjects (see [CHANGELOG.md](CHANGELOG.md)).

### Added
- **Chinese (中文)**: a third language in the top bar, in Simplified Chinese.
  The six themes exist in Chinese (奇美拉, 建造者, 达尔文, 奇幻, 好莱坞动作片,
  都市), with as many words as in English and 35 to 101 sentence shapes. The
  interface, the subject counts (418万亿) and the timer voice are translated.
- Every Chinese noun comes with its measure word (一只狼, 一条龙, 一座城堡),
  and the measure word follows the noun when you reroll or lock it.
- If no system voice speaks the language of the subject (a Chinese subject on
  a Windows without a Chinese voice), 3CH says so once instead of staying
  silent. Windows: Settings → Time & language → Speech → Add voices.
- For theme authors: `[.field@a]` shows a field of the word in slot `a` (the
  measure word in Chinese), and `npm run sample` checks Chinese themes.

### Changed
- The robot voice picks the main voice of a language first (zh-CN before
  zh-HK or zh-TW, fr-FR before fr-CA).
- Subject counts such as 9.97 million now read "10 million", not "10.0
  million".

## [2.5.0] - 2026-10-01

### Added
- **About twice as many words** in every theme, in English and in French:
  Chimera goes from about 1,140 to 1,950 words, the other themes from 400-750
  to 950-1,390. The new words keep the spirit of the lists: creatures,
  objects, places, materials, traits and actions you can draw, as weird and
  spectacular as the originals.

### Changed
- **Repetitions are rare.** 3CH remembers the words it has drawn in each list
  and keeps them aside until three quarters of the list has come up, so a word
  almost never comes back within 50 subjects. Sentence shapes are drawn the
  same way. The weights of the lists still apply, and the memory is kept for
  each theme between sessions.
- A few entries from 2005 were replaced: franchise names (a Jedi knight, a
  famous giant robot, a caped superhero, a sportswear brand), people named by
  their origin, a "Nazi" adjective and "very fat guy".

## [2.4.0] - 2026-10-01

### Added
- **3CH speaks French.** A language menu in the top bar switches between
  **English** and **Français**. It changes the themes, the interface and the
  voice, and 3CH remembers your choice. On the first launch it follows the
  language of your system. Switching keeps the same theme in the other
  language, and bringing back a subject from the history switches the language
  when it needs to.
- **Six French themes**: Chimère, Constructeur, Darwin, Fantasy, Action
  hollywoodienne and Urbain, with their sentence shapes rewritten for French.
  Words agree like in real French ("une sorcière verte", "des yeux verts"),
  and the sentence is fixed up afterwards: "le arbre" becomes "l'arbre", "de le"
  becomes "du", "à les" becomes "aux".
- **The robot voice speaks French.** The subject is read in the language of its
  theme, with a voice of that language when the system has one. The timer
  voice has its own French lines, with the same passive-aggressive tone.
- Themes can say their language (`"lang"`) and link words so that adjectives and
  articles agree with the noun (`{being#a}`, `{adj@a}`, `[un|une@a]`). See
  [app/README.md](app/README.md).
- `npm run sample -- themes/x.json` validates a theme and prints sample
  subjects for every structure, to proofread a theme you write.

### Changed
- The whole interface, the dialogs and the notifications follow the language.
- For French speech on Windows, install a French voice (Settings, Time &
  language, Speech). Without one, the default voice reads the French text. On
  macOS, 3CH picks a French voice from the ones installed.

## [2.3.0] - 2026-09-30

### Added
- **A broken robot voice** reads every new subject aloud as soon as it is
  rolled: the system's own voice, vocoded, stuttering and glitching
  differently every time. Moving on to another subject cuts it off.
  **Auto voice** (`Shift` + `V`) turns it off, **Speak** (`V`) replays it.
- **The timer talks** with the same voice, like a passive-aggressive lab AI:
  it announces the time left, puts on the pressure, counts down from 10 and
  calls the end. The sound button mutes it with the other alerts.
- A very soft tick on every minute of a timer session.

## [2.2.0] - 2026-09-30

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
- Every bundled theme has a larger vocabulary (about 1,400 new words in all),
  chosen to be easy to draw: new creatures and characters (axolotl, plague
  doctor, luchador...), odd objects (grandfather clock, diving helmet, snow
  globe...), body parts, places, materials (rammed earth, mother-of-pearl...),
  visual traits, actions, settings and camera shots ("(extreme close-up)",
  "(backlit by an explosion)"...).
- Words that read badly on a person were changed: "white" and "black" became
  "ghost-white", "snow-white", "jet-black", "white-clad" or "black-clad"
  depending on the theme, and "transvestite", "native Indian" and "gypsy"
  became "drag queen", "Native American" and "Romani woman". "midget" became
  "pygmy", and "crippling" (a place) became "crumbling".
- The subject stays on one line when it fits: the words shrink a little (down
  to 70%, 80% in the mini window) instead of wrapping. Longer subjects still
  wrap at full size.
- History is now on the left and Selected on the right.

### Fixed
- Chimera: proper nouns ("Viking", "Jedi knight", "UFO"...) are capitalised
  in the middle of a subject.
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
