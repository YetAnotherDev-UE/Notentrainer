/* paths.js: Lernpfade. Ein Modus bekommt eine Leiter aus vielen kleinen
 * Stufen, wie ein Abenteuer im Kleinen: Jede Stufe ändert nur eine Sache,
 * und was neu ist, fängt wieder klein an. Es gibt vier Pfade: Gehör,
 * Intervalle, Akkorde und Tonleitern, also alles, was im Abenteuer nicht
 * oder nur kurz vorkommt. Die Stufen sind in Abschnitte gegliedert (group),
 * damit lange Leitern übersichtlich bleiben.
 * Gehör ist schwer, deshalb sind die Schritte dort besonders klein: erst zwei
 * Töne mit Bezugston, dann drei, dann Nachbartöne, und erst spät ohne
 * Bezugston, mit schwarzen Tasten oder in tiefer Lage.
 * Akkorde und Tonleitern: Jeder neue Griff und jede neue Tonleiter wird erst
 * gelernt (Schritt für Schritt mit Fingersatz), dann auf Zeit gespielt. Bei
 * den Akkorden fällt danach die Hilfe weg: erst die Klaviatur, dann die Noten.
 * Sterne wie im Abenteuer: 1 ab 60 %, 2 ab 80 %, 3 ab 95 %; die nächste Stufe
 * öffnet sich mit zwei Sternen. Der Stand liegt in kv "paths":
 * { ear: { id: { stars, best, attempts, at } }, interval: { ... }, ... }.
 * Die Kennungen (id) der Stufen sind fest: Der Stand hängt an ihnen, nicht
 * an der Nummer. Neue Stufen lassen sich einschieben, umbenennen nie. */
"use strict";
window.NT = window.NT || {};

