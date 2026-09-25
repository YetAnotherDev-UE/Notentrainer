/* starter.js: vier gemeinfreie Starter-Stücke als MusicXML-Text.
 * Der Text wird aus einer knappen Notation zusammengesetzt, damit die Datei
 * lesbar bleibt; der Parser sieht trotzdem echtes MusicXML und wird damit
 * genauso geprüft wie mit importierten Dateien.
 * Notation: "C4" Tonhöhe, "F#5"/"Bb3" mit Vorzeichen, "R" Pause, Dauer in
 * Zählzeiten (divisions), Akkord als "C3+E3+G3". */
"use strict";
window.NT = window.NT || {};

NT.starterPieces = (() => {
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const TYPE = { 1: "eighth", 2: "quarter", 3: "quarter", 4: "half", 6: "half", 8: "whole", 12: "whole" };

  function noteXml(tok, dur, staff, divisions) {
    if (tok === "R") return `<note><rest/><duration>${dur}</duration><voice>${staff}</voice><type>${TYPE[dur]}</type><staff>${staff}</staff></note>`;
    return tok.split("+").map((p, i) => {
      const m = /^([A-G])([#b]?)(\d)$/.exec(p);
      const alter = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
      const dotted = dur === 3 || dur === 6 || dur === 12;
      return `<note>${i ? "<chord/>" : ""}<pitch><step>${m[1]}</step>${alter ? `<alter>${alter}</alter>` : ""}<octave>${m[3]}</octave></pitch>` +
        `<duration>${dur}</duration><voice>${staff}</voice><type>${TYPE[dur]}</type>${dotted ? "<dot/>" : ""}` +
        (alter && !/#|b/.test(m[2]) ? "" : alter ? `<accidental>${alter > 0 ? "sharp" : "flat"}</accidental>` : "") +
        `<staff>${staff}</staff></note>`;
    }).join("");
  }

  function build(p) {
    const divisions = 2;
    const perBar = p.time[0] * 4 / p.time[1] * divisions;
    const measures = p.bars.map((bar, i) => {
      let xml = `<measure number="${i + 1}">`;
      if (i === 0) {
        xml += `<attributes><divisions>${divisions}</divisions><key><fifths>${p.fifths}</fifths></key>` +
          `<time><beats>${p.time[0]}</beats><beat-type>${p.time[1]}</beat-type></time>` +
          (bar.lh ? `<staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef>` : `<clef><sign>G</sign><line>2</line></clef>`) +
          `</attributes><direction placement="above"><sound tempo="${p.tempo}"/></direction>`;
      }
      xml += bar.rh.map(([t, d]) => noteXml(t, d, 1, divisions)).join("");
      if (bar.lh) xml += `<backup><duration>${perBar}</duration></backup>` + bar.lh.map(([t, d]) => noteXml(t, d, 2, divisions)).join("");
      return xml + "</measure>";
    }).join("");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="3.1"><work><work-title>${esc(p.title)}</work-title></work>` +
      `<identification><creator type="composer">${esc(p.composer)}</creator></identification>` +
      `<part-list><score-part id="P1"><part-name>Klavier</part-name></score-part></part-list><part id="P1">${measures}</part></score-partwise>`;
  }

  // Stücke. Dauern: 1 = Achtel, 2 = Viertel, 3 = punktierte Viertel, 4 = Halbe, 6 = punktierte Halbe, 8 = Ganze.
  const entchen = { id: "starter-entchen", title: "Alle meine Entchen", composer: "Volkslied", fifths: 0, time: [2, 4], tempo: 96,
    bars: [
      { rh: [["C4", 1], ["D4", 1], ["E4", 1], ["F4", 1]] }, { rh: [["G4", 2], ["G4", 2]] },
      { rh: [["A4", 1], ["A4", 1], ["A4", 1], ["A4", 1]] }, { rh: [["G4", 4]] },
      { rh: [["A4", 1], ["A4", 1], ["A4", 1], ["A4", 1]] }, { rh: [["G4", 4]] },
      { rh: [["F4", 1], ["F4", 1], ["F4", 1], ["F4", 1]] }, { rh: [["E4", 2], ["E4", 2]] },
      { rh: [["D4", 1], ["D4", 1], ["D4", 1], ["D4", 1]] }, { rh: [["C4", 4]] },
    ] };

  const freude = { id: "starter-freude", title: "Ode an die Freude", composer: "Ludwig van Beethoven", fifths: 0, time: [4, 4], tempo: 100,
    bars: [
      { rh: [["E4", 2], ["E4", 2], ["F4", 2], ["G4", 2]], lh: [["C3", 8]] },
      { rh: [["G4", 2], ["F4", 2], ["E4", 2], ["D4", 2]], lh: [["G2", 8]] },
      { rh: [["C4", 2], ["C4", 2], ["D4", 2], ["E4", 2]], lh: [["C3", 8]] },
      { rh: [["E4", 3], ["D4", 1], ["D4", 4]],           lh: [["G2", 4], ["C3+E3+G3", 4]] },
      { rh: [["E4", 2], ["E4", 2], ["F4", 2], ["G4", 2]], lh: [["C3", 8]] },
      { rh: [["G4", 2], ["F4", 2], ["E4", 2], ["D4", 2]], lh: [["G2", 8]] },
      { rh: [["C4", 2], ["C4", 2], ["D4", 2], ["E4", 2]], lh: [["C3", 8]] },
      { rh: [["D4", 3], ["C4", 1], ["C4", 4]],           lh: [["G2", 4], ["C3+E3+G3", 4]] },
    ] };

  const menuett = { id: "starter-menuett", title: "Menuett G-Dur (nach Petzold)", composer: "Christian Petzold", fifths: 1, time: [3, 4], tempo: 108,
    bars: [
      { rh: [["D5", 2], ["G4", 1], ["A4", 1], ["B4", 1], ["C5", 1]], lh: [["G3", 6]] },
      { rh: [["D5", 2], ["G4", 2], ["G4", 2]],                       lh: [["B3", 6]] },
      { rh: [["E5", 2], ["C5", 1], ["D5", 1], ["E5", 1], ["F#5", 1]], lh: [["C4", 6]] },
      { rh: [["G5", 2], ["G4", 2], ["G4", 2]],                       lh: [["B3", 6]] },
      { rh: [["C5", 2], ["D5", 1], ["C5", 1], ["B4", 1], ["A4", 1]], lh: [["A3", 6]] },
      { rh: [["B4", 2], ["C5", 1], ["B4", 1], ["A4", 1], ["G4", 1]], lh: [["G3", 6]] },
      { rh: [["F#4", 2], ["G4", 1], ["A4", 1], ["B4", 1], ["G4", 1]], lh: [["D3", 6]] },
      { rh: [["B4", 2], ["A4", 4]],                                   lh: [["D3", 2], ["D3", 2], ["D3", 2]] },
    ] };

  // Das einfachste Stueck fuer beide Haende: links nur halbe Noten, keine Akkorde.
  const haenschen = { id: "starter-haenschen", title: "Hänschen klein", composer: "Volkslied", fifths: 0, time: [2, 4], tempo: 84,
    bars: [
      { rh: [["G4", 2], ["E4", 2]], lh: [["C3", 4]] }, { rh: [["E4", 4]], lh: [["C3", 4]] },
      { rh: [["F4", 2], ["D4", 2]], lh: [["G2", 4]] }, { rh: [["D4", 4]], lh: [["G2", 4]] },
      { rh: [["C4", 2], ["D4", 2]], lh: [["C3", 4]] }, { rh: [["E4", 2], ["F4", 2]], lh: [["C3", 4]] },
      { rh: [["G4", 2], ["G4", 2]], lh: [["G2", 4]] }, { rh: [["G4", 4]], lh: [["G2", 4]] },
      { rh: [["G4", 2], ["E4", 2]], lh: [["C3", 4]] }, { rh: [["E4", 4]], lh: [["C3", 4]] },
      { rh: [["F4", 2], ["D4", 2]], lh: [["G2", 4]] }, { rh: [["D4", 4]], lh: [["G2", 4]] },
      { rh: [["C4", 2], ["E4", 2]], lh: [["C3", 4]] }, { rh: [["G4", 2], ["G4", 2]], lh: [["G2", 4]] },
      { rh: [["C4", 4]], lh: [["C3", 4]] }, { rh: [["C4", 4]], lh: [["C3", 4]] },
    ] };

  return [haenschen, entchen, freude, menuett].map(p => ({ id: p.id, title: p.title, composer: p.composer, xml: build(p) }));
})();
