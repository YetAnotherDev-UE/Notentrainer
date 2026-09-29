/* paths.js: Lernpfade. Ein Modus bekommt eine Leiter aus vielen kleinen
 * Stufen, wie ein Abenteuer im Kleinen: Jede Stufe ändert nur eine Sache,
 * und was neu ist, fängt wieder klein an. Bisher für Gehör und Intervalle,
 * die beiden Modi, die im Abenteuer nicht oder nur kurz vorkommen.
 * Gehör ist schwer, deshalb sind die Schritte dort besonders klein: erst zwei
 * Töne mit Bezugston, dann drei, dann Nachbartöne, und erst spät ohne
 * Bezugston, mit schwarzen Tasten oder in tiefer Lage.
 * Sterne wie im Abenteuer: 1 ab 60 %, 2 ab 80 %, 3 ab 95 %; die nächste Stufe
 * öffnet sich mit zwei Sternen. Der Stand liegt in kv "paths":
 * { ear: { id: { stars, best, attempts, at } }, interval: { ... } }. */
"use strict";
window.NT = window.NT || {};

NT.paths = (() => {
  const MU = NT.music;
  const STARS = [60, 80, 95];
  const white = (lo, hi) => { const out = []; for (let m = lo; m <= hi; m++) if (!MU.isBlack(m)) out.push(m); return out; };
  const every = (lo, hi) => { const out = []; for (let m = lo; m <= hi; m++) out.push(m); return out; };

  /* --- Gehör -------------------------------------------------------------- *
   * pool: die Töne, die vorkommen können (MIDI, 60 = C4). anchor: der
   * Bezugston, der vor jeder Frage erklingt, oder null.
   * ------------------------------------------------------------------------ */
  const ear = (id, title, pool, count, x) => Object.assign({ id, title, pool, count, anchor: 60, clef: "treble" }, x);
  const bass = { clef: "bass", anchor: 48 };
  const EAR = [
    ear("cg", "Zwei Töne: C und G", [60, 67], 8, { tip: "Vor jedem Ton hörst du das C als Bezugston. Klingt der zweite Ton gleich, ist es das C. Klingt er höher, ist es das G." }),
    ear("cg2", "C und G, länger", [60, 67], 12),
    ear("ce", "C und E", [60, 64], 8, { tip: "Das E liegt näher am C als das G, der Sprung ist kleiner." }),
    ear("cd", "C und D", [60, 62], 8, { tip: "Der kleinste Schritt auf weißen Tasten: Das D liegt direkt neben dem C." }),
    ear("ceg", "Drei Töne: C, E, G", [60, 64, 67], 10, { tip: "Neu: drei Töne. Hör, wie weit der Ton vom C weg ist: gar nicht, ein Stück oder weit." }),
    ear("ceg2", "C, E, G, länger", [60, 64, 67], 14),
    ear("cde", "Drei Nachbarn: C, D, E", [60, 62, 64], 10, { tip: "Drei Töne direkt nebeneinander. Summ innerlich mit: C, D, E, wie der Anfang einer Tonleiter." }),
    ear("cde2", "C, D, E, länger", [60, 62, 64], 14),
    ear("cdeg", "Vier Töne: C, D, E, G", [60, 62, 64, 67], 12),
    ear("c5", "Fünf Töne: C bis G", white(60, 67), 12, { tip: "Neu dabei: das F. Alle fünf Töne liegen unter einer Hand." }),
    ear("c5b", "C bis G, länger", white(60, 67), 16),
    ear("c6", "Sechs Töne: bis zum A", white(60, 69), 14),
    ear("c7", "Sieben Töne: bis zum H", white(60, 71), 14, { tip: "Das H drängt zum C darüber. Dieses Ziehen hilft beim Erkennen." }),
    ear("c8", "Eine Oktave: C4 bis C5", white(60, 72), 16, { tip: "Das hohe C klingt wie das tiefe, nur heller." }),
    ear("c8b", "Oktave, länger", white(60, 72), 20),
    ear("n-ceg", "Ohne Bezugston: C, E, G", [60, 64, 67], 10, { anchor: null, tip: "Neu: Der Bezugston fällt weg. Dein Vergleich ist jetzt der Ton davor. Dafür wieder nur drei Töne." }),
    ear("n-cde", "Ohne Bezugston: C, D, E", [60, 62, 64], 10, { anchor: null }),
    ear("n-c5", "Ohne Bezugston: C bis G", white(60, 67), 12, { anchor: null }),
    ear("n-c8", "Ohne Bezugston: Oktave", white(60, 72), 16, { anchor: null }),
    ear("lo1", "Unter dem C: G3 bis C4", white(55, 60), 10, { tip: "Neu: Töne unter dem C. Der Bezugston ist wieder da, es bleibt das C4." }),
    ear("lo2", "G3 bis G4", white(55, 67), 14),
    ear("lo3", "G3 bis C5", white(55, 72), 16),
    ear("n-lo3", "G3 bis C5, ohne Bezugston", white(55, 72), 16, { anchor: null }),
    ear("hi1", "Über dem C5: C5 bis G5", white(72, 79), 10, { anchor: 72, tip: "Neu: die Oktave darüber. Der Bezugston ist jetzt das C5." }),
    ear("hi2", "C4 bis G5", white(60, 79), 16),
    ear("n-hi2", "C4 bis G5, ohne Bezugston", white(60, 79), 16, { anchor: null }),
    ear("b1", "Schwarze Taste: C, Cis, D", [60, 61, 62], 10, { tip: "Neu: eine schwarze Taste. Das Cis liegt zwischen C und D, einen halben Ton über dem C. Wieder mit Bezugston und nur drei Tönen." }),
    ear("b2", "C bis E, alle Tasten", every(60, 64), 12),
    ear("b3", "C bis G, alle Tasten", every(60, 67), 14),
    ear("b4", "Oktave, alle Tasten", every(60, 72), 18),
    ear("n-b4", "Oktave, alle Tasten, ohne Bezugston", every(60, 72), 18, { anchor: null }),
    ear("t1", "Tief: C3, E3, G3", [48, 52, 55], 10, Object.assign({ tip: "Neu: die tiefe Lage im Bassschlüssel. Tiefe Töne sind schwerer zu unterscheiden, deshalb wieder nur drei. Bezugston ist das C3." }, bass)),
    ear("t2", "Tief: C3 bis G3", white(48, 55), 12, bass),
    ear("t3", "Tief: C3 bis C4", white(48, 60), 16, bass),
    ear("n-t3", "Tief, ohne Bezugston", white(48, 60), 16, { clef: "bass", anchor: null }),
    ear("t4", "Tief, alle Tasten", every(48, 60), 18, bass),
    ear("fin", "Meisterstufe: G3 bis G5, alle Tasten", every(55, 79), 24, { anchor: null, tip: "Zwei Oktaven, alle Tasten, kein Bezugston. Wer hier zwei Sterne holt, hört sehr gut." }),
  ];

  /* --- Intervalle --------------------------------------------------------- *
   * only: die erlaubten Abstände in Buchstaben (1 = Sekunde ... 7 = Oktave).
   * help: Beschriftung über den Noten; ohne sie behält nur der Anker seinen
   * Namen, und der Abstand muss aus dem System gelesen werden.
   * ------------------------------------------------------------------------ */
  const iv = (id, title, only, low, high, count, bpm, x) => Object.assign({ id, title, only, low, high, count, bpm, help: true, clef: "treble" }, x);
  const upTo = n => { const out = []; for (let i = 1; i <= n; i++) out.push(i); return out; };
  const blind = { help: false };
  const INTERVAL = [
    iv("s1", "Nur Schritte", [1], 60, 67, 8, 50, { tip: "Sekunde heißt: die Nachbarnote, von der Linie in den Zwischenraum oder umgekehrt. Über jeder Note steht, wohin es geht. Die erste Note ist dein Anker." }),
    iv("s2", "Schritte, länger", [1], 60, 67, 12, 50),
    iv("s3", "Schritte ohne Hilfe", [1], 60, 67, 8, 50, { help: false, tip: "Neu: Die Beschriftung fällt weg, nur der Anker behält seinen Namen. Lies selbst, ob es einen Schritt hinauf oder hinunter geht." }),
    iv("t1", "Nur Terzen", [2], 60, 72, 8, 50, { tip: "Neu: die Terz. Eine Note wird übersprungen: von Linie zu Linie oder von Zwischenraum zu Zwischenraum." }),
    iv("t2", "Schritte und Terzen", [1, 2], 60, 69, 12, 50),
    iv("t3", "Schritte und Terzen ohne Hilfe", [1, 2], 60, 69, 12, 50, blind),
    iv("t4", "Bis zur Terz, Tempo 55", [1, 2], 60, 72, 14, 55, blind),
    iv("q1", "Nur Quarten", [3], 60, 72, 8, 50, { tip: "Neu: die Quarte. Zwei Noten werden übersprungen, es geht von der Linie in einen Zwischenraum oder umgekehrt." }),
    iv("q2", "Bis zur Quarte", upTo(3), 60, 72, 12, 50),
    iv("q3", "Bis zur Quarte ohne Hilfe", upTo(3), 60, 72, 12, 50, blind),
    iv("q4", "Bis zur Quarte, Tempo 55", upTo(3), 60, 72, 16, 55, blind),
    iv("f1", "Nur Quinten", [4], 60, 74, 8, 50, { tip: "Neu: die Quinte. Von Linie zu Linie mit einer Linie dazwischen, oder von Zwischenraum zu Zwischenraum mit einem dazwischen." }),
    iv("f2", "Bis zur Quinte", upTo(4), 60, 74, 12, 50),
    iv("f3", "Bis zur Quinte ohne Hilfe", upTo(4), 60, 74, 12, 50, blind),
    iv("f4", "Bis zur Quinte, Tempo 60", upTo(4), 60, 74, 16, 60, blind),
    iv("x1", "Nur Sexten", [5], 60, 77, 8, 50, { tip: "Neu: die Sexte. Ein weiter Sprung von der Linie in einen Zwischenraum, eine Note weiter als die Quinte." }),
    iv("x2", "Bis zur Sexte", upTo(5), 60, 77, 12, 50),
    iv("x3", "Bis zur Sexte ohne Hilfe", upTo(5), 60, 77, 14, 50, blind),
    iv("p1", "Nur Septimen", [6], 60, 79, 8, 50, { tip: "Neu: die Septime. Von Linie zu Linie mit zwei Linien dazwischen, fast eine Oktave." }),
    iv("p2", "Bis zur Septime", upTo(6), 60, 79, 12, 50),
    iv("p3", "Bis zur Septime ohne Hilfe", upTo(6), 60, 79, 14, 50, blind),
    iv("o1", "Nur Oktaven", [7], 57, 81, 8, 50, { tip: "Neu: die Oktave. Derselbe Ton acht Buchstaben weiter, von der Linie in einen Zwischenraum. Die Hand spannt weit." }),
    iv("o2", "Bis zur Oktave", upTo(7), 60, 79, 12, 50),
    iv("o3", "Bis zur Oktave ohne Hilfe", upTo(7), 60, 79, 16, 50, blind),
    iv("o4", "Bis zur Oktave, Tempo 60", upTo(7), 60, 79, 16, 60, blind),
    iv("b1", "Bass: Schritte und Terzen", [1, 2], 48, 57, 10, 50, { clef: "bass", tip: "Neu: der Bassschlüssel. Die Abstände sehen genauso aus, nur die Töne heißen anders. Wieder mit Beschriftung und kleinen Abständen." }),
    iv("b2", "Bass: bis zur Quinte", upTo(4), 45, 60, 12, 50, { clef: "bass" }),
    iv("b3", "Bass: bis zur Quinte ohne Hilfe", upTo(4), 45, 60, 12, 50, { clef: "bass", help: false }),
    iv("b4", "Bass: bis zur Oktave", upTo(7), 41, 60, 12, 50, { clef: "bass" }),
    iv("b5", "Bass: bis zur Oktave ohne Hilfe", upTo(7), 41, 60, 16, 50, { clef: "bass", help: false }),
    iv("m1", "Alles, Tempo 65", upTo(7), 60, 79, 20, 65, blind),
    iv("m2", "Alles, Tempo 70", upTo(7), 60, 79, 20, 70, blind),
    iv("m3", "Alles, Tempo 75", upTo(7), 60, 79, 20, 75, blind),
    iv("m4", "Weiter Umfang: A3 bis A5", upTo(7), 57, 81, 24, 75, blind),
    iv("m5", "Meisterstufe: Tempo 80", upTo(7), 57, 81, 24, 80, { help: false, tip: "Alle Abstände bis zur Oktave, ohne Hilfe, im Tempo eines ruhigen Stücks." }),
  ];

  const PATHS = {
    ear: { mode: "ear", title: "Gehör", colors: ["#b79bff", "#7c3aed"], steps: EAR,
           intro: "Ton hören, Taste finden. In kleinen Stufen, erst zwei Töne, dann immer einer mehr." },
    interval: { mode: "interval", title: "Intervalle", colors: ["#2dd4ff", "#1d4ed8"], steps: INTERVAL,
                intro: "Abstände lesen statt Namen. Jedes Intervall erst allein, dann gemischt, dann ohne Hilfe." },
  };
  for (const p of Object.values(PATHS)) p.steps.forEach((s, i) => { s.index = i; s.n = i + 1; s.key = p.mode + ":" + s.id; });
  const has = mode => !!PATHS[mode];
  const get = mode => PATHS[mode] || null;
  // Aus dem Schlüssel einer Sitzung ("ear:ceg") zurück zur Stufe.
  function find(key) {
    const [mode, id] = String(key || "").split(":"), p = PATHS[mode];
    const step = p ? p.steps.find(s => s.id === id) : null;
    return step ? { path: p, step } : null;
  }

  const entry = (prog, mode, step) => (prog && prog[mode] && prog[mode][step.id]) || null;
  const starsOf = (prog, mode, step) => { const e = entry(prog, mode, step); return e ? e.stars || 0 : 0; };
  function isUnlocked(prog, mode, step) {
    if (step.index === 0) return true;
    return starsOf(prog, mode, PATHS[mode].steps[step.index - 1]) >= 2;
  }
  // Die aktuelle Stufe: die erste offene mit weniger als zwei Sternen, sonst die letzte.
  function current(prog, mode) {
    const steps = PATHS[mode].steps;
    for (const s of steps) if (isUnlocked(prog, mode, s) && starsOf(prog, mode, s) < 2) return s;
    return steps[steps.length - 1];
  }
  const next = (mode, step) => PATHS[mode].steps[step.index + 1] || null;
  function totals(prog, mode) {
    const steps = PATHS[mode].steps; let stars = 0, done = 0;
    for (const s of steps) { const n = starsOf(prog, mode, s); stars += n; if (n >= 2) done++; }
    return { stars, done, count: steps.length, max: steps.length * 3 };
  }
  function starsFor(res) {
    if (!res || res.accuracy == null) return 0;
    const pct = res.accuracy * 100;
    return STARS.filter(th => pct >= th - 1e-9).length;
  }
  // Ergebnis eintragen: das Beste bleibt stehen. Gibt die Sterne dieser Runde zurück.
  function note(prog, mode, step, res) {
    const stars = starsFor(res);
    prog[mode] = prog[mode] || {};
    const e = prog[mode][step.id] || { stars: 0, best: 0, attempts: 0 };
    e.attempts++; e.stars = Math.max(e.stars, stars); e.best = Math.max(e.best, Math.round((res.accuracy || 0) * 100)); e.at = Date.now();
    prog[mode][step.id] = e;
    return stars;
  }
  // Zwei Stände zusammenführen (Import): je Stufe das Beste.
  function merge(mine, other) {
    for (const mode of Object.keys(other || {})) {
      if (!PATHS[mode] || !other[mode]) continue;
      mine[mode] = mine[mode] || {};
      for (const [id, e] of Object.entries(other[mode])) {
        const m = mine[mode][id];
        if (!m) mine[mode][id] = Object.assign({ stars: 0, best: 0, attempts: 0 }, e);
        else { m.stars = Math.max(m.stars || 0, e.stars || 0); m.best = Math.max(m.best || 0, e.best || 0); m.attempts = Math.max(m.attempts || 0, e.attempts || 0); }
      }
    }
    return mine;
  }

  /* --- Beschreibung und Spielparameter ------------------------------------ */
  const CLEF = { treble: "Violinschlüssel", bass: "Bassschlüssel" };
  const names = (midis, naming) => midis.map(m => MU.name(m, naming)).join(", ");
  function describe(mode, s, naming) {
    const parts = [];
    if (mode === "ear") {
      parts.push(s.pool.length <= 6 ? "Töne: " + names(s.pool, naming) : s.pool.length + " Töne von " + MU.name(s.pool[0], naming) + " bis " + MU.name(s.pool[s.pool.length - 1], naming));
      parts.push(s.pool.some(MU.isBlack) ? "mit schwarzen Tasten" : "nur weiße Tasten");
      parts.push(s.anchor != null ? "Bezugston " + MU.name(s.anchor, naming) : "ohne Bezugston");
      parts.push(s.count + " Versuche");
    } else {
      const iv = s.only.map(d => MU.intervalName(d)), plural = w => w + (w.endsWith("e") ? "n" : "en");
      parts.push(iv.length === 1 ? "nur " + plural(iv[0]) : iv.length > 2 ? iv[0] + " bis " + iv[iv.length - 1] : iv.join(" und "));
      parts.push(CLEF[s.clef], MU.name(s.low, naming) + " bis " + MU.name(s.high, naming), s.count + " Noten", s.bpm + " Schläge/min");
      parts.push(s.help ? "mit Beschriftung" : "ohne Beschriftung");
    }
    return parts.join(" · ");
  }
  function optsFor(mode, s) {
    const p = { mode, id: s.id, key: s.key };
    if (mode === "ear")
      return { mode, opts: { pool: s.pool.slice(), path: p, title: "Stufe " + s.n + ": " + s.title,
        override: { clef: s.clef, keys: s.pool.some(MU.isBlack) ? "all" : "white", singleCount: s.count, earAnchor: s.anchor, earIntro: true, earLegend: true } } };
    return { mode, opts: { path: p, title: "Stufe " + s.n + ": " + s.title,
      override: { clef: s.clef, keys: "white", low: s.low, high: s.high, bpm: s.bpm, runLength: s.count, intervalOnly: s.only.slice(), intervalMax: Math.max(...s.only) + 1,
                  labels: s.help ? "name" : "off", countIn: true, lookahead: 0 } } };
  }

  return { PATHS, STARS, has, get, find, entry, starsOf, isUnlocked, current, next, totals, starsFor, note, merge, describe, optsFor };
})();
