/* story.js: das Abenteuer. Vierzehn Welten, jede mit Levels, die vom
 * Anfaenger zum Koenner fuehren: erst zwei Toene stehend, dann Laeufe, mehr
 * Umfang, Intervalle, Bassschluessel, Hilfslinien, Rhythmus, schwarze Tasten,
 * Tonleitern, Stuecke, linke Hand, beide Haende, Tempo, Blindflug, Meister.
 * Grundsatz: Jede neue Mechanik faengt wieder klein an (wenige Toene, langsam,
 * kurz, oft erst stehend), danach aendert sich je Level nur eine Sache in
 * kleinen Schritten (Tempo +5, zwei Toene mehr, ein paar Noten mehr). Lieber
 * mehr Level als grosse Spruenge. Jedes Level legt fest, was das Spiel sonst
 * aus den Einstellungen nimmt (Schluessel, Umfang, Tasten, Tempo, Anzahl).
 * Sterne aus der Trefferquote: 1 ab 60 %, 2 ab 80 %, 3 ab 95 %; das naechste
 * Level oeffnet sich mit zwei Sternen. Bosse haben etwas strengere Schwellen.
 * Fortschritt liegt in kv "story": { levels: { id: { stars, best, attempts } } }. */
"use strict";
window.NT = window.NT || {};

