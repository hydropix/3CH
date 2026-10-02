# Credits

## Original 3CH team (2005–2007)

The original *3CH kilogeneratormorphic* app and its word lists were made by:

- **Hydropix**
- **Vyle**
- **Viag**
- **Sparth**
- **BARoNTiERi**

This is the credit line of the original app.

Their work is in:

- [`Legacy/`](Legacy): the original app and its word lists, unchanged. This
  covers the Fantasy, Urban, Hollywood action, Darwin and Constructor themes.
- [`app/themes/`](app/themes): the same word lists converted to the v2 format.
  The words and their odds are unchanged; only the file format and the v1
  parsing bugs were fixed.

If you reuse these word lists, please keep this credit with them.

## 3CH v2 (2026)

The Electron rebuild in [`app/`](app) is by **Hydropix**.

## Voices

The voices that read the subjects are [Piper](https://github.com/rhasspy/piper)
models, run by [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)
(Apache 2.0) with [ONNX Runtime](https://github.com/microsoft/onnxruntime)
(MIT) and [eSpeak NG](https://github.com/espeak-ng/espeak-ng) (GPL 3.0) for
the pronunciation:

- English: `en_US-ljspeech-medium`, trained on the
  [LJ Speech dataset](https://keithito.com/LJ-Speech-Dataset/) (public domain).
- French: `fr_FR-siwis-medium`, trained on the
  [SIWIS French Speech Synthesis Database](https://datashare.ed.ac.uk/handle/10283/2353)
  by the University of Edinburgh and partners
  ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)).
- Chinese: `zh_CN-chaowen-medium`, trained on the 超文 (chaowen) voice of
  [OHF-Voice/voice-datasets](https://github.com/OHF-Voice/voice-datasets) (CC0).

## Contact

If you are one of the original authors and would like your work credited
differently, or removed, please [open an issue](https://github.com/hydropix/3CH/issues).
