# 3CH v1 (2005–2007)

This folder holds the original *3CH kilogeneratormorphic v1.0* files, byte for
byte as they were shared:

- `3CH/`: the app (.NET Framework 1.1) with the Fantasy and Urban themes
- `3CH - usvversion+darwin mod/`: the same app with the Hollywood action,
  Darwin and Constructor themes

Both folders contain the same `3CH.exe`. Each theme is a folder holding a
`structure.txt` (the order of the words in a sentence) and one comma-separated
word list per slot, encoded in Windows-1252.

**Credits:** Hydropix, Vyle, Viag, Sparth, BARoNTiERi (see [CREDITS.md](../CREDITS.md)).

The v2 app in [`../app`](../app) uses these themes, converted with
`npm run convert-legacy`.