NT.paths = (() => {
  const MU = NT.music;
  const STARS = [60, 80, 95];
  const white = (lo, hi) => { const out = []; for (let m = lo; m <= hi; m++) if (!MU.isBlack(m)) out.push(m); return out; };
  const every = (lo, hi) => { const out = []; for (let m = lo; m <= hi; m++) out.push(m); return out; };
  const group = (name, steps) => steps.map(s => Object.assign(s, { group: name }));

  /* --- Gehör -------------------------------------------------------------- *
   * pool: die Töne, die vorkommen können (MIDI, 60 = C4). anchor: der
   * Bezugston, der vor jeder Frage erklingt, oder null.
   * ------------------------------------------------------------------------ */
  const ear = (id, title, pool, count, x) => Object.assign({ id, title, pool, count, anchor: 60, clef: "treble" }, x);
  const bass = { clef: "bass", anchor: 48 };
  const EAR = [].concat(
    group("Zwei Töne", [
      ear("cg", "Zwei Töne: C und G", [60, 67], 8, { tip: "Vor jedem Ton hörst du das C als Bezugston. Klingt der zweite Ton gleich, ist es das C. Klingt er höher, ist es das G." }),
      ear("cg2", "C und G, länger", [60, 67], 12),
      ear("ce", "C und E", [60, 64], 8, { tip: "Das E liegt näher am C als das G, der Sprung ist kleiner." }),
      ear("cd", "C und D", [60, 62], 8, { tip: "Der kleinste Schritt auf weißen Tasten: Das D liegt direkt neben dem C." }),
    ]),
    group("Drei Töne", [
      ear("ceg", "Drei Töne: C, E, G", [60, 64, 67], 10, { tip: "Neu: drei Töne. Hör, wie weit der Ton vom C weg ist: gar nicht, ein Stück oder weit." }),
      ear("ceg2", "C, E, G, länger", [60, 64, 67], 14),
      ear("cde", "Drei Nachbarn: C, D, E", [60, 62, 64], 10, { tip: "Drei Töne direkt nebeneinander. Summ innerlich mit: C, D, E, wie der Anfang einer Tonleiter." }),
      ear("cde2", "C, D, E, länger", [60, 62, 64], 14),
    ]),
    group("Bis zur Oktave", [
      ear("cdeg", "Vier Töne: C, D, E, G", [60, 62, 64, 67], 12),
      ear("c5", "Fünf Töne: C bis G", white(60, 67), 12, { tip: "Neu dabei: das F. Alle fünf Töne liegen unter einer Hand." }),
      ear("c5b", "C bis G, länger", white(60, 67), 16),
      ear("c6", "Sechs Töne: bis zum A", white(60, 69), 14),
      ear("c7", "Sieben Töne: bis zum H", white(60, 71), 14, { tip: "Das H drängt zum C darüber. Dieses Ziehen hilft beim Erkennen." }),
      ear("c8", "Eine Oktave: C4 bis C5", white(60, 72), 16, { tip: "Das hohe C klingt wie das tiefe, nur heller." }),
      ear("c8b", "Oktave, länger", white(60, 72), 20),
    ]),
    group("Ohne Bezugston", [
      ear("n-ceg", "Ohne Bezugston: C, E, G", [60, 64, 67], 10, { anchor: null, tip: "Neu: Der Bezugston fällt weg. Dein Vergleich ist jetzt der Ton davor. Dafür wieder nur drei Töne." }),
      ear("n-cde", "Ohne Bezugston: C, D, E", [60, 62, 64], 10, { anchor: null }),
      ear("n-c5", "Ohne Bezugston: C bis G", white(60, 67), 12, { anchor: null }),
      ear("n-c8", "Ohne Bezugston: Oktave", white(60, 72), 16, { anchor: null }),
    ]),
    group("Unter dem C", [
      ear("lo1", "Unter dem C: G3 bis C4", white(55, 60), 10, { tip: "Neu: Töne unter dem C. Der Bezugston ist wieder da, es bleibt das C4." }),
      ear("lo2", "G3 bis G4", white(55, 67), 14),
      ear("lo3", "G3 bis C5", white(55, 72), 16),
      ear("n-lo3", "G3 bis C5, ohne Bezugston", white(55, 72), 16, { anchor: null }),
    ]),
    group("Über dem C5", [
      ear("hi1", "Über dem C5: C5 bis G5", white(72, 79), 10, { anchor: 72, tip: "Neu: die Oktave darüber. Der Bezugston ist jetzt das C5." }),
      ear("hi2", "C4 bis G5", white(60, 79), 16),
      ear("n-hi2", "C4 bis G5, ohne Bezugston", white(60, 79), 16, { anchor: null }),
    ]),
    group("Schwarze Tasten", [
      ear("b1", "Schwarze Taste: C, Cis, D", [60, 61, 62], 10, { tip: "Neu: eine schwarze Taste. Das Cis liegt zwischen C und D, einen halben Ton über dem C. Wieder mit Bezugston und nur drei Tönen." }),
      ear("b2", "C bis E, alle Tasten", every(60, 64), 12),
      ear("b3", "C bis G, alle Tasten", every(60, 67), 14),
      ear("b4", "Oktave, alle Tasten", every(60, 72), 18),
      ear("n-b4", "Oktave, alle Tasten, ohne Bezugston", every(60, 72), 18, { anchor: null }),
    ]),
    group("Tiefe Lage", [
      ear("t1", "Tief: C3, E3, G3", [48, 52, 55], 10, Object.assign({ tip: "Neu: die tiefe Lage im Bassschlüssel. Tiefe Töne sind schwerer zu unterscheiden, deshalb wieder nur drei. Bezugston ist das C3." }, bass)),
      ear("t2", "Tief: C3 bis G3", white(48, 55), 12, bass),
      ear("t3", "Tief: C3 bis C4", white(48, 60), 16, bass),
      ear("n-t3", "Tief, ohne Bezugston", white(48, 60), 16, { clef: "bass", anchor: null }),
      ear("t4", "Tief, alle Tasten", every(48, 60), 18, bass),
    ]),
    group("Meister", [
      ear("fin", "Meisterstufe: G3 bis G5, alle Tasten", every(55, 79), 24, { anchor: null, tip: "Zwei Oktaven, alle Tasten, kein Bezugston. Wer hier zwei Sterne holt, hört sehr gut." }),
    ]));

  /* --- Intervalle --------------------------------------------------------- *
   * only: die erlaubten Abstände in Buchstaben (1 = Sekunde ... 7 = Oktave).
   * help: Beschriftung über den Noten; ohne sie behält nur der Anker seinen
   * Namen, und der Abstand muss aus dem System gelesen werden.
   * ------------------------------------------------------------------------ */
  const iv = (id, title, only, low, high, count, bpm, x) => Object.assign({ id, title, only, low, high, count, bpm, help: true, clef: "treble" }, x);
  const upTo = n => { const out = []; for (let i = 1; i <= n; i++) out.push(i); return out; };
  const blind = { help: false };
  const INTERVAL = [].concat(
    group("Sekunde", [
      iv("s1", "Nur Schritte", [1], 60, 67, 8, 50, { tip: "Sekunde heißt: die Nachbarnote, von der Linie in den Zwischenraum oder umgekehrt. Über jeder Note steht, wohin es geht. Die erste Note ist dein Anker." }),
      iv("s2", "Schritte, länger", [1], 60, 67, 12, 50),
      iv("s3", "Schritte ohne Hilfe", [1], 60, 67, 8, 50, { help: false, tip: "Neu: Die Beschriftung fällt weg, nur der Anker behält seinen Namen. Lies selbst, ob es einen Schritt hinauf oder hinunter geht." }),
    ]),
    group("Terz", [
      iv("t1", "Nur Terzen", [2], 60, 72, 8, 50, { tip: "Neu: die Terz. Eine Note wird übersprungen: von Linie zu Linie oder von Zwischenraum zu Zwischenraum." }),
      iv("t2", "Schritte und Terzen", [1, 2], 60, 69, 12, 50),
      iv("t3", "Schritte und Terzen ohne Hilfe", [1, 2], 60, 69, 12, 50, blind),
      iv("t4", "Bis zur Terz, Tempo 55", [1, 2], 60, 72, 14, 55, blind),
    ]),
    group("Quarte", [
      iv("q1", "Nur Quarten", [3], 60, 72, 8, 50, { tip: "Neu: die Quarte. Zwei Noten werden übersprungen, es geht von der Linie in einen Zwischenraum oder umgekehrt." }),
      iv("q2", "Bis zur Quarte", upTo(3), 60, 72, 12, 50),
      iv("q3", "Bis zur Quarte ohne Hilfe", upTo(3), 60, 72, 12, 50, blind),
      iv("q4", "Bis zur Quarte, Tempo 55", upTo(3), 60, 72, 16, 55, blind),
    ]),
    group("Quinte", [
      iv("f1", "Nur Quinten", [4], 60, 74, 8, 50, { tip: "Neu: die Quinte. Von Linie zu Linie mit einer Linie dazwischen, oder von Zwischenraum zu Zwischenraum mit einem dazwischen." }),
      iv("f2", "Bis zur Quinte", upTo(4), 60, 74, 12, 50),
      iv("f3", "Bis zur Quinte ohne Hilfe", upTo(4), 60, 74, 12, 50, blind),
      iv("f4", "Bis zur Quinte, Tempo 60", upTo(4), 60, 74, 16, 60, blind),
    ]),
    group("Sexte", [
      iv("x1", "Nur Sexten", [5], 60, 77, 8, 50, { tip: "Neu: die Sexte. Ein weiter Sprung von der Linie in einen Zwischenraum, eine Note weiter als die Quinte." }),
      iv("x2", "Bis zur Sexte", upTo(5), 60, 77, 12, 50),
      iv("x3", "Bis zur Sexte ohne Hilfe", upTo(5), 60, 77, 14, 50, blind),
    ]),
    group("Septime", [
      iv("p1", "Nur Septimen", [6], 60, 79, 8, 50, { tip: "Neu: die Septime. Von Linie zu Linie mit zwei Linien dazwischen, fast eine Oktave." }),
      iv("p2", "Bis zur Septime", upTo(6), 60, 79, 12, 50),
      iv("p3", "Bis zur Septime ohne Hilfe", upTo(6), 60, 79, 14, 50, blind),
    ]),
    group("Oktave", [
      iv("o1", "Nur Oktaven", [7], 57, 81, 8, 50, { tip: "Neu: die Oktave. Derselbe Ton acht Buchstaben weiter, von der Linie in einen Zwischenraum. Die Hand spannt weit." }),
      iv("o2", "Bis zur Oktave", upTo(7), 60, 79, 12, 50),
      iv("o3", "Bis zur Oktave ohne Hilfe", upTo(7), 60, 79, 16, 50, blind),
      iv("o4", "Bis zur Oktave, Tempo 60", upTo(7), 60, 79, 16, 60, blind),
    ]),
    group("Bassschlüssel", [
      iv("b1", "Bass: Schritte und Terzen", [1, 2], 48, 57, 10, 50, { clef: "bass", tip: "Neu: der Bassschlüssel. Die Abstände sehen genauso aus, nur die Töne heißen anders. Wieder mit Beschriftung und kleinen Abständen." }),
      iv("b2", "Bass: bis zur Quinte", upTo(4), 45, 60, 12, 50, { clef: "bass" }),
      iv("b3", "Bass: bis zur Quinte ohne Hilfe", upTo(4), 45, 60, 12, 50, { clef: "bass", help: false }),
      iv("b4", "Bass: bis zur Oktave", upTo(7), 41, 60, 12, 50, { clef: "bass" }),
      iv("b5", "Bass: bis zur Oktave ohne Hilfe", upTo(7), 41, 60, 16, 50, { clef: "bass", help: false }),
    ]),
    group("Tempo", [
      iv("m1", "Alles, Tempo 65", upTo(7), 60, 79, 20, 65, blind),
      iv("m2", "Alles, Tempo 70", upTo(7), 60, 79, 20, 70, blind),
      iv("m3", "Alles, Tempo 75", upTo(7), 60, 79, 20, 75, blind),
      iv("m4", "Weiter Umfang: A3 bis A5", upTo(7), 57, 81, 24, 75, blind),
      iv("m5", "Meisterstufe: Tempo 80", upTo(7), 57, 81, 24, 80, { help: false, tip: "Alle Abstände bis zur Oktave, ohne Hilfe, im Tempo eines ruhigen Stücks." }),
    ]));

  /* --- Akkorde ------------------------------------------------------------ *
   * Zwei Arten von Stufen: „lernen“ (ein Griff Schritt für Schritt: jeder
   * Finger einzeln, aufbauen, dreimal zusammen) und „auf Zeit“ (der Name
   * erscheint, greifen). list: die Akkorde der Runde als [Grundton, Art,
   * Umkehrung], Grundton als Halbton ab C. help: full (Klaviatur, Hand und
   * Noten), notes (nur Noten), name (nur der Name). order "cycle": in der
   * Reihenfolge der Liste statt gemischt.
   * ------------------------------------------------------------------------ */
  const C = 0, Des = 1, D = 2, Es = 3, E = 4, F = 5, Fis = 6, G = 7, As = 8, A = 9, B = 10, H = 11;
  const cl = (id, title, root, type, x) => Object.assign({ id, title, kind: "chordLearn", root, type, inv: 0, hand: "r" }, x);
  const ct = (id, title, list, count, x) => Object.assign({ id, title, kind: "chordTime", list, count, hand: "r", help: "full" }, x);
  const cad = (id, title, root, type, count, x) => Object.assign({ id, title, kind: "chordTime", set: "cadence", root, type, count, hand: "r", help: "full" }, x);
  const notes = { help: "notes" }, name = { help: "name" }, left = { hand: "l" };
  const all12 = type => Array.from({ length: 12 }, (_, r) => [r, type, 0]);
  // Grundstellung, jede Umkehrung hinauf und wieder zurück, als Runde.
  const through = (root, type, top) => { const out = []; for (let i = 0; i <= top; i++) out.push([root, type, i]); for (let i = top - 1; i >= 1; i--) out.push([root, type, i]); return out; };
  const DUR3 = [[C, "dur", 0], [F, "dur", 0], [G, "dur", 0]], MOLL3 = [[A, "moll", 0], [D, "moll", 0], [E, "moll", 0]], WHITE6 = DUR3.concat(MOLL3);
  const SHARP3 = [[D, "dur", 0], [A, "dur", 0], [E, "dur", 0]], FLATM3 = [[C, "moll", 0], [G, "moll", 0], [F, "moll", 0]], WHITE12 = WHITE6.concat(SHARP3, FLATM3);
  const CFG_INV = [C, F, G].flatMap(r => [0, 1, 2].map(i => [r, "dur", i]));
  const SEPT_C = [[C, "maj7", 0], [D, "m7", 0], [E, "m7", 0], [F, "maj7", 0], [G, "dom7", 0], [A, "m7", 0]];
  const SEPT_ALL = ["dom7", "maj7", "m7"].flatMap(all12);
  const CHORD = [].concat(
    group("Erste Griffe", [
      cl("c", "C-Dur lernen", C, "dur", { tip: "Ein Akkord sind mehrere Töne zugleich. C-Dur: Daumen auf C, Mittelfinger auf E, kleiner Finger auf G. Erst jeder Finger einzeln, dann alle zusammen." }),
      ct("c-t", "C-Dur auf Zeit", [[C, "dur", 0]], 6, { tip: "Neu: auf Zeit. Der Name erscheint, die Uhr läuft, bis alle drei Töne liegen. Für die Sterne zählt nur, ob der Griff sauber ist, nicht die Zeit." }),
      cl("g", "G-Dur lernen", G, "dur", { tip: "Dieselbe Handform wie bei C-Dur, fünf Tasten weiter rechts: G, H, D." }),
      ct("cg", "C und G im Wechsel", [[C, "dur", 0], [G, "dur", 0]], 8),
      cl("f", "F-Dur lernen", F, "dur"),
      ct("cfg", "C, F und G", DUR3, 10, { tip: "Die drei wichtigsten Akkorde in C-Dur. Mit ihnen lässt sich fast jedes einfache Lied begleiten." }),
      ct("cfg-n", "C, F, G: nur Noten", DUR3, 10, { help: "notes", tip: "Neu: Die Klaviatur mit der Hand fällt weg. Du liest den Griff aus den Noten." }),
      ct("cfg-x", "C, F, G: nur der Name", DUR3, 10, { help: "name", tip: "Neu: Jetzt steht nur noch der Name da. Den Griff holst du aus dem Kopf." }),
    ]),
    group("Moll", [
      cl("am", "a-Moll lernen", A, "moll", { tip: "Neu: Moll. Der mittlere Ton liegt einen halben Ton tiefer als in Dur, das klingt dunkler. a-Moll braucht nur weiße Tasten: A, C, E." }),
      cl("dm", "d-Moll lernen", D, "moll"),
      cl("em", "e-Moll lernen", E, "moll"),
      ct("ade", "a-Moll, d-Moll und e-Moll", MOLL3, 10),
      ct("w6", "Dur und Moll gemischt", WHITE6, 12, { tip: "Im Kürzel steht ein kleines m für Moll: Am ist a-Moll, A allein wäre A-Dur." }),
      ct("w6-n", "Dur und Moll: nur Noten", WHITE6, 12, notes),
      ct("w6-x", "Dur und Moll: nur der Name", WHITE6, 12, name),
    ]),
    group("Schwarze Mitte", [
      cl("d", "D-Dur lernen", D, "dur", { tip: "Neu: eine schwarze Taste. In D-Dur liegt der Mittelfinger auf dem Fis. Die ganze Hand rückt dafür ein Stück in die Tasten hinein." }),
      cl("a", "A-Dur lernen", A, "dur"),
      cl("e", "E-Dur lernen", E, "dur"),
      ct("dae", "D, A und E", SHARP3, 10),
      cl("cm", "c-Moll lernen", C, "moll", { tip: "Aus C-Dur wird c-Moll, wenn der Mittelfinger vom E auf das Es rückt, die schwarze Taste links daneben." }),
      cl("gm", "g-Moll lernen", G, "moll"),
      cl("fm", "f-Moll lernen", F, "moll"),
      ct("cgf-m", "c-Moll, g-Moll und f-Moll", FLATM3, 10),
      ct("w12", "Alle weißen Grundtöne", WHITE12, 14),
      ct("w12-n", "Weiße Grundtöne: nur Noten", WHITE12, 14, notes),
      ct("w12-x", "Weiße Grundtöne: nur der Name", WHITE12, 14, name),
    ]),
    group("Umkehrungen", [
      cl("c1", "C-Dur, erste Umkehrung", C, "dur", { inv: 1, tip: "Neu: Umkehrung. Dieselben drei Töne, aber das E liegt unten und das C oben. Der Fingersatz ändert sich: 1 2 5." }),
      cl("c2", "C-Dur, zweite Umkehrung", C, "dur", { inv: 2, tip: "Jetzt liegt das G unten. Rechts greifen wieder die Finger 1 3 5." }),
      ct("c-inv", "C-Dur durch alle Umkehrungen", through(C, "dur", 2), 9, { order: "cycle", tip: "Grundstellung, erste, zweite Umkehrung und wieder zurück. Unten muss der richtige Ton liegen." }),
      ct("g-inv", "G-Dur durch alle Umkehrungen", through(G, "dur", 2), 9, { order: "cycle" }),
      ct("f-inv", "F-Dur durch alle Umkehrungen", through(F, "dur", 2), 9, { order: "cycle" }),
      ct("am-inv", "a-Moll durch alle Umkehrungen", through(A, "moll", 2), 9, { order: "cycle" }),
      ct("cfg-inv", "C, F, G in allen Lagen", CFG_INV, 12),
      ct("cfg-inv-n", "C, F, G in allen Lagen: nur Noten", CFG_INV, 12, notes),
    ]),
    group("Kadenzen", [
      cad("k-c", "Kadenz in C-Dur", C, "dur", 8, { tip: "Neu: die Kadenz. C, F, G und zurück zu C, so gelegt, dass die Hand fast liegen bleibt. F steht in der zweiten, G in der ersten Umkehrung." }),
      cad("k-g", "Kadenz in G-Dur", G, "dur", 8),
      cad("k-f", "Kadenz in F-Dur", F, "dur", 8),
      cad("k-am", "Kadenz in a-Moll", A, "moll", 8, { tip: "In Moll ist der Akkord der fünften Stufe trotzdem ein Dur-Akkord: E-Dur, mit dem Gis." }),
      cad("k-dm", "Kadenz in d-Moll", D, "moll", 8),
      cad("k-d", "Kadenz in D-Dur", D, "dur", 8),
      cad("k-c-x", "Kadenz in C-Dur: nur der Name", C, "dur", 8, name),
    ]),
    group("Linke Hand", [
      cl("l-c", "C-Dur links lernen", C, "dur", { hand: "l", tip: "Neu: die linke Hand. Der Fingersatz ist gespiegelt: kleiner Finger auf C, Mittelfinger auf E, Daumen auf G." }),
      ct("l-cfg", "C, F und G links", DUR3, 10, left),
      cl("l-am", "a-Moll links lernen", A, "moll", left),
      ct("l-w6", "Dur und Moll links", WHITE6, 12, left),
      ct("l-w6-n", "Links: nur Noten", WHITE6, 12, { hand: "l", help: "notes", tip: "Neu: der Bassschlüssel ohne Klaviatur. Das C3 sitzt im zweiten Zwischenraum von unten." }),
      ct("l-w6-x", "Links: nur der Name", WHITE6, 12, { hand: "l", help: "name" }),
      ct("l-w12", "Links: alle weißen Grundtöne", WHITE12, 14, left),
      cl("l-c1", "C-Dur links, erste Umkehrung", C, "dur", { hand: "l", inv: 1, tip: "Links bleibt es in der ersten Umkehrung bei 5 3 1. Erst in der zweiten wechselt der Fingersatz." }),
      cl("l-c2", "C-Dur links, zweite Umkehrung", C, "dur", { hand: "l", inv: 2, tip: "Unten liegt jetzt eine Quarte, deshalb greift links der zweite Finger: 5 2 1." }),
      ct("l-c-inv", "C-Dur links durch alle Umkehrungen", through(C, "dur", 2), 9, { hand: "l", order: "cycle" }),
      cad("l-k-c", "Kadenz in C-Dur links", C, "dur", 8, left),
      cad("l-k-g", "Kadenz in G-Dur links", G, "dur", 8, left),
      cad("l-k-am", "Kadenz in a-Moll links", A, "moll", 8, left),
    ]),
    group("Schwarze Grundtöne", [
      cl("bb", "B-Dur lernen", B, "dur", { tip: "Neu: Der Grundton liegt auf einer schwarzen Taste. B-Dur ist B, D, F. Hier spielt der Daumen die schwarze Taste, die Hand liegt weit in den Tasten." }),
      cl("eb", "Es-Dur lernen", Es, "dur"),
      cl("ab", "As-Dur lernen", As, "dur"),
      ct("flat3", "B, Es und As", [[B, "dur", 0], [Es, "dur", 0], [As, "dur", 0]], 10),
      cl("h", "H-Dur lernen", H, "dur", { tip: "H-Dur hat zwei schwarze Tasten: H, Dis, Fis." }),
      cl("fis", "Fis-Dur lernen", Fis, "dur", { tip: "Fis-Dur liegt ganz auf schwarzen Tasten." }),
      cl("des", "Des-Dur lernen", Des, "dur"),
      ct("sharp3", "H, Fis und Des", [[H, "dur", 0], [Fis, "dur", 0], [Des, "dur", 0]], 10),
      ct("dur12", "Alle Dur-Akkorde", all12("dur"), 14),
      ct("circle", "Dur im Quintenzirkel", [C, G, D, A, E, H, Fis, Des, As, Es, B, F].map(r => [r, "dur", 0]), 12, { order: "cycle", tip: "Der Quintenzirkel: Jeder Grundton liegt fünf Töne über dem vorigen. C, G, D, A, E, H und so weiter, bis es wieder beim C ankommt." }),
      ct("dur12-x", "Alle Dur-Akkorde: nur der Name", all12("dur"), 14, name),
      cl("hm", "h-Moll lernen", H, "moll"),
      cl("fism", "fis-Moll lernen", Fis, "moll"),
      cl("bm", "b-Moll lernen", B, "moll"),
      ct("moll12", "Alle Moll-Akkorde", all12("moll"), 14),
      ct("moll12-x", "Alle Moll-Akkorde: nur der Name", all12("moll"), 14, name),
      ct("dm24-x", "Dur und Moll: nur der Name", all12("dur").concat(all12("moll")), 16, name),
    ]),
    group("Vierklänge", [
      cl("g7", "G7 lernen", G, "dom7", { tip: "Neu: ein Akkord aus vier Tönen. G7 ist G-Dur mit dem F obendrauf. Er klingt gespannt und will zurück nach C." }),
      cl("c7", "C7 lernen", C, "dom7"),
      cl("d7", "D7 lernen", D, "dom7"),
      ct("dom3", "G7, C7 und D7", [[G, "dom7", 0], [C, "dom7", 0], [D, "dom7", 0]], 10),
      cl("cmaj7", "Cmaj7 lernen", C, "maj7", { tip: "Der große Septakkord: C-Dur mit dem H obendrauf. Er klingt weich und schwebend." }),
      cl("am7", "Am7 lernen", A, "m7", { tip: "Der Moll-Septakkord: a-Moll mit dem G obendrauf." }),
      cl("dm7", "Dm7 lernen", D, "m7"),
      ct("sept-c", "Septakkorde in C-Dur", SEPT_C, 12, { tip: "Die sechs Septakkorde, die nur weiße Tasten brauchen: Cmaj7, Dm7, Em7, Fmaj7, G7 und Am7." }),
      ct("sept-c-x", "Septakkorde in C-Dur: nur der Name", SEPT_C, 12, name),
      cl("g7-1", "G7, erste Umkehrung", G, "dom7", { inv: 1, tip: "Vier Töne haben drei Umkehrungen. In jeder liegen zwei Töne direkt nebeneinander, hier F und G ganz oben." }),
      cl("g7-2", "G7, zweite Umkehrung", G, "dom7", { inv: 2 }),
      cl("g7-3", "G7, dritte Umkehrung", G, "dom7", { inv: 3 }),
      ct("g7-inv", "G7 durch alle Umkehrungen", through(G, "dom7", 3), 13, { order: "cycle" }),
      ct("sept-all", "Septakkorde auf allen Grundtönen", SEPT_ALL, 14),
      ct("sept-all-x", "Septakkorde: nur der Name", SEPT_ALL, 14, name),
    ]),
    group("Besondere Klänge", [
      cl("hdim", "H vermindert lernen", H, "dim", { tip: "Vermindert: zwei kleine Terzen übereinander. H, D, F klingt gespannt und will sich auflösen." }),
      cl("caug", "C übermäßig lernen", C, "aug", { tip: "Übermäßig: zwei große Terzen übereinander. C, E, Gis klingt schwebend." }),
      cl("csus4", "Csus4 lernen", C, "sus4", { tip: "sus4: Statt der Terz liegt die Quarte. C, F, G. Meist löst sich das F danach ins E auf." }),
      cl("csus2", "Csus2 lernen", C, "sus2", { tip: "sus2: Statt der Terz liegt die Sekunde. C, D, G." }),
      ct("special", "Besondere Klänge gemischt", [[H, "dim", 0], [C, "aug", 0], [C, "sus4", 0], [C, "sus2", 0]], 10),
    ]),
    group("Meister", [
      ct("tri-x", "Alle Dreiklänge: nur der Name", ["dur", "moll", "dim", "aug"].flatMap(all12), 16, name),
      ct("all-x", "Meisterstufe: alle Arten", Object.keys(MU.CHORDS).flatMap(all12), 20, { help: "name", tip: "Alle dreizehn Arten auf allen zwölf Grundtönen, nur mit dem Namen." }),
    ]));

  /* --- Tonleitern --------------------------------------------------------- *
   * Drei Arten von Stufen: „lernen“ (Ton für Ton mit Fingersatz), „auf Zeit“
   * (rauf und runter, die Uhr läuft) und „im Takt“ (die Töne laufen ein, bpm).
   * ------------------------------------------------------------------------ */
  const sl = (id, title, root, type, x) => Object.assign({ id, title, kind: "scaleLearn", root, type, octaves: 1, hand: "r" }, x);
  const st = (id, title, root, type, x) => Object.assign({ id, title, kind: "scaleTime", root, type, octaves: 1, hand: "r" }, x);
  const sp = (id, title, root, type, bpm, x) => Object.assign({ id, title, kind: "tempo", root, type, octaves: 1, hand: "r", bpm }, x);
  // Das übliche Paar für etwas Neues: erst lernen, dann auf Zeit.
  const pair = (id, what, root, type, x, tip) => [sl(id, what + " lernen", root, type, Object.assign({}, x, tip ? { tip } : {})), st(id + "-t", what + " auf Zeit", root, type, x)];
  const two = { octaves: 2 };
  const SCALE = [].concat(
    group("Fünf Finger", [
      sl("f-c", "Fünffingerlage C-Dur lernen", C, "fuenfDur", { tip: "Fünf Finger auf fünf Nachbartasten, jeder hat seine Taste. Einmal rauf und wieder runter." }),
      st("f-c-t", "Fünffingerlage C-Dur auf Zeit", C, "fuenfDur", { tip: "Neu: auf Zeit. Die Uhr startet mit dem ersten Ton. Für die Sterne zählt nur, ob die Töne stimmen, nicht die Zeit." }),
      sl("f-g", "Fünffingerlage G-Dur lernen", G, "fuenfDur"),
      sl("f-am", "Fünffingerlage a-Moll lernen", A, "fuenfMoll", { tip: "Moll: Der dritte Ton liegt einen halben Ton tiefer als in Dur. In a-Moll bleiben trotzdem alle Tasten weiß." }),
      sl("f-d", "Fünffingerlage D-Dur lernen", D, "fuenfDur", { tip: "Neu: eine schwarze Taste. Der Mittelfinger spielt das Fis." }),
      st("f-d-t", "Fünffingerlage D-Dur auf Zeit", D, "fuenfDur"),
    ]),
    group("C-Dur", [
      sl("c", "C-Dur lernen", C, "dur", { tip: "Neu: acht Töne, aber nur fünf Finger. Nach dem dritten Ton geht der Daumen unter der Hand durch zum F. Das ist der Daumenuntersatz." }),
      st("c-t", "C-Dur auf Zeit", C, "dur"),
      sp("c-50", "C-Dur im Takt, Tempo 50", C, "dur", 50, { tip: "Neu: im Takt. Die Töne laufen von rechts ein, ein Ton je Schlag. Jetzt zählt auch, ob du gleichmäßig spielst." }),
      sp("c-60", "C-Dur im Takt, Tempo 60", C, "dur", 60),
    ]),
    group("Kreuz-Tonarten", [].concat(
      pair("g", "G-Dur", G, "dur", {}, "Ein Kreuz: Aus dem F wird das Fis. Der Fingersatz bleibt wie in C-Dur."),
      pair("d", "D-Dur", D, "dur", {}, "Zwei Kreuze: Fis und Cis."),
      [sp("g-60", "G-Dur im Takt, Tempo 60", G, "dur", 60)],
      pair("a", "A-Dur", A, "dur", {}, "Drei Kreuze: Fis, Cis und Gis."),
      pair("e", "E-Dur", E, "dur", {}, "Vier Kreuze: Fis, Cis, Gis und Dis."),
      [sp("d-60", "D-Dur im Takt, Tempo 60", D, "dur", 60)])),
    group("B-Tonarten", [].concat(
      pair("f", "F-Dur", F, "dur", {}, "Neu: ein anderer Fingersatz. In F-Dur greift die rechte Hand erst vier Töne, der vierte Finger liegt auf dem B. Dann setzt der Daumen unter."),
      pair("bb", "B-Dur", B, "dur", {}, "Die Tonleiter beginnt auf einer schwarzen Taste, deshalb mit dem zweiten Finger. Der Daumen nimmt gleich danach das C."),
      [sp("f-60", "F-Dur im Takt, Tempo 60", F, "dur", 60)],
      pair("eb", "Es-Dur", Es, "dur", {}, "Drei Bs: B, Es und As."),
      pair("ab", "As-Dur", As, "dur", {}, "Vier Bs: B, Es, As und Des."))),
    group("Moll", [].concat(
      pair("am", "a-Moll", A, "moll", {}, "Natürliches Moll: dieselben Tasten wie C-Dur, aber ab A."),
      pair("am-h", "a-Moll harmonisch", A, "harmonisch", {}, "Harmonisch: Der siebte Ton wird erhöht, aus G wird Gis. Davor liegt ein ungewohnt großer Schritt."),
      pair("em", "e-Moll", E, "moll", {}, "Ein Kreuz, wie G-Dur: das Fis."),
      pair("dm", "d-Moll", D, "moll", {}, "Ein B, wie F-Dur."),
      pair("dm-h", "d-Moll harmonisch", D, "harmonisch"),
      [sp("am-60", "a-Moll im Takt, Tempo 60", A, "moll", 60)])),
    group("Linke Hand", [].concat(
      [sl("l-f-c", "Fünffingerlage C-Dur links", C, "fuenfDur", { hand: "l", tip: "Neu: die linke Hand. Sie beginnt unten mit dem kleinen Finger." })],
      pair("l-c", "C-Dur links", C, "dur", left, "Links aufwärts: 5 4 3 2 1, dann greift der dritte Finger über den Daumen. Das ist das Übersetzen."),
      pair("l-g", "G-Dur links", G, "dur", left),
      pair("l-d", "D-Dur links", D, "dur", left),
      pair("l-f", "F-Dur links", F, "dur", left, "Links hat F-Dur denselben Fingersatz wie C-Dur."),
      pair("l-am", "a-Moll links", A, "moll", left),
      [sp("l-c-50", "C-Dur links im Takt, Tempo 50", C, "dur", 50, left)])),
    group("Zwei Oktaven", [].concat(
      pair("c2", "C-Dur, zwei Oktaven", C, "dur", two, "Neu: zwei Oktaven. Der Daumen setzt dreimal unter, die Hand wandert immer weiter."),
      pair("g2", "G-Dur, zwei Oktaven", G, "dur", two),
      pair("f2", "F-Dur, zwei Oktaven", F, "dur", two),
      pair("l-c2", "C-Dur links, zwei Oktaven", C, "dur", { octaves: 2, hand: "l" }),
      [sp("c2-60", "C-Dur, zwei Oktaven im Takt", C, "dur", 60, two)])),
    group("Läufe", [].concat(
      pair("chrom", "Chromatisch ab C", C, "chrom", {}, "Jede Taste, weiß und schwarz. Der Daumen nimmt die weißen, der dritte Finger die schwarzen."),
      pair("arp-c", "C-Dur gebrochen", C, "arpDur", {}, "Der Akkord, Ton für Ton nacheinander: C, E, G und das C darüber."),
      pair("arp-am", "a-Moll gebrochen", A, "arpMoll"),
      pair("pen-c", "Pentatonik C-Dur", C, "pentaDur", {}, "Nur fünf Töne je Oktave: C, D, E, G, A. Die Hand greift drei, dann zwei."),
      pair("pen-am", "Pentatonik a-Moll", A, "pentaMoll"),
      pair("blues-a", "Blues in A", A, "blues", {}, "Die Moll-Pentatonik mit einem eingeschobenen Ton, der Blue Note. Sie bekommt den vierten Finger."))),
    group("Meister", [].concat(
      pair("h", "H-Dur", H, "dur", {}, "Fünf Kreuze. Die langen Finger liegen auf den schwarzen Tasten, das liegt gut in der Hand."),
      pair("fis", "Fis-Dur", Fis, "dur"),
      pair("des", "Des-Dur", Des, "dur"),
      pair("cm", "c-Moll", C, "moll"),
      pair("gm", "g-Moll", G, "moll"),
      [sp("c-70", "C-Dur im Takt, Tempo 70", C, "dur", 70), sp("c-80", "C-Dur im Takt, Tempo 80", C, "dur", 80),
       sp("c2-70", "C-Dur, zwei Oktaven, Tempo 70", C, "dur", 70, two), sp("c2-80", "Meisterstufe: zwei Oktaven, Tempo 80", C, "dur", 80, two)])));

  const PATHS = {
    ear: { mode: "ear", title: "Gehör", colors: ["#b79bff", "#7c3aed"], steps: EAR, free: "mode",
           intro: "Ton hören, Taste finden. In kleinen Stufen, erst zwei Töne, dann immer einer mehr." },
    interval: { mode: "interval", title: "Intervalle", colors: ["#2dd4ff", "#1d4ed8"], steps: INTERVAL, free: "mode",
                intro: "Abstände lesen statt Namen. Jedes Intervall erst allein, dann gemischt, dann ohne Hilfe." },
    chord: { mode: "chord", title: "Akkorde", colors: ["#fda4af", "#e11d48"], steps: CHORD, free: "forms", partner: "scale",
             intro: "Griffe lernen, einen nach dem anderen. Erst mit Klaviatur und Hand, dann aus den Noten, dann nur nach dem Namen." },
    scale: { mode: "scale", title: "Tonleitern", colors: ["#5ee8b3", "#12a874"], steps: SCALE, free: "forms", partner: "chord",
             intro: "Tonleitern mit Fingersatz. Jede erst Ton für Ton lernen, dann auf Zeit, dann im Takt." },
  };
  for (const p of Object.values(PATHS)) {
    p.steps.forEach((s, i) => { s.index = i; s.n = i + 1; s.key = p.mode + ":" + s.id; });
    p.groups = Array.from(new Set(p.steps.map(s => s.group)));
  }
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
  function totals(prog, mode, grp) {
    const steps = PATHS[mode].steps.filter(s => grp == null || s.group === grp); let stars = 0, done = 0;
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
  const HAND = { r: "rechte Hand", l: "linke Hand" };
  const HELP = { full: "mit Klaviatur, Hand und Noten", notes: "nur Noten, ohne Klaviatur", name: "nur der Name" };
  const names = (midis, naming) => midis.map(m => MU.name(m, naming)).join(", ");
  // Die Akkorde einer Stufe: aus der Liste oder aus der Kadenz.
  function chordsOf(s) {
    if (s.kind === "chordLearn") return [MU.chord(s.root, s.type, s.inv || 0, s.hand)];
    if (s.set === "cadence") return MU.cadence(s.root, s.type === "moll" ? "moll" : "dur", s.hand);
    return s.list.map(([r, t, i]) => MU.chord(r, t, i || 0, s.hand));
  }
  const symbolOf = (ch, naming) => MU.chordSymbol(ch.rootPc, ch.type, naming, [ch.rootLetter, ch.rootAlter]);
  function describe(mode, s, naming) {
    const parts = [];
    if (mode === "ear") {
      parts.push(s.pool.length <= 6 ? "Töne: " + names(s.pool, naming) : s.pool.length + " Töne von " + MU.name(s.pool[0], naming) + " bis " + MU.name(s.pool[s.pool.length - 1], naming));
      parts.push(s.pool.some(MU.isBlack) ? "mit schwarzen Tasten" : "nur weiße Tasten");
      parts.push(s.anchor != null ? "Bezugston " + MU.name(s.anchor, naming) : "ohne Bezugston");
      parts.push(s.count + " Versuche");
    } else if (mode === "interval") {
      const iv = s.only.map(d => MU.intervalName(d)), plural = w => w + (w.endsWith("e") ? "n" : "en");
      parts.push(iv.length === 1 ? "nur " + plural(iv[0]) : iv.length > 2 ? iv[0] + " bis " + iv[iv.length - 1] : iv.join(" und "));
      parts.push(CLEF[s.clef], MU.name(s.low, naming) + " bis " + MU.name(s.high, naming), s.count + " Noten", s.bpm + " Schläge/min");
      parts.push(s.help ? "mit Beschriftung" : "ohne Beschriftung");
    } else if (mode === "chord") {
      const chords = chordsOf(s);
      if (s.kind === "chordLearn") {
        const ch = chords[0];
        parts.push("Lernen: jeder Finger einzeln, dann aufbauen, dann dreimal zusammen");
        parts.push("Töne " + ch.tones.map(t => MU.nameOf(t.letter, t.alter, naming)).join(" "), "Finger " + ch.tones.map(t => t.finger).join(" "), HAND[s.hand]);
      } else {
        const seen = []; for (const ch of chords) { const n = symbolOf(ch, naming); if (!seen.includes(n)) seen.push(n); }
        const inv = chords.some(ch => ch.inv > 0);
        parts.push("Auf Zeit: " + s.count + " Akkorde");
        parts.push((s.set === "cadence" ? "Kadenz " : "") + (seen.length <= 8 ? seen.join(", ") : seen.slice(0, 6).join(", ") + " und " + (seen.length - 6) + " weitere"));
        if (inv) parts.push(s.set === "cadence" ? "in Umkehrungen, die Hand bleibt fast liegen" : "mit Umkehrungen");
        parts.push(HAND[s.hand], HELP[s.help]);
      }
    } else {
      const sc = MU.scaleNotes(s.root, s.type, s.octaves, s.hand), up = sc.notes.slice(0, sc.up);
      parts.push(s.kind === "scaleLearn" ? "Lernen: Ton für Ton mit Fingersatz" : s.kind === "scaleTime" ? "Auf Zeit: rauf und runter, die Uhr läuft" : "Im Takt: die Töne laufen ein, " + s.bpm + " Schläge/min");
      parts.push(MU.scaleTitle(s.root, s.type, naming), /^fuenf/.test(s.type) ? "fünf Töne" : s.octaves > 1 ? s.octaves + " Oktaven" : "eine Oktave", HAND[s.hand]);
      if (up.length <= 9) parts.push("Finger " + up.map(n => n.finger).join(" "));
    }
    return parts.join(" · ");
  }
  /* Was zum Starten nötig ist. engine "game": NT.game mit mode und opts;
   * engine "grip": NT.grip mit kind und opts. */
  function optsFor(mode, s) {
    const p = { mode, id: s.id, key: s.key }, title = "Stufe " + s.n + ": " + s.title;
    if (mode === "ear")
      return { engine: "game", mode, opts: { pool: s.pool.slice(), path: p, title,
        override: { clef: s.clef, keys: s.pool.some(MU.isBlack) ? "all" : "white", singleCount: s.count, earAnchor: s.anchor, earIntro: true, earLegend: true } } };
    if (mode === "interval")
      return { engine: "game", mode, opts: { path: p, title,
        override: { clef: s.clef, keys: "white", low: s.low, high: s.high, bpm: s.bpm, runLength: s.count, intervalOnly: s.only.slice(), intervalMax: Math.max(...s.only) + 1,
                    labels: s.help ? "name" : "off", countIn: true, lookahead: 0 } } };
    if (mode === "chord") {
      const first = s.list ? s.list[0] : [s.root, s.type, s.inv || 0];
      return { engine: "grip", kind: s.kind, opts: { root: first[0], type: first[1], inv: first[2] || 0, hand: s.hand, help: s.help || "full", count: s.count || 10,
        set: s.kind === "chordLearn" ? "one" : s.set || "list", list: s.list ? s.list.map(c => c.slice()) : null, order: s.order || "shuffle", path: p, pathTitle: "Lernpfad " + s.n } };
    }
    if (s.kind === "tempo")
      return { engine: "game", mode: "scale", opts: { path: p, title,
        override: { scaleRoot: s.root, scaleType: s.type, scaleOctaves: s.octaves, clef: s.hand === "l" ? "bass" : "treble", bpm: s.bpm, countIn: true, lookahead: 0 } } };
    return { engine: "grip", kind: s.kind, opts: { root: s.root, type: s.type, octaves: s.octaves, hand: s.hand, help: "full", path: p, pathTitle: "Lernpfad " + s.n } };
  }

  return { PATHS, STARS, has, get, find, entry, starsOf, isUnlocked, current, next, totals, starsFor, note, merge, describe, optsFor, chordsOf };
})();
