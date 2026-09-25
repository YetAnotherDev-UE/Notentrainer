/* music.js — Tonhöhen, Namen, Tonarten, Tonleitern.
 * Keine DOM- und keine Canvas-Abhängigkeit; alles hier ist reine Rechnung.
 * Konvention: MIDI 60 = C4 (wissenschaftliche Schreibweise). Yamaha nennt
 * dieselbe Taste C3 — das ist nur Beschriftung, siehe CLAUDE.md. */
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
  // Nur der Buchstabe mit Vorzeichen, ohne Oktave — für die Beschriftung über der Note.
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

  /* --- Tonleitern ---------------------------------------------------- */
  const SCALES = {
    dur:        [2, 2, 1, 2, 2, 2, 1],
    moll:       [2, 1, 2, 2, 1, 2, 2],
    harmonisch: [2, 1, 2, 2, 1, 3, 1],
  };
  // Auf und wieder ab, ohne den Umkehrton doppelt.
  function scale(root, type, octaves) {
    const steps = SCALES[type] || SCALES.dur;
    const up = [root]; let m = root;
    for (let o = 0; o < octaves; o++) for (const s of steps) { m += s; up.push(m); }
    return up.concat(up.slice(0, -1).reverse());
  }
  const ROOT_NAMES = { 0: "C", 1: "Des", 2: "D", 3: "Es", 4: "E", 5: "F", 6: "Fis", 7: "G", 8: "As", 9: "A", 10: "B", 11: "H" };

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
           keySignature, keyAlterOf, fifthsOf, keyName, scale, SCALES, ROOT_NAMES, durationParts };
})();
