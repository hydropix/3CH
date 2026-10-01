// Interface strings, one table per language, and the number formatting that
// goes with them. Shared by the page, the main process and the Node tests:
// no DOM code here. A string is either text with {name} placeholders or a
// function of the same variables (for plurals and agreement).
(function (root) {
  'use strict';

  // The languages the interface speaks, with their own names. Themes in
  // another language still work: the interface then falls back to English.
  const LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' },
  ];

  const s = (n) => (n === 1 ? '' : 's');
  // French: 0 and 1 take the singular.
  const fs = (n) => (n < 2 ? '' : 's');

  // French typography: a no-break space before ":" and inside « », a narrow
  // one before "!" and "?".
  const NBSP = ' ';
  const NNBSP = ' ';

  const STRINGS = {
    en: {
      language: 'Language',
      languageTitle: 'Language of the interface, the themes and the voice',
      importLegacy: 'Import legacy theme',
      importLegacyTitle: 'Convert a legacy theme folder (structure.txt + lists)',
      themesFolder: 'Themes folder',
      themesFolderTitle: 'Open the folder holding your own themes',
      themeTabs: 'Theme',
      combosTitle: 'Distinct subjects this theme can produce',
      possibleSubjects: ({ count }) => `possible subject${s(count)}`,
      sentenceShapes: ({ count }) => `${count} sentence shape${s(count)}`,
      mine: 'mine',
      stage: 'Subject',
      hint: 'Click a word to reroll it, lock it to keep it between rolls.',
      hintMulti: 'Every roll changes the sentence shape too. Locked words follow into the next one.',
      placeholder: 'Press Space to roll a subject',
      noTheme: 'No theme found.',
      themesNotLoaded: 'Some themes could not be loaded: {errors}',

      generate: 'Generate',
      keep: 'Keep',
      copy: 'Copy',
      speak: 'Speak',
      speakTitle: 'Read the subject aloud, with a broken robot voice (V)',
      autoVoice: 'Auto voice',
      autoVoiceTitle: 'Read every new subject aloud as soon as it is rolled (Shift+V)',
      unlockAll: 'Unlock all',
      reshape: 'Reshape',
      reshapeTitle: 'New sentence shape, keeping the words that fit (S)',
      lockShape: 'Lock shape',
      lockShapeTitle: 'Keep this sentence shape: Generate only changes the words',
      kbdSpace: 'Space',
      kbdEnter: 'Enter',
      kbdShift: 'Shift',
      kbdEsc: 'Esc',

      lockWord: 'Lock this word',
      unlockWord: 'Unlock',
      chipTitle: ({ locked, n }) =>
        `${locked ? 'Locked' : 'Click to reroll'}${n ? ` (${n})` : ''} · right-click to ${locked ? 'unlock' : 'lock'}`,
      kept: 'Kept',
      copied: 'Copied to clipboard',
      copiedAll: ({ count }) => `Copied ${count} subject${s(count)}`,
      exported: 'Exported',
      themeGone: 'Theme "{name}" is not available any more',
      themeChanged: 'This theme has changed since that roll',
      remove: 'Remove',
      bringBack: 'Bring this subject back',
      clearSelectedConfirm: ({ count }) => (count === 1 ? 'Remove the selected subject?' : `Remove all ${count} selected subjects?`),
      importFailed: 'Import failed: {error}',
      imported: ({ count }) => `Imported ${count} theme${s(count)}`,
      noVoice: 'No voice: {error}',

      sessionLength: 'Session length',
      customLength: 'Custom length, in minutes',
      minutes: 'Minutes',
      min: 'min',
      presetTitle: '{n} minutes',
      timerStart: 'Start',
      timerPause: 'Pause',
      timerResume: 'Resume',
      timerRestart: 'Restart',
      resetTimer: 'Reset the timer',
      resetTimerTitle: 'Reset the timer (R)',
      sound: 'Sound alerts and timer voice',
      soundTitle: 'Sound alerts and timer voice on / off',
      mini: 'Mini',
      exitMini: 'Exit mini',
      miniTitle: 'Small always-on-top window, to keep the subject and time in sight while painting (M)',
      oneMinuteLeft: '1 minute left',
      timesUp: "Time's up",
      timesUpToast: "Time's up! Put the brush down.",

      history: 'History',
      historyEmpty: 'Every roll is logged here. Click one to bring it back.',
      selected: 'Selected',
      selectedEmpty: 'Subjects you keep land here, and stay after you close the app.',
      clear: 'Clear',
      copyAll: 'Copy all',
      exportTxt: 'Export .txt',
      exportName: '3ch-subjects-{date}.txt',

      footerCredits: 'Original 3CH kilogeneratormorphic v1.0 (2005) · Credits: Hydropix, Vyle, Viag, Sparth, BARoNTiERi',
      scReroll: 'reroll word',
      scLock: 'lock',
      scReshape: 'reshape',
      scTheme: 'theme',
      scLeaveMini: 'leave mini',

      // Captions for the list names of the legacy themes.
      labelTrait: 'trait',
      labelDiet: 'diet',
      labelAdverb: 'adverb',
      labelBodyPart: 'body part',
      labelSubject: 'subject',
      labelTarget: 'target',

      // Main process: dialogs and notification.
      importDialogTitle: 'Import a legacy 3CH theme folder',
      exportDialogTitle: 'Export selected subjects',
      textFiles: 'Text',
      noLegacyFound: 'No folder with a structure.txt was found.',
      skippedFolders: ({ count }) => `Skipped ${count} unreadable folder${s(count)}.`,
    },

    fr: {
      language: 'Langue',
      languageTitle: 'Langue de l’interface, des thèmes et de la voix',
      importLegacy: 'Importer un thème v1',
      importLegacyTitle: 'Convertir un dossier de thème de l’ancienne version (structure.txt + listes)',
      themesFolder: 'Dossier des thèmes',
      themesFolderTitle: 'Ouvrir le dossier qui contient vos propres thèmes',
      themeTabs: 'Thème',
      combosTitle: 'Nombre de sujets différents que ce thème peut produire',
      // "12 milliards de sujets", "1 234 sujets", "1 sujet".
      possibleSubjects: ({ count }) => (count >= 1e6 ? 'de sujets possibles' : `sujet${fs(count)} possible${fs(count)}`),
      sentenceShapes: ({ count }) => `${count} forme${fs(count)} de phrase`,
      mine: 'perso',
      stage: 'Sujet',
      hint: 'Cliquez sur un mot pour le relancer, verrouillez-le pour le garder d’un tirage à l’autre.',
      hintMulti: 'Chaque tirage change aussi la forme de la phrase. Les mots verrouillés suivent dans la nouvelle.',
      placeholder: 'Appuyez sur Espace pour tirer un sujet',
      noTheme: 'Aucun thème trouvé.',
      themesNotLoaded: `Certains thèmes n’ont pas pu être chargés${NBSP}: {errors}`,

      generate: 'Générer',
      keep: 'Garder',
      copy: 'Copier',
      speak: 'Lire',
      speakTitle: 'Lire le sujet à voix haute, avec une voix de robot détraqué (V)',
      autoVoice: 'Voix auto',
      autoVoiceTitle: 'Lire chaque nouveau sujet à voix haute dès qu’il est tiré (Maj+V)',
      unlockAll: 'Tout déverrouiller',
      reshape: 'Remodeler',
      reshapeTitle: 'Nouvelle forme de phrase, en gardant les mots qui y trouvent leur place (S)',
      lockShape: 'Verrouiller la forme',
      lockShapeTitle: `Garder cette forme de phrase${NBSP}: Générer ne change que les mots`,
      kbdSpace: 'Espace',
      kbdEnter: 'Entrée',
      kbdShift: 'Maj',
      kbdEsc: 'Échap',

      lockWord: 'Verrouiller ce mot',
      unlockWord: 'Déverrouiller',
      chipTitle: ({ locked, n }) =>
        `${locked ? 'Verrouillé' : 'Cliquez pour relancer'}${n ? ` (${n})` : ''} · clic droit pour ${locked ? 'déverrouiller' : 'verrouiller'}`,
      kept: 'Gardé',
      copied: 'Copié dans le presse-papiers',
      copiedAll: ({ count }) => `${count} sujet${fs(count)} copié${fs(count)}`,
      exported: 'Exporté',
      themeGone: `Le thème «${NBSP}{name}${NBSP}» n’est plus disponible`,
      themeChanged: 'Ce thème a changé depuis ce tirage',
      remove: 'Retirer',
      bringBack: 'Ramener ce sujet',
      clearSelectedConfirm: ({ count }) =>
        count < 2 ? `Retirer le sujet sélectionné${NNBSP}?` : `Retirer les ${count} sujets sélectionnés${NNBSP}?`,
      importFailed: `L’import a échoué${NBSP}: {error}`,
      imported: ({ count }) => `${count} thème${fs(count)} importé${fs(count)}`,
      noVoice: `Pas de voix${NBSP}: {error}`,

      sessionLength: 'Durée de la séance',
      customLength: 'Durée personnalisée, en minutes',
      minutes: 'Minutes',
      min: 'min',
      presetTitle: '{n} minutes',
      timerStart: 'Démarrer',
      timerPause: 'Pause',
      timerResume: 'Reprendre',
      timerRestart: 'Relancer',
      resetTimer: 'Remettre le minuteur à zéro',
      resetTimerTitle: 'Remettre le minuteur à zéro (R)',
      sound: 'Alertes sonores et voix du minuteur',
      soundTitle: 'Alertes sonores et voix du minuteur, activées ou coupées',
      mini: 'Mini',
      exitMini: 'Quitter le mini',
      miniTitle: 'Petite fenêtre toujours au premier plan, pour garder le sujet et le temps sous les yeux pendant que vous peignez (M)',
      oneMinuteLeft: 'Plus qu’une minute',
      timesUp: 'Temps écoulé',
      timesUpToast: `Temps écoulé${NNBSP}! Posez le pinceau.`,

      history: 'Historique',
      historyEmpty: 'Chaque tirage est noté ici. Cliquez dessus pour le ramener.',
      selected: 'Sélection',
      selectedEmpty: 'Les sujets que vous gardez arrivent ici, et y restent après la fermeture de l’app.',
      clear: 'Effacer',
      copyAll: 'Tout copier',
      exportTxt: 'Exporter en .txt',
      exportName: '3ch-sujets-{date}.txt',

      footerCredits: `3CH kilogeneratormorphic v1.0 d’origine (2005) · Crédits${NBSP}: Hydropix, Vyle, Viag, Sparth, BARoNTiERi`,
      scReroll: 'relancer un mot',
      scLock: 'verrouiller',
      scReshape: 'remodeler',
      scTheme: 'thème',
      scLeaveMini: 'quitter le mini',

      labelTrait: 'trait',
      labelDiet: 'régime',
      labelAdverb: 'adverbe',
      labelBodyPart: 'partie du corps',
      labelSubject: 'sujet',
      labelTarget: 'cible',

      importDialogTitle: 'Importer un dossier de thème 3CH v1',
      exportDialogTitle: 'Exporter les sujets sélectionnés',
      textFiles: 'Texte',
      noLegacyFound: 'Aucun dossier contenant un structure.txt n’a été trouvé.',
      skippedFolders: ({ count }) => `${count} dossier${fs(count)} illisible${fs(count)} ignoré${fs(count)}.`,
    },
  };

  // The string for `key` in `lang`, English when that language lacks it.
  function t(lang, key, vars = {}) {
    const value = STRINGS[lang]?.[key] ?? STRINGS.en[key];
    if (value === undefined) return key;
    if (typeof value === 'function') return value(vars);
    return value.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
  }

  // The name of a language in that language: "Français". Unknown codes ask
  // Intl, then fall back to the code itself.
  function languageName(code) {
    const known = LANGUAGES.find((l) => l.code === code);
    if (known) return known.name;
    try {
      const name = new Intl.DisplayNames([code], { type: 'language' }).of(code);
      if (name && name !== code) return name[0].toLocaleUpperCase(code) + name.slice(1);
    } catch {
      /* not a language code Intl knows */
    }
    return code.toUpperCase();
  }

  // The language to start in: the OS language when there are themes for it,
  // else English, else whatever there is.
  function pickLanguage(available, preferred = []) {
    for (const p of [].concat(preferred)) {
      const code = String(p ?? '').toLowerCase().split(/[-_]/)[0];
      if (available.includes(code)) return code;
    }
    return available.includes('en') ? 'en' : available[0] ?? 'en';
  }

  // Big numbers in words. English uses the short scale ("12.3 billion" is
  // 12.3e9), French the long one ("12,3 milliards", and "billion" is 1e12).
  const SCALES = {
    en: ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion'],
    fr: ['', 'mille', 'million', 'milliard', 'billion', 'billiard', 'trillion', 'trilliard'],
  };
  const LOCALES = { en: 'en-US', fr: 'fr-FR' };

  // Under a million, the full number ("123,456", "123 456"); above, one
  // decimal under 10 and none above ("4.5 million", "12 milliards").
  function formatCombos(n, lang = 'en') {
    const big = BigInt(n);
    const scale = SCALES[lang] ?? SCALES.en;
    const locale = LOCALES[lang] ?? LOCALES.en;
    if (big < 1000000n) return Number(big).toLocaleString(locale);
    let group = Math.min(Math.floor((big.toString().length - 1) / 3), scale.length - 1);
    let value = Number(big) / 10 ** (group * 3);
    // 999.6 million reads better as 1.0 billion.
    if (Math.round(value) >= 1000 && group < scale.length - 1) {
      group++;
      value /= 1000;
    }
    const digits = value < 10 ? 1 : 0;
    const shown = value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: true });
    // French scale words agree in number: "1,5 million", "2 millions".
    const word = lang === 'fr' && Number(value.toFixed(digits)) >= 2 ? `${scale[group]}s` : scale[group];
    return `${shown} ${word}`;
  }

  const api = { LANGUAGES, STRINGS, t, languageName, pickLanguage, formatCombos };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.I18n = api;
})(typeof window !== 'undefined' ? window : globalThis);