NT.story = (() => {
  const MU = NT.music;
  const STARS = [60, 80, 95], BOSS_STARS = [70, 85, 97];

  // Kurzformen fuer die Levelliste. Tonhoehen als MIDI: 60 = C4.
  const single = (title, low, high, count, x) => Object.assign({ title, mode: "single", low, high, count }, x);
  const run = (title, low, high, count, bpm, x) => Object.assign({ title, mode: "run", low, high, count, bpm }, x);
  const iv = (title, low, high, count, bpm, intervalMax, x) => Object.assign({ title, mode: "interval", low, high, count, bpm, intervalMax }, x);
  const rhythm = (title, bars, set, bpm, x) => Object.assign({ title, mode: "rhythm", bars, set, bpm }, x);
  const scale = (title, root, type, octaves, bpm, x) => Object.assign({ title, mode: "scale", root, type, octaves, bpm }, x);
  const phrase = (title, pieceId, hand, count, bpm, x) => Object.assign({ title, mode: "phrase", pieceId, hand, count, bpm }, x);
  const piece = (title, pieceId, hand, bpm, x) => Object.assign({ title, mode: "piece", pieceId, hand, bpm }, x);
  const boss = l => Object.assign(l, { boss: true });

  const WORLDS = [
    { id: "w1", title: "Erste Schritte", sub: "Zwei Töne, dann fünf", colors: ["#5ee8b3", "#12a874"], clef: "treble", levels: [
      single("Zwei Töne", 60, 62, 8, { tip: "C4 liegt auf der Hilfslinie unter dem System, D4 hängt direkt darunter an der ersten Linie. Die Note steht, du hast Zeit." }),
      single("Zwei Töne, länger", 60, 62, 12),
      single("Drei Töne", 60, 64, 12, { tip: "E4 sitzt auf der untersten Linie." }),
      run("Erster Lauf", 60, 62, 8, 50, { tip: "Neu: Die Noten kommen von rechts. Triff die Taste, wenn die Note die rote Linie erreicht. Nur zwei Töne, ganz langsam." }),
      run("Lauf mit drei Tönen", 60, 64, 10, 50),
      run("Ein bisschen schneller", 60, 64, 12, 55),
      single("Vier Töne", 60, 65, 12, { tip: "F4 sitzt im ersten Zwischenraum." }),
      single("Fünf Finger", 60, 67, 14, { tip: "G4 liegt auf der zweiten Linie: da schlingt sich der Schlüssel herum." }),
      run("Vier im Lauf", 60, 65, 12, 55),
      run("Fünf im Lauf", 60, 67, 16, 55),
      run("Fünf, Tempo 60", 60, 67, 16, 60),
      boss(run("Fünffinger-Lauf", 60, 67, 20, 65)),
    ] },
    { id: "w2", title: "Die rechte Hand", sub: "Bis zum C5", colors: ["#5ee2ff", "#0ea5c9"], clef: "treble", levels: [
      single("Bis zum A", 60, 69, 12, { tip: "A4 sitzt im zweiten Zwischenraum." }),
      run("A im Lauf", 60, 69, 12, 55),
      run("A, Tempo 60", 60, 69, 16, 60),
      single("Bis zum H", 60, 71, 14, { tip: "H4 liegt auf der mittleren Linie." }),
      run("H im Lauf", 60, 71, 16, 60),
      single("Eine Oktave", 60, 72, 14, { tip: "C5 sitzt im dritten Zwischenraum." }),
      run("Oktave im Lauf", 60, 72, 16, 60),
      run("Oktave, Tempo 65", 60, 72, 20, 65),
      run("Oktave, Tempo 70", 60, 72, 24, 70),
      boss(run("Oktavlauf", 60, 72, 24, 75)),
    ] },
    { id: "w3", title: "Intervalle", sub: "Bewegung lesen statt Namen", colors: ["#2dd4ff", "#1d4ed8"], clef: "treble", levels: [
      iv("Nur Schritte", 60, 64, 8, 50, 2, { tip: "Neu: Über der Note steht, wohin es von der vorigen geht. Sekunde heißt: die Nachbarnote. Die erste Note ist dein Anker." }),
      iv("Schritte, fünf Töne", 60, 67, 10, 50, 2),
      iv("Terzen dazu", 60, 67, 12, 55, 3, { tip: "Terz: eine Note wird übersprungen. Linie zu Linie oder Zwischenraum zu Zwischenraum." }),
      iv("Terzen, bis zum A", 60, 69, 14, 55, 3),
      iv("Terzen, eine Oktave", 60, 72, 16, 55, 3),
      iv("Quarten dazu", 60, 72, 16, 60, 4, { tip: "Quarte: zwei Noten werden übersprungen." }),
      iv("Quarten, Tempo 65", 60, 72, 20, 65, 4),
      boss(iv("Bis zur Quinte", 60, 72, 20, 70, 5, { tip: "Quinte: Linie zu Linie mit einer Linie dazwischen." })),
    ] },
    { id: "w4", title: "Der Bassschlüssel", sub: "Die linke Hand liest mit", colors: ["#b79bff", "#7c3aed"], clef: "bass", levels: [
      single("Zwei tiefe Töne", 48, 50, 8, { tip: "Neu: der Bassschlüssel. C3 liegt im zweiten Zwischenraum, D3 auf der mittleren Linie. Die beiden Punkte des Schlüssels umschließen die F-Linie." }),
      single("Drei tiefe Töne", 48, 52, 12),
      run("Erster Basslauf", 48, 50, 8, 50),
      run("Drei im Basslauf", 48, 52, 12, 55),
      single("C3 bis G3", 48, 55, 14),
      run("Fünf im Bass", 48, 55, 16, 55),
      run("Fünf, Tempo 60", 48, 55, 16, 60),
      single("G2 bis G3", 43, 55, 14, { tip: "G2 liegt auf der untersten Linie des Bassschlüssels." }),
      run("Eine Oktave im Bass", 43, 55, 16, 60),
      single("F2 bis C4", 41, 60, 16, { tip: "C4 hängt hier über dem System an einer Hilfslinie." }),
      run("Weiter Bass", 41, 60, 20, 60),
      run("Weiter Bass, Tempo 65", 41, 60, 20, 65),
      iv("Bass-Intervalle", 41, 60, 16, 60, 3),
      boss(run("Basslauf", 41, 60, 24, 70)),
    ] },
    { id: "w5", title: "Über die Linien", sub: "Hilfslinien oben und unten", colors: ["#ffa25e", "#e8621c"], clef: "treble", levels: [
      single("Oben im System", 74, 79, 10, { tip: "G5 sitzt über der obersten Linie, noch ohne Hilfslinie." }),
      single("Erste Hilfslinie oben", 72, 81, 12, { tip: "Neu: A5 liegt auf der ersten Hilfslinie über dem System." }),
      run("Hoch im Lauf", 72, 81, 12, 55),
      run("Von G4 bis A5", 67, 81, 16, 60),
      single("Zweite Hilfslinie", 81, 84, 10, { tip: "C6 liegt auf der zweiten Hilfslinie über dem System." }),
      run("Bis zum C6", 72, 84, 16, 60),
      single("Unter dem System", 57, 62, 10, { tip: "Unter C4 kommt H3, dann A3 auf der zweiten Hilfslinie." }),
      run("Unten im Lauf", 55, 64, 12, 55),
      run("Unten bis C5", 55, 72, 16, 60),
      run("Unten und oben", 55, 79, 20, 60),
      single("Tiefer Bass", 36, 43, 10, { clef: "bass", tip: "E2 liegt auf der ersten Hilfslinie unter dem Bassschlüssel, C2 auf der zweiten." }),
      run("Tiefer Basslauf", 36, 48, 12, 55, { clef: "bass" }),
      single("Bass über dem System", 60, 67, 10, { clef: "bass", tip: "Im Bassschlüssel liegt E4 auf der zweiten Hilfslinie über dem System." }),
      run("Bass, weit", 41, 64, 20, 60, { clef: "bass" }),
      run("Vier Oktaven", 55, 84, 24, 65),
      boss(run("Über alle Linien", 55, 84, 24, 70)),
    ] },
    { id: "w6", title: "Rhythmus", sub: "Nur der Zeitpunkt zählt", colors: ["#ff7cc0", "#e0338a"], clef: "treble", levels: [
      rhythm("Nur Viertel", 2, [1], 50, { metronome: true, tip: "Neu: Jede Taste zählt, nur der Zeitpunkt entscheidet. Erst nur Viertel, das Metronom läuft mit." }),
      rhythm("Viertel und Halbe", 4, [1, 2], 50, { metronome: true, tip: "Eine Halbe dauert zwei Schläge: anschlagen und liegen lassen." }),
      rhythm("Viertel und Halbe, Tempo 60", 4, [1, 2], 60, { metronome: true }),
      rhythm("Ganze dazu", 6, [1, 2, 4], 60, { metronome: true, tip: "Die Ganze füllt den ganzen Takt." }),
      rhythm("Achtel, langsam", 4, [1, 0.5], 50, { metronome: true, tip: "Achtel haben ein Fähnchen und dauern einen halben Schlag: zwei pro Klick." }),
      rhythm("Achtel und Halbe", 6, [1, 2, 0.5], 60, { metronome: true }),
      rhythm("Achtel, Tempo 70", 8, [1, 2, 0.5], 70, { metronome: true }),
      rhythm("Punktiert, langsam", 4, [1, 2, 1.5], 55, { metronome: true, tip: "Der Punkt verlängert um die Hälfte: eine punktierte Viertel dauert anderthalb Schläge, danach folgt ein Achtel." }),
      rhythm("Punktiert, Tempo 65", 8, [1, 2, 0.5, 1.5], 65, { metronome: true }),
      rhythm("Pausen, langsam", 6, [1, 2], 60, { rests: true, metronome: true, tip: "Neu: Pausen. Bei einer Pause wird nichts gespielt, der Takt läuft weiter." }),
      rhythm("Pausen und Achtel", 8, [1, 2, 0.5], 70, { rests: true, metronome: true }),
      rhythm("Alles, mit Metronom", 8, [1, 2, 0.5, 1.5], 75, { rests: true, metronome: true }),
      rhythm("Ohne Metronom, langsam", 6, [1, 2], 60, { metronome: false, tip: "Neu: kein Klick mehr. Nur der Einzähler und die laufenden Noten geben das Tempo." }),
      rhythm("Ohne Metronom, Tempo 70", 8, [1, 2, 0.5], 70, { metronome: false }),
      boss(rhythm("Alles, ohne Metronom", 10, [1, 2, 4, 0.5, 1.5], 80, { rests: true, metronome: false })),
    ] },
    { id: "w7", title: "Schwarze Tasten", sub: "Kreuze und Bs", colors: ["#ffe066", "#f0b400"], clef: "treble", levels: [
      single("Ein Kreuz", 60, 62, 10, { keys: "all", tip: "Neu: Ein Kreuz vor der Note heißt: die schwarze Taste rechts daneben. Hier nur C, Cis und D." }),
      single("Zwei Kreuze", 60, 64, 12, { keys: "all" }),
      run("Kreuz im Lauf", 60, 62, 8, 50, { keys: "all" }),
      run("Zwei Kreuze im Lauf", 60, 64, 12, 55, { keys: "all" }),
      single("Fünf Finger mit Kreuzen", 60, 67, 14, { keys: "all" }),
      run("Fünf Finger mit Kreuzen", 60, 67, 16, 55, { keys: "all" }),
      single("Oktave mit Kreuzen", 60, 72, 16, { keys: "all" }),
      run("Oktave mit Kreuzen", 60, 72, 16, 60, { keys: "all" }),
      run("Oktave mit Kreuzen, Tempo 65", 60, 72, 20, 65, { keys: "all" }),
      single("Bass mit Kreuzen", 48, 52, 12, { clef: "bass", keys: "all" }),
      run("Basslauf mit Kreuzen", 48, 55, 14, 55, { clef: "bass", keys: "all" }),
      run("Bass-Oktave mit Kreuzen", 43, 55, 16, 60, { clef: "bass", keys: "all" }),
      run("Weiter Bass mit Kreuzen", 41, 60, 20, 60, { clef: "bass", keys: "all" }),
      boss(run("Alle Tasten", 60, 72, 24, 70, { keys: "all" })),
    ] },
    { id: "w8", title: "Tonleitern", sub: "Rauf und runter, mit Vorzeichnung", colors: ["#fbbf24", "#b45309"], clef: "treble", levels: [
      scale("C-Dur, langsam", 0, "dur", 1, 50, { tip: "Neu: eine Tonleiter, rauf und wieder runter, gleichmäßig im Tempo. Ohne Vorzeichen." }),
      scale("C-Dur, Tempo 60", 0, "dur", 1, 60),
      scale("C-Dur im Bass", 0, "dur", 1, 55, { clef: "bass" }),
      scale("G-Dur, langsam", 7, "dur", 1, 55, { tip: "Neu: ein Kreuz in der Vorzeichnung. Jedes F wird zum Fis, ohne dass es vor der Note steht." }),
      scale("G-Dur, Tempo 65", 7, "dur", 1, 65),
      scale("F-Dur, langsam", 5, "dur", 1, 55, { tip: "Ein B in der Vorzeichnung: jedes H wird zum B." }),
      scale("F-Dur, Tempo 65", 5, "dur", 1, 65),
      scale("D-Dur", 2, "dur", 1, 60, { tip: "Zwei Kreuze: Fis und Cis." }),
      scale("B-Dur", 10, "dur", 1, 60, { tip: "Zwei Bs: B und Es." }),
      scale("a-Moll", 9, "moll", 1, 60, { tip: "Moll ohne Vorzeichen: dieselben Tasten wie C-Dur, ab A." }),
      scale("a-Moll harmonisch", 9, "harmonisch", 1, 60, { tip: "Der siebte Ton wird erhöht: Gis statt G, mit Kreuz vor der Note." }),
      scale("C-Dur, zwei Oktaven", 0, "dur", 2, 60, { tip: "Neu: zwei Oktaven. Der Daumen muss unten durch, die Hand wandert." }),
      scale("G-Dur, zwei Oktaven", 7, "dur", 2, 65),
      boss(scale("D-Dur, zwei Oktaven", 2, "dur", 2, 75)),
    ] },
    { id: "w9", title: "Stücke", sub: "Phrasen aus echten Stücken", colors: ["#5ee8b3", "#0f766e"], clef: "treble", levels: [
      phrase("Hänschen, langsam", "starter-haenschen", "r", 3, 60, { tip: "Neu: Phrasen aus einem echten Stück, mit Notenwerten. Der Titel steht unter dem System, der Taktstrich davor." }),
      phrase("Hänschen, Tempo 70", "starter-haenschen", "r", 4, 70),
      phrase("Entchen, langsam", "starter-entchen", "r", 4, 70),
      phrase("Entchen, Tempo 80", "starter-entchen", "r", 6, 80),
      phrase("Freude, langsam", "starter-freude", "r", 4, 70),
      phrase("Freude, Tempo 80", "starter-freude", "r", 6, 80),
      piece("Hänschen, ganz", "starter-haenschen", "r", 70, { tip: "Neu: das ganze Stück von vorn bis hinten, ohne Pause zwischen den Takten." }),
      piece("Entchen, ganz", "starter-entchen", "r", 80),
      phrase("Menuett, langsam", "starter-menuett", "r", 4, 66, { tip: "Dreivierteltakt, G-Dur, Achtel: alles zusammen, deshalb langsam." }),
      phrase("Menuett, Tempo 76", "starter-menuett", "r", 6, 76),
      boss(piece("Freude, ganz", "starter-freude", "r", 84)),
    ] },
    { id: "w10", title: "Linke Hand", sub: "Stücke mit der linken Hand", colors: ["#a78bfa", "#5b21b6"], clef: "bass", levels: [
      phrase("Hänschen links, langsam", "starter-haenschen", "l", 3, 60, { tip: "Neu: die linke Hand in einem Stück. Nur halbe Noten, ganz ruhig." }),
      phrase("Hänschen links, Tempo 70", "starter-haenschen", "l", 4, 70),
      phrase("Freude links, langsam", "starter-freude", "l", 4, 60, { tip: "Neu: Akkorde. Mehrere Köpfe an einem Hals werden zusammen angeschlagen; jeder Ton zählt einzeln." }),
      phrase("Freude links, Tempo 68", "starter-freude", "l", 6, 68),
      phrase("Menuett links, langsam", "starter-menuett", "l", 4, 66),
      phrase("Menuett links, Tempo 76", "starter-menuett", "l", 6, 76),
      piece("Hänschen links, ganz", "starter-haenschen", "l", 70),
      boss(piece("Freude links, ganz", "starter-freude", "l", 80)),
    ] },
    { id: "w11", title: "Beide Hände", sub: "Das Klaviersystem", colors: ["#f9a8d4", "#be185d"], clef: "treble", levels: [
      phrase("Hänschen beide, langsam", "starter-haenschen", "both", 3, 56, { tip: "Neu: Klaviersystem. Oben die rechte, unten die linke Hand. Links liegen nur halbe Noten unter der Melodie." }),
      phrase("Hänschen beide, Tempo 64", "starter-haenschen", "both", 4, 64),
      phrase("Hänschen beide, Tempo 72", "starter-haenschen", "both", 6, 72),
      piece("Hänschen beide, ganz", "starter-haenschen", "both", 66),
      phrase("Freude beide, langsam", "starter-freude", "both", 4, 60, { tip: "Mit Akkorden in der linken Hand. Langsam anfangen." }),
      phrase("Freude beide, Tempo 70", "starter-freude", "both", 6, 70),
      piece("Freude beide, ganz", "starter-freude", "both", 72),
      phrase("Menuett beide, langsam", "starter-menuett", "both", 4, 60),
      phrase("Menuett beide, Tempo 70", "starter-menuett", "both", 6, 70),
      boss(piece("Menuett beide, ganz", "starter-menuett", "both", 76)),
    ] },
    { id: "w12", title: "Tempo", sub: "Bekanntes, nur schneller", colors: ["#86b8ff", "#2563eb"], clef: "treble", levels: [
      run("Achtzig", 60, 72, 20, 80, { tip: "Ab hier nur Bekanntes, aber schneller. In Fünferschritten." }),
      run("Fünfundachtzig", 60, 72, 20, 85),
      run("Neunzig", 60, 72, 24, 90),
      run("Weit, Tempo 85", 55, 79, 24, 85),
      run("Weit, Tempo 90", 55, 79, 24, 90),
      run("Bass, Tempo 85", 41, 60, 24, 85, { clef: "bass" }),
      run("Bass, Tempo 95", 41, 60, 24, 95, { clef: "bass" }),
      iv("Intervalle, Tempo 80", 60, 79, 20, 80, 5),
      run("Alle Tasten, Tempo 85", 60, 72, 24, 85, { keys: "all" }),
      run("Fünfundneunzig", 60, 72, 24, 95),
      run("Hundert", 60, 72, 28, 100),
      run("Weit, hundert", 55, 79, 28, 100),
      boss(run("Hundertfünf", 55, 79, 32, 105, { keys: "all" })),
    ] },
    { id: "w13", title: "Blindflug", sub: "Die Note verschwindet vor der Linie", colors: ["#c084fc", "#6d28d9"], clef: "treble", levels: [
      run("Ein Schlag voraus, fünf Töne", 60, 67, 12, 60, { lookahead: 1, tip: "Neu: Die Note wird einen Schlag vor der Linie unsichtbar. Lies voraus und behalte sie im Kopf. Kleiner Umfang, langsam." }),
      run("Ein Schlag voraus, bis A", 60, 69, 16, 60, { lookahead: 1 }),
      run("Ein Schlag voraus, Oktave", 60, 72, 16, 65, { lookahead: 1 }),
      run("Ein Schlag voraus, Tempo 70", 60, 72, 20, 70, { lookahead: 1 }),
      run("Bass voraus", 41, 60, 20, 65, { clef: "bass", lookahead: 1 }),
      iv("Intervalle voraus", 60, 72, 16, 65, 3, { lookahead: 1 }),
      run("Zwei Schläge voraus, fünf Töne", 60, 67, 12, 60, { lookahead: 2, tip: "Jetzt verschwindet die Note zwei Schläge vorher. Wieder kleiner Umfang." }),
      run("Zwei Schläge voraus, Oktave", 60, 72, 20, 70, { lookahead: 2 }),
      run("Weit voraus", 55, 79, 24, 75, { lookahead: 1 }),
      phrase("Hänschen blind", "starter-haenschen", "r", 4, 66, { lookahead: 1 }),
      phrase("Menuett blind", "starter-menuett", "r", 6, 76, { lookahead: 1 }),
      boss(run("Blindflug", 60, 72, 24, 80, { keys: "all", lookahead: 2 })),
    ] },
    { id: "w14", title: "Meister", sub: "Alles zusammen", colors: ["#ffd23f", "#d97706"], clef: "treble", levels: [
      scale("a-Moll harmonisch, zwei Oktaven", 9, "harmonisch", 2, 80),
      scale("D-Dur, zwei Oktaven, Tempo 90", 2, "dur", 2, 90),
      run("Vier Oktaven, alle Tasten", 55, 84, 28, 100, { keys: "all" }),
      run("Bass, alle Tasten", 36, 64, 28, 100, { clef: "bass", keys: "all" }),
      run("Hundertzehn", 55, 84, 32, 110, { keys: "all" }),
      piece("Menuett beide, Tempo 84", "starter-menuett", "both", 84),
      piece("Freude beide, Tempo 92", "starter-freude", "both", 92),
      run("Blind und weit", 55, 84, 32, 100, { keys: "all", lookahead: 1 }),
      boss(run("Endgegner", 55, 84, 36, 110, { keys: "all", lookahead: 1 })),
    ] },
  ];

  // Flache Liste mit Rueckverweisen und laufenden Nummern.
  const LEVELS = [];
  WORLDS.forEach((w, wi) => {
    w.n = wi + 1;
    w.levels.forEach((l, li) => {
      l.id = w.id + "-" + (li + 1); l.world = w; l.n = li + 1; l.index = LEVELS.length + 1;
      l.clef = l.clef || w.clef; l.keys = l.keys || "white";
      l.stars = l.stars || (l.boss ? BOSS_STARS : STARS);
      LEVELS.push(l);
    });
  });
  const byId = new Map(LEVELS.map(l => [l.id, l]));
  const levelById = id => byId.get(id) || null;

  const starsOf = (prog, l) => (prog && prog.levels && prog.levels[l.id] && prog.levels[l.id].stars) || 0;
  function isUnlocked(prog, l) {
    const i = LEVELS.indexOf(l);
    if (i <= 0) return true;
    return starsOf(prog, LEVELS[i - 1]) >= 2;
  }
  // Das aktuelle Level: das erste offene mit weniger als zwei Sternen, sonst das letzte.
  function current(prog) {
    for (const l of LEVELS) if (isUnlocked(prog, l) && starsOf(prog, l) < 2) return l;
    return LEVELS[LEVELS.length - 1];
  }
  const next = l => LEVELS[LEVELS.indexOf(l) + 1] || null;
  function totals(prog) {
    let stars = 0, done = 0;
    for (const l of LEVELS) { const s = starsOf(prog, l); stars += s; if (s >= 2) done++; }
    return { stars, max: LEVELS.length * 3, done, count: LEVELS.length };
  }
  function starsFor(l, res) {
    if (!res || res.accuracy == null) return 0;
    const pct = res.accuracy * 100;
    return l.stars.filter(th => pct >= th - 1e-9).length;
  }

  /* --- Beschreibung fuer die Level-Karte --------------------------------- */
  const CLEF = { treble: "Violinschlüssel", bass: "Bassschlüssel" };
  const HAND = { r: "rechte Hand", l: "linke Hand", both: "beide Hände" };
  const DUR = { 4: "Ganze", 2: "Halbe", 1: "Viertel", 0.5: "Achtel", 1.5: "punktierte Viertel" };
  function describe(l, naming, pieces) {
    const parts = [];
    const range = () => MU.name(l.low, naming) + " bis " + MU.name(l.high, naming);
    const pieceTitle = () => { const p = (pieces || []).find(q => q.id === l.pieceId); return p ? "„" + p.title + "“" : l.pieceId; };
    if (l.mode === "single") parts.push("Note steht, Taste treffen", CLEF[l.clef], range(), l.count + " Noten");
    else if (l.mode === "run") parts.push("Lauf", CLEF[l.clef], range(), l.count + " Noten", l.bpm + " Schläge/min");
    else if (l.mode === "interval") parts.push("Intervalle bis zur " + MU.intervalName(l.intervalMax - 1), CLEF[l.clef], range(), l.count + " Noten", l.bpm + " Schläge/min");
    else if (l.mode === "rhythm") parts.push("Rhythmus klopfen", l.bars + " Takte", l.set.map(d => DUR[d]).join(", ") + (l.rests ? ", Pausen" : ""), l.bpm + " Schläge/min", l.metronome ? "mit Metronom" : "ohne Metronom");
    else if (l.mode === "scale") parts.push("Tonleiter " + MU.ROOT_NAMES[l.root] + (l.type === "dur" ? "-Dur" : l.type === "moll" ? "-Moll" : "-Moll harmonisch"), l.octaves + (l.octaves > 1 ? " Oktaven" : " Oktave"), CLEF[l.clef], l.bpm + " Schläge/min");
    else if (l.mode === "phrase") parts.push("Phrasen aus " + pieceTitle(), HAND[l.hand], l.count + " Phrasen", l.bpm + " Schläge/min");
    else if (l.mode === "piece") parts.push("Ganzes Stück " + pieceTitle(), HAND[l.hand], l.bpm + " Schläge/min");
    if (l.keys === "all" && l.mode !== "scale") parts.push("mit schwarzen Tasten");
    if (l.lookahead) parts.push("Blindflug: Note verschwindet " + (l.lookahead === 1 ? "einen Schlag" : l.lookahead + " Schläge") + " vorher");
    return parts.join(" · ");
  }

  /* --- Was das Spiel fuer ein Level braucht ------------------------------ */
  function optsFor(l, pieces) {
    const o = { clef: l.clef, keys: l.keys, countIn: true, lookahead: l.lookahead || 0 };
    if (l.low != null) { o.low = l.low; o.high = l.high; }
    if (l.bpm) o.bpm = l.bpm;
    if (l.mode === "run" || l.mode === "interval") o.runLength = l.count;
    if (l.mode === "single") o.singleCount = l.count;
    if (l.metronome != null) o.metronome = l.metronome;
    if (l.intervalMax) o.intervalMax = l.intervalMax;
    if (l.mode === "rhythm") { o.rhythmBars = l.bars; o.rhythmDurations = l.set; o.rhythmRests = !!l.rests; o.labels = "off"; o.ghost = false; }
    if (l.mode === "scale") { o.scaleRoot = l.root; o.scaleType = l.type; o.scaleOctaves = l.octaves; }
    if (l.mode === "phrase") o.phrases = l.count;
    const opts = { override: o, level: l, title: l.title };
    if (l.pieceId) {
      const p = (pieces || []).find(q => q.id === l.pieceId);
      opts.pieces = p ? [p] : []; opts.piece = p || null; opts.hand = l.hand;
      // Der Umfang-Filter der Phrasen soll das Stueck nicht beschneiden.
      o.low = 21; o.high = 108;
    }
    return { mode: l.mode, opts };
  }

  return { WORLDS, LEVELS, levelById, isUnlocked, current, next, totals, starsOf, starsFor, describe, optsFor, STARS };
})();
