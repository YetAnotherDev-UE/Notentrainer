/* musicxml.js — MusicXML (partwise, unkomprimiert) -> Stückmodell.
 * Eine Note = Tonhöhe, Beginn und Dauer in Viertelschlägen, Hand (aus dem
 * Staff), Stimme, Takt, Vorzeichen wie notiert. <backup>/<forward> setzen die
 * Zeit innerhalb des Takts zurück bzw. vor, so entstehen zwei Hände und
 * mehrere Stimmen; <chord/> hängt eine Note an die vorige, ohne die Zeit zu
 * bewegen. .mxl (gezippt) wird nicht gelesen — vorher entpacken oder als
 * .musicxml speichern. */
"use strict";
window.NT = window.NT || {};

NT.musicxml = (() => {
  const LETTER = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

  function text(el, sel) { const n = el && el.querySelector(sel); return n ? n.textContent.trim() : null; }
  function num(el, sel, def) { const t = text(el, sel); const v = t == null ? NaN : parseFloat(t); return isNaN(v) ? def : v; }

  function parse(xmlText, meta) {
    const doc = new DOMParser().parseFromString(xmlText, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("Kein gültiges XML");
    const root = doc.querySelector("score-partwise");
    if (!root) throw new Error(doc.querySelector("score-timewise") ? "score-timewise wird nicht unterstützt (in MuseScore als partwise speichern)" : "Kein MusicXML (score-partwise fehlt)");

    const title = text(root, "work > work-title") || text(root, "movement-title") || (meta && meta.title) || "Ohne Titel";
    const composer = text(root, "identification > creator[type=composer]") || (meta && meta.composer) || "";
    // Erste Part-Stimme mit Noten; bei Klavierauszügen ist das das Klavier.
    const parts = Array.from(root.querySelectorAll(":scope > part"));
    const part = parts.find(p => p.querySelector("note pitch")) || parts[0];
    if (!part) throw new Error("Kein <part> gefunden");

    let divisions = 1, fifths = 0, time = { beats: 4, beatType: 4 }, staves = 1, tempo = null;
    const notes = [], measures = [];
    let measureStart = 0;      // in Vierteln
    let seq = 0;

    Array.from(part.querySelectorAll(":scope > measure")).forEach((m, mi) => {
      const attr = m.querySelector(":scope > attributes");
      if (attr) {
        divisions = num(attr, "divisions", divisions);
        const f = num(attr, "key > fifths", NaN); if (!isNaN(f)) fifths = f;
        const b = num(attr, "time > beats", NaN), bt = num(attr, "time > beat-type", NaN);
        if (!isNaN(b) && !isNaN(bt)) time = { beats: b, beatType: bt };
        staves = Math.max(staves, num(attr, "staves", 1));
      }
      const snd = m.querySelector("sound[tempo]"); if (snd && tempo == null) tempo = parseFloat(snd.getAttribute("tempo"));

      let pos = 0, maxPos = 0, lastNote = null;
      for (const el of Array.from(m.children)) {
        const tag = el.tagName;
        if (tag === "backup") { pos -= num(el, "duration", 0); continue; }
        if (tag === "forward") { pos += num(el, "duration", 0); maxPos = Math.max(maxPos, pos); continue; }
        if (tag !== "note") continue;
        const dur = num(el, "duration", 0);
        const isChord = !!el.querySelector(":scope > chord");
        const isRest = !!el.querySelector(":scope > rest");
        const staff = num(el, "staff", 1);
        const voice = num(el, "voice", 1);
        const start = isChord && lastNote ? lastNote.startDiv : pos;
        const grace = !!el.querySelector(":scope > grace");
        if (!grace) {
          const n = { id: "n" + (seq++), measure: mi, staff, voice, hand: staff >= 2 ? "l" : "r",
                      startBeat: measureStart + start / divisions, durBeats: dur / divisions, startDiv: start,
                      isRest, chord: isChord, dots: el.querySelectorAll(":scope > dot").length };
          if (!isRest) {
            const step = text(el, "pitch > step"), octave = num(el, "pitch > octave", 4), alter = num(el, "pitch > alter", 0);
            const letter = LETTER[step] ?? 0;
            n.letter = letter; n.alter = alter; n.octave = octave;
            n.midi = NT.music.midiOf(letter, alter, octave);
            n.diatonic = NT.music.diatonicOf(letter, octave);
            const acc = text(el, "accidental");
            n.accidental = acc === "sharp" || acc === "flat" || acc === "natural" ? acc : null;
            const tie = el.querySelector(":scope > tie[type=stop]"); n.tiedFrom = !!tie;
          }
          notes.push(n);
          lastNote = n;
        }
        if (!isChord) { pos += dur; maxPos = Math.max(maxPos, pos); }
      }
      const lengthBeats = Math.max(maxPos, pos) / divisions || (time.beats * 4 / time.beatType);
      measures.push({ index: mi, startBeat: measureStart, lengthBeats });
      measureStart += lengthBeats;
    });

    const pitched = notes.filter(n => !n.isRest);
    const range = pitched.length ? { low: Math.min(...pitched.map(n => n.midi)), high: Math.max(...pitched.map(n => n.midi)) } : null;
    return { id: (meta && meta.id) || NT.store.newId(), title, composer, source: (meta && meta.source) || "import",
             fifths, time, tempo, staves: Math.max(staves, pitched.some(n => n.staff >= 2) ? 2 : 1),
             measures, notes, range, totalBeats: measureStart };
  }

  // Noten einer Hand, ohne Bindebögen-Fortsetzungen (die werden nicht neu angeschlagen).
  const notesFor = (piece, hand) => piece.notes.filter(n => !n.isRest && !n.tiedFrom && (hand === "both" || n.hand === hand));

  return { parse, notesFor };
})();
