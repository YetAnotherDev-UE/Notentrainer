/* story.js: das Abenteuer. Zehn Welten, jede mit Levels, die vom Anfaenger
 * zum Koenner fuehren: erst zwei Toene stehend, dann Laeufe, mehr Umfang,
 * Bassschluessel, Hilfslinien, Rhythmus, schwarze Tasten, Tempo, beide
 * Haende, Blindflug, Meister. Jedes Level legt fest, was das Spiel sonst aus
 * den Einstellungen nimmt (Schluessel, Umfang, Tasten, Tempo, Anzahl).
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
    { id: "w1", title: "Erste Schritte", sub: "Violinschlüssel, fünf Töne", colors: ["#5ee8b3", "#12a874"], clef: "treble", levels: [
      single("Zwei Töne", 60, 62, 10, { tip: "C4 liegt auf der Hilfslinie unter dem System, D4 hängt direkt darunter an der ersten Linie." }),
      single("Drei Töne", 60, 64, 12, { tip: "E4 sitzt auf der untersten Linie." }),
      run("Erster Lauf", 60, 64, 12, 50, { tip: "Die Noten kommen von rechts. Triff die Taste, wenn die Note die rote Linie erreicht." }),
      run("Im Takt", 60, 64, 16, 60),
      single("Fünf Finger", 60, 67, 14, { tip: "F4 im ersten Zwischenraum, G4 auf der zweiten Linie: da schlingt sich der Schlüssel herum." }),
      run("Fünf im Lauf", 60, 67, 16, 60),
      boss(run("Fünffinger-Lauf", 60, 67, 24, 70)),
    ] },
    { id: "w2", title: "Die rechte Hand", sub: "Bis zum C5, erste Intervalle", colors: ["#5ee2ff", "#0ea5c9"], clef: "treble", levels: [
      single("Bis zum A", 60, 69, 14),
      run("A im Lauf", 60, 69, 16, 60),
      single("Eine Oktave", 60, 72, 16, { tip: "C5 sitzt im dritten Zwischenraum." }),
      run("Oktave im Lauf", 60, 72, 20, 60),
      iv("Sekunden und Terzen", 60, 72, 16, 60, 3, { tip: "Über der Note steht die Bewegung zur vorigen: Sekunde ist eine Nachbarnote, Terz überspringt eine." }),
      run("Etwas schneller", 60, 72, 24, 70),
      boss(run("Oktavlauf", 60, 72, 28, 80)),
    ] },
    { id: "w3", title: "Der Bassschlüssel", sub: "Die linke Hand liest mit", colors: ["#b79bff", "#7c3aed"], clef: "bass", levels: [
      single("Drei tiefe Töne", 48, 52, 12, { tip: "Im Bassschlüssel liegt C3 im zweiten Zwischenraum, die beiden Punkte des Schlüssels umschließen die F-Linie." }),
      single("C3 bis G3", 48, 55, 14),
      run("Bass im Lauf", 48, 55, 16, 60),
      single("F2 bis C4", 41, 60, 16, { tip: "C4 hängt hier über dem System an einer Hilfslinie." }),
      run("Weiter Bass", 41, 60, 20, 60),
      iv("Bass-Intervalle", 41, 60, 16, 60, 3),
      boss(run("Basslauf", 41, 60, 28, 75)),
    ] },
    { id: "w4", title: "Über die Linien", sub: "Hilfslinien oben und unten", colors: ["#ffa25e", "#e8621c"], clef: "treble", levels: [
      single("Hoch hinaus", 69, 79, 14, { tip: "A5 sitzt auf der ersten Hilfslinie über dem System." }),
      run("Hoher Lauf", 60, 79, 20, 60),
      single("Unter dem System", 55, 64, 14, { tip: "Unter C4 kommt H3 und dann A3 mit zwei Hilfslinien." }),
      run("Unten und oben", 55, 79, 24, 65),
      single("Tiefer Bass", 36, 60, 16, { clef: "bass", tip: "C2 hat zwei Hilfslinien unter dem Bassschlüssel." }),
      run("Basslauf, weit", 36, 64, 24, 65, { clef: "bass" }),
      boss(run("Vier Oktaven", 55, 84, 28, 75)),
    ] },
    { id: "w5", title: "Rhythmus", sub: "Nur der Zeitpunkt zählt", colors: ["#ff7cc0", "#e0338a"], clef: "treble", levels: [
      rhythm("Viertel und Halbe", 4, [1, 2], 60, { metronome: true, tip: "Jede Taste zählt, nur der Zeitpunkt entscheidet. Das Metronom läuft mit." }),
      rhythm("Ganze dazu", 6, [1, 2, 4], 70, { metronome: true }),
      rhythm("Achtel", 6, [1, 2, 0.5], 60, { metronome: true, tip: "Achtel haben ein Fähnchen und dauern einen halben Schlag." }),
      rhythm("Achtel schneller", 8, [1, 2, 0.5], 80, { metronome: true }),
      rhythm("Punktiert", 8, [1, 2, 0.5, 1.5], 70, { metronome: true, tip: "Der Punkt verlängert um die Hälfte: eine punktierte Viertel dauert anderthalb Schläge." }),
      rhythm("Mit Pausen", 8, [1, 2, 0.5], 80, { rests: true, metronome: true }),
      boss(rhythm("Ohne Metronom", 10, [1, 2, 4, 0.5, 1.5], 90, { rests: true, metronome: false })),
    ] },
    { id: "w6", title: "Schwarze Tasten", sub: "Vorzeichen und Tonarten", colors: ["#ffe066", "#f0b400"], clef: "treble", levels: [
      single("Kreuze", 60, 72, 16, { keys: "all", tip: "Ein Kreuz vor der Note: die schwarze Taste rechts daneben." }),
      run("Kreuze im Lauf", 60, 72, 20, 60, { keys: "all" }),
      single("Bass mit Vorzeichen", 41, 60, 16, { clef: "bass", keys: "all" }),
      run("Basslauf mit Vorzeichen", 41, 60, 20, 60, { clef: "bass", keys: "all" }),
      scale("G-Dur", 7, "dur", 1, 60, { tip: "Ein Kreuz in der Vorzeichnung: jedes F wird zum Fis, ohne dass es vor der Note steht." }),
      scale("F-Dur", 5, "dur", 1, 60),
      scale("D-Dur", 2, "dur", 1, 70),
      scale("a-Moll", 9, "moll", 1, 70),
      boss(run("Alle Tasten", 60, 72, 28, 80, { keys: "all" })),
    ] },
    { id: "w7", title: "Tempo", sub: "Schneller lesen, schneller treffen", colors: ["#86b8ff", "#2563eb"], clef: "treble", levels: [
      run("Neunzig", 60, 72, 24, 90),
      run("Weit und schnell", 55, 79, 24, 90),
      iv("Bis zur Quinte", 60, 79, 20, 80, 5),
      run("Bass, neunzig", 41, 60, 24, 90, { clef: "bass" }),
      run("Hundert", 60, 72, 28, 100),
      run("Bass, hundert", 41, 60, 28, 100, { clef: "bass" }),
      boss(run("Hundertzehn", 55, 79, 32, 110, { keys: "all" })),
    ] },
    { id: "w8", title: "Beide Hände", sub: "Echte Stücke, Phrase für Phrase", colors: ["#5ee8b3", "#0f766e"], clef: "treble", levels: [
      phrase("Entchen, rechts", "starter-entchen", "r", 4, 80, { tip: "Phrasen aus einem echten Stück. Der Titel steht unter dem System, der Taktstrich davor." }),
      phrase("Freude, rechts", "starter-freude", "r", 4, 80),
      phrase("Freude, links", "starter-freude", "l", 4, 80),
      phrase("Freude, beide", "starter-freude", "both", 4, 76, { tip: "Klaviersystem: oben die rechte, unten die linke Hand. Akkorde werden zusammen gewertet." }),
      piece("Freude, ganz", "starter-freude", "r", 88),
      phrase("Menuett, rechts", "starter-menuett", "r", 6, 84),
      phrase("Menuett, links", "starter-menuett", "l", 6, 84),
      phrase("Menuett, beide", "starter-menuett", "both", 6, 80),
      boss(piece("Freude, beide Hände", "starter-freude", "both", 84)),
    ] },
    { id: "w9", title: "Blindflug", sub: "Die Note verschwindet vor der Linie", colors: ["#c084fc", "#6d28d9"], clef: "treble", levels: [
      run("Ein Schlag voraus", 60, 72, 20, 70, { lookahead: 1, tip: "Die Note wird einen Schlag vor der Linie unsichtbar. Lies voraus und behalte sie im Kopf." }),
      run("Weiter voraus", 60, 79, 24, 70, { lookahead: 1 }),
      run("Bass voraus", 41, 60, 24, 70, { clef: "bass", lookahead: 1 }),
      iv("Intervalle blind", 60, 72, 20, 70, 4, { lookahead: 1 }),
      run("Zwei Schläge", 55, 79, 24, 80, { lookahead: 2 }),
      phrase("Menuett blind", "starter-menuett", "r", 6, 80, { lookahead: 1 }),
      boss(run("Blindflug", 60, 72, 28, 90, { keys: "all", lookahead: 2 })),
    ] },
    { id: "w10", title: "Meister", sub: "Alles zusammen", colors: ["#ffd23f", "#d97706"], clef: "treble", levels: [
      scale("C-Dur, zwei Oktaven", 0, "dur", 2, 90),
      scale("D-Dur, zwei Oktaven", 2, "dur", 2, 90),
      scale("a-Moll harmonisch", 9, "harmonisch", 2, 90),
      run("Vier Oktaven, alle Tasten", 55, 84, 32, 110, { keys: "all" }),
      run("Bass, alle Tasten", 36, 64, 32, 110, { clef: "bass", keys: "all" }),
      piece("Menuett, beide Hände", "starter-menuett", "both", 92),
      boss(run("Endgegner", 55, 84, 40, 120, { keys: "all", lookahead: 1 })),
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
