// Timer announcer: what the robot says during a speed painting session, and
// when. A passive-aggressive facility AI running a painting experiment, in
// every language the interface speaks (English when a language has no lines).
// Pure logic, shared by the renderer and the Node tests.
(function (root) {
  'use strict';

  const MIN = 60 * 1000;
  const COUNTDOWN_FROM = 10;

  // English, the reference set. Every language has the same kinds.
  const LINES = {
    start: [
      'Painting session initiated. Your progress will be monitored. And graded. Harshly.',
      'Timer engaged. Please begin painting. The facility is watching.',
      'Creative test sequence activated. Failure is statistically likely. Begin.',
      'Session started. Every brushstroke is being recorded, for science.',
      'Welcome to the painting chamber. The door has been locked for your convenience.',
      'Test subject detected. Canvas detected. Talent: still scanning.',
    ],
    resume: [
      'Session resumed. The break has been noted in your file.',
      'Welcome back. Time did not wait for you. Neither will I.',
      'Resuming test. Your absence lowered the average quality of this room.',
      'Painting resumed. Please try to look busy.',
    ],
    pause: [
      'Session paused. The clock is patient. I am not.',
      'Pause acknowledged. Your brush is getting cold.',
      'Test suspended. I will use this time to reconsider your potential.',
      'Paused. Do not touch the canvas. Do not touch anything.',
    ],
    halfway: [
      'Halfway point reached. Your painting is fifty percent complete. Probably less.',
      'Half of your time is gone. The other half is already leaving.',
      'Midpoint analysis complete. Recommendation: stop admiring your sketch.',
      'You are halfway there. That is not encouragement. It is a measurement.',
    ],
    pressure: [
      'Please paint faster. This is not a suggestion.',
      'Your canvas looks promising. That was sarcasm.',
      'Increasing brush speed is strongly recommended.',
      'Reminder: details are optional. Deadlines are not.',
      'Do not panic. Panicking wastes valuable painting time.',
      'Your painting has been analyzed. Result: incomplete.',
      'A finished sketch beats a perfect nothing.',
      'The previous test subject finished early. The previous test subject was a toaster.',
      'Stop zooming in. The problem is not the pixels.',
      'Your color choices have been forwarded to the ethics committee.',
    ],
    lastMinute: [
      'Begin final adjustments. Or begin crying. Both are acceptable.',
      'Stop blending. Start finishing.',
      'This is your one minute warning. There will be no other warning. Except the next one.',
      'Final minute. Please remain calm while your deadline approaches at full speed.',
    ],
    lastSeconds: [
      'Put down the eraser. Slowly.',
      'Last strokes. Make them count.',
      'Emergency finishing protocol engaged.',
      'Signature now. Details never.',
    ],
    done: [
      'Time is up. Brushes down. Step away from the canvas.',
      'Session complete. Your painting has been saved in my memory. Forever.',
      'Time is up. Congratulations. You are finished, whether you are finished or not.',
      'Test complete. The results are art. Probably.',
      'Painting session terminated. Please collect your dignity on the way out.',
    ],
  };

  // French: the same voice, written for the ear (numbers in words, no
  // abbreviations), so that the system voice reads it naturally.
  const LINES_FR = {
    start: [
      'Séance de peinture initialisée. Vos progrès seront surveillés. Et notés. Sévèrement.',
      'Chronomètre enclenché. Veuillez commencer à peindre. Le complexe vous observe.',
      "Séquence de test créatif activée. L'échec est statistiquement probable. Commencez.",
      'Séance lancée. Chaque coup de pinceau est enregistré, pour la science.',
      'Bienvenue dans la salle de peinture. La porte a été verrouillée, pour votre confort.',
      'Sujet de test détecté. Toile détectée. Talent. Analyse toujours en cours.',
      "Début de l'expérience. Les sujets précédents ne sont pas disponibles pour témoigner.",
    ],
    resume: [
      'Séance reprise. Votre pause a été consignée dans votre dossier.',
      "Bon retour parmi nous. Le temps ne vous a pas attendu. Moi non plus.",
      'Reprise du test. Votre absence a fait baisser le niveau moyen de cette pièce.',
      "Peinture reprise. Essayez d'avoir l'air occupé.",
      "Reprise. J'ai profité de votre absence pour revoir mes attentes. À la baisse.",
    ],
    pause: [
      "Séance en pause. L'horloge est patiente. Moi, non.",
      'Pause enregistrée. Votre pinceau refroidit.',
      'Test suspendu. Je vais profiter de ce moment pour réévaluer votre potentiel.',
      'Pause. Ne touchez pas à la toile. Ne touchez à rien.',
      'Pause accordée. Elle sera déduite de votre note, naturellement.',
    ],
    halfway: [
      'Mi-parcours atteint. Votre peinture est terminée à cinquante pour cent. Probablement moins.',
      "La moitié de votre temps est écoulée. L'autre moitié fait déjà ses valises.",
      "Analyse de mi-parcours terminée. Recommandation. Cessez d'admirer votre croquis.",
      "Vous êtes à mi-chemin. Ce n'est pas un encouragement. C'est une mesure.",
    ],
    pressure: [
      "Veuillez peindre plus vite. Ceci n'est pas une suggestion.",
      "Votre toile est prometteuse. C'était du sarcasme.",
      "Il est vivement conseillé d'accélérer le pinceau.",
      'Rappel. Les détails sont facultatifs. Les délais, non.',
      'Ne paniquez pas. La panique gaspille un temps de peinture précieux.',
      'Votre peinture a été analysée. Résultat. Incomplète.',
      "Mieux vaut une esquisse finie qu'un néant parfait.",
      'Le sujet précédent a fini en avance. Le sujet précédent était un grille-pain.',
      'Arrêtez de zoomer. Le problème ne vient pas des pixels.',
      "Vos choix de couleurs ont été transmis au comité d'éthique.",
      "Je ne dis pas que c'est raté. Je le pense, simplement. Très fort.",
    ],
    lastMinute: [
      'Commencez les dernières retouches. Ou commencez à pleurer. Les deux sont acceptés.',
      'Arrêtez de fondre les couleurs. Commencez à finir.',
      "Ceci est votre avertissement d'une minute. Il n'y en aura pas d'autre. Sauf le prochain.",
      "Dernière minute. Merci de rester calme pendant que l'échéance arrive à pleine vitesse.",
    ],
    lastSeconds: [
      'Posez la gomme. Lentement.',
      "Derniers coups de pinceau. Faites qu'ils comptent.",
      "Protocole de finition d'urgence enclenché.",
      'La signature maintenant. Les détails jamais.',
    ],
    done: [
      'Temps écoulé. Pinceaux à terre. Éloignez-vous de la toile.',
      'Séance terminée. Votre peinture est enregistrée dans ma mémoire. Pour toujours.',
      'Temps écoulé. Félicitations. Vous avez terminé, que vous ayez terminé ou non.',
      "Test terminé. Le résultat est de l'art. Probablement.",
      'Séance de peinture close. Merci de récupérer votre dignité en sortant.',
    ],
  };

  const LINES_BY_LANG = { en: LINES, fr: LINES_FR };
  const linesFor = (lang) => LINES_BY_LANG[lang] ?? LINES;

  function pickLine(kind, rand = Math.random, lang = 'en') {
    const pool = linesFor(lang)[kind];
    return pool[Math.floor(rand() * pool.length)];
  }

  // "15 minutes remaining." / "15 minutes restantes."
  const TIME_LEFT = {
    en: (n, unit) => `${n} ${unit}${n > 1 ? 's' : ''} remaining.`,
    fr: (n, unit) => `${n} ${{ hour: 'heure', minute: 'minute', second: 'seconde' }[unit]}${n > 1 ? 's restantes' : ' restante'}.`,
  };

  function timeLeft(at, lang = 'en') {
    const say = TIME_LEFT[lang] ?? TIME_LEFT.en;
    if (at >= 60 * MIN) return say(at / (60 * MIN), 'hour');
    const m = at / MIN;
    if (m >= 1) return say(m, 'minute');
    return say(at / 1000, 'second');
  }

  // The moments of a session that get a line, as time left in ms. Marks too
  // close to the start (under 20 s in) are dropped, and the halfway line only
  // comes when no other mark is near it.
  function milestones(duration, rand = Math.random, lang = 'en') {
    const marks = [180, 120, 60, 30, 15, 10, 5, 2, 1].map((m) => m * MIN).concat(30 * 1000);
    const fits = (at) => duration - at >= 20 * 1000;
    const list = marks.filter(fits).map((at) => {
      const kind = at === MIN ? 'lastMinute' : at < MIN ? 'lastSeconds' : 'pressure';
      return { at, kind, text: `${timeLeft(at, lang)} ${pickLine(kind, rand, lang)}` };
    });
    const half = Math.round(duration / 2 / 1000) * 1000;
    if (duration >= 4 * MIN && list.every((m) => Math.abs(m.at - half) > 45 * 1000)) {
      list.push({ at: half, kind: 'halfway', text: pickLine('halfway', rand, lang) });
    }
    return list.sort((a, b) => b.at - a.at);
  }

  // The whole minute of time left passed between two readings (5 for 5:00),
  // or 0 when none was. The start itself is not a minute passed.
  function minutePassed(before, after) {
    const m = Math.ceil(after / MIN);
    return m > 0 && Math.ceil(before / MIN) > m ? m : 0;
  }

  // Milestones passed between two readings of the time left.
  function crossed(list, before, after) {
    return list.filter((m) => m.at < before && m.at >= after);
  }

  // The countdown numbers still to say with `remaining` ms left, and in how
  // many ms each one is due: "10" at 10 s left... "1" at 1 s left.
  function countdown(remaining) {
    const out = [];
    for (let n = COUNTDOWN_FROM; n >= 1; n--) {
      const delay = remaining - n * 1000;
      if (delay >= -150) out.push({ n, text: String(n), delay: Math.max(0, delay) });
    }
    return out;
  }

  const api = { LINES, LINES_BY_LANG, COUNTDOWN_FROM, timeLeft, pickLine, milestones, minutePassed, crossed, countdown };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Announcer = api;
})(typeof window !== 'undefined' ? window : globalThis);
