/* music.js: Tonhöhen, Namen, Tonarten, Tonleitern.
 * Keine DOM- und keine Canvas-Abhängigkeit; alles hier ist reine Rechnung.
 * Konvention: MIDI 60 = C4 (wissenschaftliche Schreibweise). Yamaha nennt
 * dieselbe Taste C3, das ist nur Beschriftung, siehe CLAUDE.md. */
"use strict";
window.NT = window.NT || {};

NT.music = (() => {
  const LETTERS_DE  = ["C", "D", "E", "F", "G", "A", "H"];
  const LETTERS_INT = ["C", "D", "E", "F", "G", "A", "B"];
  const PC_OF_LETTER = [0, 2, 4, 5, 7, 9, 11];        // Buchstabe -> Halbton
  const WHITE_PC = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };
  const isBlack = midi => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);

  // Schreibweise einer MIDI-Nummer. Schwarze Tasten als Kreuz, oder als b,
  // wenn die Tonart das nahelegt (preferFlat).
  function spell(midi, preferFlat) {
    const pc = ((midi % 12) + 12) % 12;
    if (!isBlack(pc)) {
      const letter = WHITE_PC[pc], octave = Math.floor(midi / 12) - 1;
      return { letter, octave, alter: 0, diatonic: octave * 7 + letter };
    }
    const base = preferFlat ? midi + 1 : midi - 1;
    const letter = WHITE_PC[((base % 12) + 12) % 12], octave = Math.floor(base / 12) - 1;
    return { letter, octave, alter: preferFlat ? -1 : 1, diatonic: octave * 7 + letter };
  }

  const midiOf = (letter, alter, octave) => (octave + 1) * 12 + PC_OF_LETTER[letter] + alter;
  const diatonicOf = (letter, octave) => octave * 7 + letter;

  // Name mit Oktave, z. B. "Cis4"? Nein: Symbole, damit es kurz bleibt: "C♯4".
  // Deutsch: H statt B, und das erniedrigte H heißt B.
  function name(midi, naming, preferFlat) {
    const s = spell(midi, preferFlat);
    const L = naming === "de" ? LETTERS_DE : LETTERS_INT;
    let n = L[s.letter];
    if (naming === "de" && s.letter === 6 && s.alter === -1) n = "B";
    else n += s.alter === 1 ? "♯" : s.alter === -1 ? "♭" : "";
    return n + s.octave;
  }
  // Nur der Buchstabe mit Vorzeichen, ohne Oktave, für die Beschriftung über der Note.
  function shortName(midi, naming, preferFlat) {
    const full = name(midi, naming, preferFlat);
    return full.replace(/-?\d+$/, "");
  }

  /* --- Tonarten ------------------------------------------------------ *
   * Quintenzirkel als Zahl (fifths): 0 = C-Dur, +1 = G-Dur, -1 = F-Dur.
   * Die Positionen der Vorzeichen im System sind Halbschritte ab der
   * untersten Linie (Violinschlüssel: E4 = 0, Bassschlüssel: G2 = 0).
   * ------------------------------------------------------------------ */
  const SHARP_STEPS = { treble: [8, 5, 9, 6, 3, 7, 4], bass: [6, 3, 7, 4, 1, 5, 2] };
  const FLAT_STEPS  = { treble: [4, 7, 3, 6, 2, 5, 1], bass: [2, 5, 1, 4, 0, 3, 6] };
  const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6];   // F C G D A E H als Buchstaben-Index
  const FLAT_ORDER  = [6, 2, 5, 1, 4, 0, 3];   // H E A D G C F

  function keySignature(fifths, clef) {
    const n = Math.min(7, Math.abs(fifths));
    const steps = (fifths >= 0 ? SHARP_STEPS : FLAT_STEPS)[clef].slice(0, n);
    return steps.map(step => ({ step, kind: fifths >= 0 ? "sharp" : "flat" }));
  }
  // Was die Tonart mit einem Buchstaben macht: +1, -1 oder 0.
  function keyAlterOf(letter, fifths) {
    if (fifths > 0) return SHARP_ORDER.slice(0, fifths).includes(letter) ? 1 : 0;
    if (fifths < 0) return FLAT_ORDER.slice(0, -fifths).includes(letter) ? -1 : 0;
    return 0;
  }
  const MAJOR_FIFTHS = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 5: -1, 10: -2, 3: -3, 8: -4, 1: -5 };
  function fifthsOf(rootPc, type) {
    const majorPc = type === "dur" ? rootPc : (rootPc + 3) % 12;
    return MAJOR_FIFTHS[majorPc] ?? 0;
  }
  const keyName = (fifths, naming) => {
    const de  = ["Ces", "Ges", "Des", "As", "Es", "B", "F", "C", "G", "D", "A", "E", "H", "Fis", "Cis"];
    const int = ["C♭", "G♭", "D♭", "A♭", "E♭", "B♭", "F", "C", "G", "D", "A", "E", "B", "F♯", "C♯"];
    return (naming === "de" ? de : int)[fifths + 7] + "-Dur";
  };
  // Parallele Molltonart zur selben Vorzeichnung, fuers Tonart-Quiz.
  const minorName = (fifths, naming) => {
    const de  = ["as", "es", "b", "f", "c", "g", "d", "a", "e", "h", "fis", "cis", "gis", "dis", "ais"];
    const int = ["a♭", "e♭", "b♭", "f", "c", "g", "d", "a", "e", "b", "f♯", "c♯", "g♯", "d♯", "a♯"];
    return (naming === "de" ? de : int)[fifths + 7] + "-Moll";
  };

  /* --- Intervalle: nach Buchstabenabstand, nicht nach Halbtoenen -------- *
   * 0 = Prime, 1 = Sekunde ... 7 = Oktave. Fuer das Lesen zaehlt der
   * Abstand im System; ob die Terz gross oder klein ist, kommt spaeter.
   * ------------------------------------------------------------------ */
  const INTERVAL_NAMES = ["Prime", "Sekunde", "Terz", "Quarte", "Quinte", "Sexte", "Septime", "Oktave"];
  const intervalName = steps => INTERVAL_NAMES[Math.min(7, Math.abs(steps))];

  /* --- Schreibweise nach Buchstabe ------------------------------------- *
   * Akkorde und Tonleitern werden nach Buchstaben geschrieben (Terzen bzw.
   * Stufen), nicht nach Tasten: c-Moll ist C Es G, nicht C Dis G. Aus
   * Buchstabe und Tonhöhe folgt das Vorzeichen. Selten ergibt das ein
   * doppeltes Vorzeichen (Fisis in H übermäßig, Heses in C°7).
   * ------------------------------------------------------------------ */
  const ACCIDENTAL = { "0": "natural", "1": "sharp", "-1": "flat", "2": "dsharp", "-2": "dflat" };
  function spelled(letter, midi) {
    let octave = Math.floor(midi / 12) - 1;
    let alter = midi - midiOf(letter, 0, octave);
    if (alter > 6) { octave++; alter -= 12; }
    if (alter < -6) { octave--; alter += 12; }
    const accidental = alter === 1 ? "sharp" : alter === -1 ? "flat" : alter === 2 ? "dsharp" : alter === -2 ? "dflat" : null;
    return { midi, letter, alter, octave, diatonic: octave * 7 + letter, accidental };
  }
  // Name aus Buchstabe und Vorzeichen: Fis, Es, As, B, Fisis; international F♯, E♭.
  function nameOf(letter, alter, naming, octave) {
    let n;
    if (naming === "de") {
      const base = LETTERS_DE[letter];
      if (alter === 0) n = base;
      else if (alter > 0) n = base + "is".repeat(alter);
      else if (letter === 6) n = alter === -1 ? "B" : "Heses";
      else if (letter === 2) n = alter === -1 ? "Es" : "Eses";
      else if (letter === 5) n = alter === -1 ? "As" : "Asas";
      else n = base + "es".repeat(-alter);
    } else n = LETTERS_INT[letter] + (alter > 0 ? "♯".repeat(alter) : "♭".repeat(-alter));
    return octave == null ? n : n + octave;
  }

  /* --- Akkorde ---------------------------------------------------------- *
   * steps: Halbtöne ab dem Grundton; letters: Buchstabenabstand je Ton
   * (Terzschichtung 0 2 4 6, bei sus und Sexte entsprechend anders).
   * Die Schreibweise des Grundtons hängt von der Art ab, so gewählt, dass
   * möglichst keine doppelten Vorzeichen entstehen: Des-Dur, aber cis-Moll
   * und Cis vermindert.
   * ------------------------------------------------------------------ */
  const ROOTS = {   // [Buchstabe, Vorzeichen] je Halbton ab C
    dur:  [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [3, 1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]],
    moll: [[0, 0], [0, 1], [1, 0], [2, -1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [6, -1], [6, 0]],
    dim:  [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0]],
    aug:  [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [4, -1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]],
  };
  const CHORDS = {
    dur:  { name: "Dur", suffix: "", steps: [0, 4, 7], letters: [0, 2, 4], roots: "dur" },
    moll: { name: "Moll", suffix: "m", steps: [0, 3, 7], letters: [0, 2, 4], roots: "moll" },
    dim:  { name: "vermindert", suffix: "°", steps: [0, 3, 6], letters: [0, 2, 4], roots: "dim" },
    aug:  { name: "übermäßig", suffix: "+", steps: [0, 4, 8], letters: [0, 2, 4], roots: "aug" },
    sus2: { name: "sus2, Sekunde statt Terz", suffix: "sus2", steps: [0, 2, 7], letters: [0, 1, 4], roots: "dur" },
    sus4: { name: "sus4, Quarte statt Terz", suffix: "sus4", steps: [0, 5, 7], letters: [0, 3, 4], roots: "dur" },
    dom7: { name: "Dominantseptakkord", suffix: "7", steps: [0, 4, 7, 10], letters: [0, 2, 4, 6], roots: "dur" },
    maj7: { name: "großer Septakkord", suffix: "maj7", steps: [0, 4, 7, 11], letters: [0, 2, 4, 6], roots: "dur" },
    m7:   { name: "Moll-Septakkord", suffix: "m7", steps: [0, 3, 7, 10], letters: [0, 2, 4, 6], roots: "moll" },
    six:  { name: "Dur mit Sexte", suffix: "6", steps: [0, 4, 7, 9], letters: [0, 2, 4, 5], roots: "dur" },
    m6:   { name: "Moll mit Sexte", suffix: "m6", steps: [0, 3, 7, 9], letters: [0, 2, 4, 5], roots: "moll" },
    dim7: { name: "verminderter Septakkord", suffix: "°7", steps: [0, 3, 6, 9], letters: [0, 2, 4, 6], roots: "dim" },
    m7b5: { name: "halbverminderter Septakkord", suffix: "m7♭5", steps: [0, 3, 6, 10], letters: [0, 2, 4, 6], roots: "dim" },
  };
  const INVERSIONS = ["Grundstellung", "1. Umkehrung", "2. Umkehrung", "3. Umkehrung"];
  /* Fingersatz für einen Griff, aus den Abständen der Töne (recherchiert,
   * Standard der Klavierschulen): Dreiklang rechts 1 3 5, links 5 3 1. Liegt
   * oben eine Quarte (erste Umkehrung, sus2), nimmt die rechte Hand 1 2 5;
   * liegt sie unten (zweite Umkehrung, sus4), nimmt die linke 5 2 1. Ein
   * Sekundabstand am Rand verlangt den vierten Finger. Vierklang rechts
   * 1 2 3 5, links 5 3 2 1, auch in den Umkehrungen; nur wenn die Sekunde
   * oben liegt (erste Umkehrung des Septakkords), nimmt die rechte Hand
   * 1 2 4 5, und wenn sie unten liegt (dritte Umkehrung), die linke 5 4 2 1. */
  function chordFingers(midis, hand) {
    const g = midis.slice(1).map((m, i) => m - midis[i]);
    if (midis.length === 3) {
      if (hand === "l") return g[0] <= 2 ? [5, 4, 1] : g[0] >= 5 ? [5, 2, 1] : [5, 3, 1];
      return g[1] <= 2 ? [1, 4, 5] : g[1] >= 5 ? [1, 2, 5] : [1, 3, 5];
    }
    if (midis.length === 4) {
      if (hand === "l") return g[0] <= 2 ? [5, 4, 2, 1] : [5, 3, 2, 1];
      return g[2] <= 2 ? [1, 2, 4, 5] : [1, 2, 3, 5];
    }
    return midis.map((m, i) => hand === "l" ? midis.length - i : i + 1);
  }
  // spell (optional): [Buchstabe, Vorzeichen] des Grundtons, wenn die Tonart ihn vorgibt (Kadenz); sonst gilt die Tabelle.
  function chord(rootPc, type, inv, hand, spell) {
    const c = CHORDS[type] || CHORDS.dur, [rl, ra] = spell || ROOTS[c.roots][rootPc];
    // Rechts um das mittlere C, links eine Oktave tiefer; hohe Grundtöne links noch eine tiefer, damit sie im System bleiben.
    const base = hand === "l" ? (rootPc >= 7 ? 36 : 48) + rootPc : 60 + rootPc;
    let tones = c.steps.map((s, i) => spelled((rl + c.letters[i]) % 7, base + s));
    // Ein Akkord hat so viele Umkehrungen wie Töne, weniger eine; was es nicht gibt, wird zur Grundstellung.
    const k = inv > 0 && inv < c.steps.length ? Math.floor(inv) : 0;
    for (let i = 0; i < k; i++) { const t = tones.shift(); tones.push(spelled(t.letter, t.midi + 12)); }
    // Zu hoch geratene Umkehrungen rücken eine Oktave tiefer: links bis zum E über dem mittleren C, rechts bis zum dreigestrichenen C.
    if (tones[tones.length - 1].midi > (hand === "l" ? 64 : 84)) tones = tones.map(t => spelled(t.letter, t.midi - 12));
    return finishChord({ type, rootPc, inv: k, hand, tones, rootLetter: rl, rootAlter: ra, pcs: c.steps.map(s => (rootPc + s) % 12) });
  }
  function finishChord(ch) {
    const f = chordFingers(ch.tones.map(t => t.midi), ch.hand);
    ch.tones.forEach((t, i) => { t.finger = f[i]; });
    ch.bassPc = ((ch.tones[0].midi % 12) + 12) % 12;
    return ch;
  }
  // Denselben Griff um Oktaven verschieben, bis der tiefste Ton nahe bei `near` liegt (für Kadenzen).
  function chordNear(ch, near) {
    let shift = 0; const low = ch.tones[0].midi;
    while (low + shift - near > 6) shift -= 12;
    while (near - (low + shift) > 6) shift += 12;
    if (shift) ch.tones = ch.tones.map(t => Object.assign(spelled(t.letter, t.midi + shift)));
    return finishChord(ch);
  }
  /* Kadenz: die drei Hauptakkorde einer Tonart, I IV V I, so gelegt, dass die
   * Hand fast liegen bleibt: I in Grundstellung, IV in der zweiten
   * Umkehrung (der Grundton der Tonart bleibt unten), V in der ersten
   * Umkehrung. In Moll ist die V trotzdem ein Dur-Akkord (Leitton).
   * IV und V heißen nach der Tonart: ihr Grundton liegt drei bzw. vier
   * Buchstaben über dem der Tonart, in Fis-Dur also H und Cis, nicht Des. */
  function cadence(rootPc, type, hand) {
    const minor = type !== "dur", t = minor ? "moll" : "dur";
    const I = chord(rootPc, t, 0, hand), near = I.tones[0].midi;
    const rootOf = (letters, pc) => { const l = (I.rootLetter + letters) % 7; return [l, spelled(l, 60 + pc).alter]; };
    const IV = chordNear(chord((rootPc + 5) % 12, t, 2, hand, rootOf(3, (rootPc + 5) % 12)), near);
    const V = chordNear(chord((rootPc + 7) % 12, "dur", 1, hand, rootOf(4, (rootPc + 7) % 12)), near);
    const I2 = chord(rootPc, t, 0, hand);
    [I, IV, V, I2].forEach((c, i) => { c.degree = ["I", "IV", "V", "I"][i]; });
    return [I, IV, V, I2];
  }
  // Namen: spell (optional) wie bei chord, für Akkorde, deren Grundton die Tonart vorgibt.
  const chordRoot = (rootPc, type, naming, spell) => { const c = CHORDS[type] || CHORDS.dur, [l, a] = spell || ROOTS[c.roots][rootPc]; return nameOf(l, a, naming); };
  const chordSymbol = (rootPc, type, naming, spell) => chordRoot(rootPc, type, naming, spell) + (CHORDS[type] || CHORDS.dur).suffix;
  function chordTitle(rootPc, type, naming, spell) {
    const r = chordRoot(rootPc, type, naming, spell);
    if (type === "dur") return r + "-Dur";
    if (type === "moll") return (naming === "de" ? r.charAt(0).toLowerCase() + r.slice(1) : r) + "-Moll";
    if (type === "dim") return r + " vermindert";
    if (type === "aug") return r + " übermäßig";
    return r + CHORDS[type].suffix + " (" + CHORDS[type].name + ")";
  }

  /* --- Tonleitern ---------------------------------------------------- */
  const SCALES = {
    dur:        [2, 2, 1, 2, 2, 2, 1],
    moll:       [2, 1, 2, 2, 1, 2, 2],
    harmonisch: [2, 1, 2, 2, 1, 3, 1],
  };
  // Alles, was wie eine Tonleiter läuft: eine Folge von Tönen mit Fingersatz.
  const FORMS = {
    dur: "Dur-Tonleiter", moll: "Moll-Tonleiter (natürlich)", harmonisch: "Moll-Tonleiter (harmonisch)",
    fuenfDur: "Fünffingerlage Dur", fuenfMoll: "Fünffingerlage Moll", chrom: "Chromatische Tonleiter",
    arpDur: "Gebrochener Dur-Akkord", arpMoll: "Gebrochener Moll-Akkord",
    pentaDur: "Pentatonik Dur", pentaMoll: "Pentatonik Moll", blues: "Blues-Tonleiter",
  };
  const isMinorForm = type => type === "moll" || type === "harmonisch" || type === "fuenfMoll" || type === "arpMoll" || type === "pentaMoll" || type === "blues";
  /* Tonleitern mit Lücken: Halbtöne und Buchstabenabstand ab dem Grundton.
   * Pentatonik Dur ist die Dur-Tonleiter ohne vierte und siebte Stufe,
   * Pentatonik Moll die Moll-Tonleiter ohne zweite und sechste. Die
   * Blues-Tonleiter ist die Moll-Pentatonik mit einem eingeschobenen Ton
   * zwischen vierter und fünfter Stufe (Blue Note, Index 3). */
  const GAPPED = {
    pentaDur:  { steps: [0, 2, 4, 7, 9], letters: [0, 1, 2, 4, 5] },
    pentaMoll: { steps: [0, 3, 5, 7, 10], letters: [0, 2, 3, 4, 6] },
    blues:     { steps: [0, 3, 5, 6, 7, 10], letters: [0, 2, 3, 3, 4, 6], blue: 3 },
  };
  // Auf und wieder ab, ohne den Umkehrton doppelt.
  function scale(root, type, octaves) {
    const steps = SCALES[type] || SCALES.dur;
    const up = [root]; let m = root;
    for (let o = 0; o < octaves; o++) for (const s of steps) { m += s; up.push(m); }
    return up.concat(up.slice(0, -1).reverse());
  }
  const ROOT_NAMES = { 0: "C", 1: "Des", 2: "D", 3: "Es", 4: "E", 5: "F", 6: "Fis", 7: "G", 8: "As", 9: "A", 10: "B", 11: "H" };

  /* Fingersatz der Tonleitern. Alle zwölf Tonarten folgen einer Regel: Die
   * Hand greift abwechselnd drei und vier Töne, der Daumen spielt nie eine
   * schwarze Taste, und der vierte Finger kommt je Oktave genau einmal dran.
   * Es genügt also zu wissen, auf welcher Stufe der vierte Finger liegt
   * (0 = Grundton). Abgeglichen mit den üblichen Tabellen (C-Dur rechts
   * 1 2 3 1 2 3 4 5, F-Dur 1 2 3 4 1 2 3 4, B-Dur 2 1 2 3 1 2 3 4,
   * H-Dur links 4 3 2 1 4 3 2 1, b-Moll links 2 1 3 2 1 4 3 2). */
  const RH4 = { dur: [6, 5, 6, 4, 6, 3, 2, 6, 1, 6, 0, 6], moll: [6, 1, 6, 4, 6, 3, 1, 6, 1, 6, 0, 6] };
  const LH4 = { dur: [1, 3, 1, 3, 1, 1, 0, 1, 3, 1, 3, 4], moll: [1, 3, 1, 2, 1, 1, 0, 1, 3, 1, 5, 4] };
  function scaleFingers(rootPc, type, octaves, hand) {
    const t = type === "dur" ? "dur" : "moll", n = 7 * octaves + 1, up = [];
    if (hand === "l") {
      const d4 = LH4[t][rootPc], P = [4, 3, 2, 1, 3, 2, 1];
      for (let i = 0; i < n; i++) up.push(P[((i % 7) - d4 + 7) % 7]);
      if (up[0] === 1) up[0] = up[1] + 1;               // unten beginnt die Hand mit dem äußeren Finger
    } else {
      const d4 = RH4[t][rootPc], P = [4, 1, 2, 3, 1, 2, 3];
      for (let i = 0; i < n; i++) up.push(P[((i % 7) - d4 + 7) % 7]);
      if (up[0] === 4) up[0] = 2;                        // auf der schwarzen Taste beginnt man bequemer mit 2
      if (up[n - 1] === 1) up[n - 1] = up[n - 2] + 1;    // oben endet die Hand mit dem äußeren Finger
    }
    return up;
  }
  /* Gebrochene Akkorde (Arpeggien): Finger für Grundton, Terz, Quinte, dazu
   * der Finger am Anfang. Tabelle nach den üblichen Fingersatz-Tafeln: weiße
   * Grundtöne rechts 1 2 3, links 5 4 2 (liegt die Terz auf einer schwarzen
   * Taste, links 5 3 2); schwarze Grundtöne beginnen mit dem zweiten Finger,
   * der Daumen nimmt die erste weiße Taste. */
  const ARP = {
    r: { a: { first: 1, root: 1, third: 2, fifth: 3 }, b: { first: 2, root: 4, third: 1, fifth: 2 }, c: { first: 2, root: 2, third: 3, fifth: 1 } },
    l: { a: { first: 5, root: 1, third: 4, fifth: 2 }, b: { first: 5, root: 1, third: 3, fifth: 2 }, c: { first: 2, root: 2, third: 1, fifth: 4 }, d: { first: 3, root: 3, third: 2, fifth: 1 } },
  };
  const ARP_KEY = { r: {}, l: {} };
  // je Grundton (C, Des, D, Es, E, F, Fis, G, As, A, B, H)
  ARP_KEY.r.dur  = ["a", "b", "a", "b", "a", "a", "a", "a", "b", "a", "b", "a"];
  ARP_KEY.r.moll = ["a", "b", "a", "a", "a", "a", "b", "a", "b", "a", "c", "a"];
  ARP_KEY.l.dur  = ["a", "c", "b", "c", "b", "a", "b", "a", "c", "b", "d", "b"];
  ARP_KEY.l.moll = ["a", "c", "a", "a", "a", "a", "c", "a", "c", "a", "d", "a"];
  function arpFingers(rootPc, minor, octaves, hand) {
    const p = ARP[hand === "l" ? "l" : "r"][ARP_KEY[hand === "l" ? "l" : "r"][minor ? "moll" : "dur"][rootPc]];
    const n = 3 * octaves + 1, up = [];
    for (let i = 0; i < n; i++) up.push(i % 3 === 0 ? p.root : i % 3 === 1 ? p.third : p.fifth);
    up[0] = p.first;
    if (hand !== "l" && p.root === 1) up[n - 1] = 5;     // oben endet die rechte Hand mit dem kleinen Finger
    return up;
  }
  // Chromatisch: Daumen auf den weißen, dritter Finger auf den schwarzen Tasten, der zweite dort, wo zwei weiße nebeneinander liegen.
  function chromFingers(midis, hand) {
    return midis.map((m, i) => {
      const pc = ((m % 12) + 12) % 12;
      if (isBlack(m)) return 3;
      if (hand === "l") return pc === 4 || pc === 11 ? 2 : 1;
      return (pc === 5 || pc === 0) && i > 0 ? 2 : 1;
    });
  }
  /* Fingersatz für Pentatonik und Blues-Tonleiter. Anders als bei Dur und
   * Moll gibt es hier keine einheitliche Überlieferung, die Tabellen
   * weichen voneinander ab (verglichen: pianoscales.org für die Pentatonik,
   * freejazzlessons.com und Piano With Jonny für die Blues-Tonleiter).
   * Deshalb gilt eine feste Regel, die mit den Tabellen in den meisten
   * Tonarten übereinstimmt:
   *  1. Die Hand greift abwechselnd drei und zwei Töne (Pentatonik) oder vier
   *     und zwei bzw. drei und drei (Blues), jede Gruppe beginnt rechts mit
   *     dem Daumen und endet links auf ihm.
   *  2. Der Daumen spielt weiße Tasten. Auf eine schwarze kommt er nur, wenn
   *     es nicht anders geht, und dann in einer Gruppe aus lauter schwarzen.
   *  3. Ist der Grundton weiß, liegt der Daumen auf dem Grundton (rechts
   *     1 2 3 · 1 2, links gespiegelt 3 2 1 · 3 2 1; Blues 1 2 3 4 · 1 2).
   *  4. Sonst zählt, dass möglichst oft an einer schwarzen Taste unter-
   *     oder übergesetzt wird.
   * Gespeichert ist je Grundton (C, Des, D ... H) der Finger für jede Stufe
   * der Tonleiter; Anfang und Ende werden wie bei den Tonleitern angepasst. */
  const GAPPED_FINGERS = {
    pentaDur:  { r: ["12312", "12123", "12312", "21231", "12312", "12312", "12312", "12312", "23121", "12312", "21231", "12312"],
                 l: ["12132", "12132", "13212", "32121", "13212", "12132", "12132", "12132", "32121", "13212", "21321", "12132"] },
    pentaMoll: { r: ["12312", "21231", "12312", "12312", "12312", "12312", "21231", "12312", "21231", "12312", "12312", "12123"],
                 l: ["12132", "21321", "12132", "12132", "12132", "13212", "32121", "12132", "21321", "12132", "13212", "12132"] },
    blues:     { r: ["123412", "212341", "123412", "123123", "123412", "123123", "212341", "123412", "412123", "123412", "123123", "123123"],
                 l: ["121432", "214321", "121432", "132132", "121432", "132132", "432121", "121432", "212143", "121432", "213213", "132132"] },
  };
  function gappedFingers(rootPc, type, octaves, hand, midis) {
    const pat = GAPPED_FINGERS[type][hand === "l" ? "l" : "r"][rootPc], n = pat.length, e = n * octaves, up = [];
    for (let i = 0; i <= e; i++) up.push(+pat[i % n]);
    const mixed = !midis.every(isBlack);   // in einer Tonleiter aus lauter schwarzen Tasten darf der Daumen auf Schwarz bleiben
    if (hand === "l") {
      if (up[0] === 1) up[0] = up[1] + 1;                 // unten beginnt die Hand mit dem äußeren Finger
      if (up[e] === 1 && isBlack(midis[e]) && mixed) {    // oben kein Daumen auf der schwarzen Taste: die letzte Gruppe rückt einen Finger weiter
        let k = e; while (k > 0 && up[k - 1] !== 1) k--;
        if (e - k <= 2) for (let i = k; i <= e; i++) up[i]++;
      }
      if (up[e] === 4 && up[e - 1] === 1) up[e] = 2;
    } else {
      if (up[0] === 1 && isBlack(midis[0]) && mixed) {    // unten kein Daumen auf der schwarzen Taste
        let k = 0; while (k < e && up[k + 1] !== 1) k++;
        if (k <= 2) for (let i = 0; i <= k; i++) up[i]++;
      }
      if (up[0] === 4 && up[1] === 1) up[0] = 2;
      if (up[e] === 1) up[e] = up[e - 1] + 1;             // oben endet die Hand mit dem äußeren Finger
    }
    return up;
  }
  // Vorzeichnung und Schreibweise des Grundtons. es-Moll bekommt sechs B statt sechs Kreuze.
  function scaleKey(rootPc, type) {
    if (type === "chrom") return { fifths: 0, letter: ROOTS.dur[rootPc][0], alter: ROOTS.dur[rootPc][1], minor: false };
    const minor = isMinorForm(type);
    const fifths = minor ? (rootPc === 3 ? -6 : fifthsOf(rootPc, "moll")) : fifthsOf(rootPc, "dur");
    const [letter, alter] = (minor ? ROOTS.moll : ROOTS.dur)[rootPc];
    return { fifths, letter, alter, minor };
  }
  function scaleTitle(rootPc, type, naming) {
    const k = scaleKey(rootPc, type), r = nameOf(k.letter, k.alter, naming);
    const low = naming === "de" ? r.charAt(0).toLowerCase() + r.slice(1) : r;
    if (type === "chrom") return "Chromatisch ab " + r;
    if (type === "fuenfDur") return "Fünffingerlage " + r + "-Dur";
    if (type === "fuenfMoll") return "Fünffingerlage " + low + "-Moll";
    if (type === "arpDur") return r + "-Dur gebrochen";
    if (type === "arpMoll") return low + "-Moll gebrochen";
    if (type === "pentaDur") return "Pentatonik " + r + "-Dur";
    if (type === "pentaMoll") return "Pentatonik " + low + "-Moll";
    if (type === "blues") return "Blues-Tonleiter in " + r;
    return type === "dur" ? r + "-Dur" : low + (type === "moll" ? "-Moll" : "-Moll harmonisch");
  }
  // Tonfolge richtig geschrieben: Vorzeichen nur, wo sie von der Vorzeichnung abweichen, dazu der Fingersatz.
  function scaleNotes(rootPc, type, octaves, hand, base) {
    if (!FORMS[type]) type = "dur";
    const key = scaleKey(rootPc, type);
    if (type === "fuenfDur" || type === "fuenfMoll") octaves = 1;
    if (base == null) base = hand === "l" ? ((octaves > 1 || rootPc >= 7) ? 36 : 48) + rootPc : (rootPc >= 7 ? 48 : 60) + rootPc;
    let up = [], down = null, fingers;
    const fix = n => { const ka = keyAlterOf(n.letter, key.fifths); n.accidental = n.alter === ka ? null : n.alter === 0 ? "natural" : n.accidental; return n; };
    if (type === "chrom") {
      const midis = []; for (let i = 0; i <= 12 * octaves; i++) midis.push(base + i);
      const f = chromFingers(midis, hand);
      const upN = midis.map(m => { const s = spell(m, false); return spelled(s.letter, m); });
      const downN = midis.slice(0, -1).reverse().map(m => { const s = spell(m, true); return spelled(s.letter, m); });
      const notes = upN.concat(downN);
      const ff = f.concat(f.slice(0, -1).reverse());
      notes.forEach((n, i) => { n.finger = ff[i]; n.dur = 1; });
      return { key, notes, up: upN.length, hand, type };
    }
    if (type === "arpDur" || type === "arpMoll") {
      const minor = type === "arpMoll", st = minor ? [0, 3, 7] : [0, 4, 7];
      for (let i = 0; i <= 3 * octaves; i++) up.push(fix(spelled((key.letter + 2 * (i % 3)) % 7, base + 12 * Math.floor(i / 3) + st[i % 3])));
      fingers = arpFingers(rootPc, minor, octaves, hand);
    } else if (type === "fuenfDur" || type === "fuenfMoll") {
      const st = type === "fuenfDur" ? [0, 2, 4, 5, 7] : [0, 2, 3, 5, 7];
      up = st.map((s, i) => fix(spelled((key.letter + i) % 7, base + s)));
      fingers = hand === "l" ? [5, 4, 3, 2, 1] : [1, 2, 3, 4, 5];
    } else if (GAPPED[type]) {
      const g = GAPPED[type], n = g.steps.length;
      /* Die Blue Note schreibt man aufwärts als erhöhte Quarte (F, Fis, G) und
       * abwärts als erniedrigte Quinte (G, Ges, F), so braucht es kein
       * Auflösungszeichen. Ergäbe das ein doppeltes Vorzeichen oder einen Ton
       * wie Eis oder Ces, gilt die andere Schreibweise in beiden Richtungen. */
      const plain = s => Math.abs(s.alter) <= 1 && !((s.letter === 2 || s.letter === 6) && s.alter === 1) && !((s.letter === 3 || s.letter === 0) && s.alter === -1);
      const tone = (i, dir) => {
        const k = i % n, m = base + 12 * Math.floor(i / n) + g.steps[k], letter = (key.letter + g.letters[k]) % 7;
        if (k !== g.blue) return fix(spelled(letter, m));
        const sharp = spelled(letter, m), flat = spelled((letter + 1) % 7, m);
        return fix(dir > 0 ? (plain(sharp) || !plain(flat) ? sharp : flat) : (plain(flat) || !plain(sharp) ? flat : sharp));
      };
      for (let i = 0; i <= n * octaves; i++) up.push(tone(i, 1));
      down = []; for (let i = n * octaves - 1; i >= 0; i--) down.push(tone(i, -1));
      fingers = gappedFingers(rootPc, type, octaves, hand, up.map(x => x.midi));
    } else {
      const steps = SCALES[type]; let m = base;
      for (let i = 0; i <= 7 * octaves; i++) { up.push(fix(spelled((key.letter + i) % 7, m))); m += steps[i % 7]; }
      fingers = scaleFingers(rootPc, type, octaves, hand);
    }
    const notes = up.concat(down || up.slice(0, -1).reverse().map(n => Object.assign({}, n)));
    // Steht derselbe Platz im System zweimal hintereinander in verschiedener Höhe (H, dann B), bekommt der zweite Ton sein Vorzeichen ausdrücklich.
    for (let i = 1; i < notes.length; i++) if (notes[i].diatonic === notes[i - 1].diatonic && notes[i].alter !== notes[i - 1].alter) notes[i].accidental = ACCIDENTAL[notes[i].alter];
    const ff = fingers.concat(fingers.slice(0, -1).reverse());
    notes.forEach((n, i) => { n.finger = ff[i]; n.dur = 1; });
    return { key, notes, up: up.length, hand, type };
  }

  /* --- Notenwerte ---------------------------------------------------- *
   * Dauer in Viertelschlägen -> Kopfform, Fähnchen, Punkte.
   * ------------------------------------------------------------------ */
  function durationParts(beats) {
    const bases = [[4, "whole", 0], [2, "half", 0], [1, "black", 0], [0.5, "black", 1], [0.25, "black", 2]];
    for (const [b, kind, flags] of bases) {
      if (Math.abs(beats - b) < 0.01) return { kind, flags, dots: 0, base: b };
      if (Math.abs(beats - b * 1.5) < 0.01) return { kind, flags, dots: 1, base: b };
    }
    // Nichts Passendes (Triolen, Bindungen): nächstliegende Basis ohne Punkt.
    let best = bases[2];
    for (const b of bases) if (Math.abs(beats - b[0]) < Math.abs(beats - best[0])) best = b;
    return { kind: best[1], flags: best[2], dots: 0, base: best[0] };
  }

  return { LETTERS_DE, LETTERS_INT, isBlack, spell, midiOf, diatonicOf, name, shortName,
           keySignature, keyAlterOf, fifthsOf, keyName, minorName, INTERVAL_NAMES, intervalName,
           scale, SCALES, ROOT_NAMES, durationParts,
           spelled, nameOf, CHORDS, INVERSIONS, chord, chordFingers, cadence, chordRoot, chordSymbol, chordTitle,
           FORMS, GAPPED, scaleFingers, scaleKey, scaleTitle, scaleNotes };
})();
