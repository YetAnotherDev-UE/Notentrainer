/* notation.js: Notensystem auf Canvas.
 * Alle Maße in Zwischenräumen (GAP = Abstand zweier Notenlinien). Die Glyphen
 * kommen aus der eingebetteten Schrift (Bravura-Subset, SMuFL): Schriftgröße
 * = Höhe des Fünfliniensystems = 4 * GAP, Nullpunkt jedes Glyphs auf seiner
 * Bezugslinie. Maße stammen aus der Schrift selbst (fontTools), nicht aus
 * Augenmaß. */
"use strict";
window.NT = window.NT || {};

NT.notation = (() => {
  const cp = c => String.fromCodePoint(c);
  const G = {
    gClef: cp(0xE050), fClef: cp(0xE062),
    whole: cp(0xE0A2), half: cp(0xE0A3), black: cp(0xE0A4),
    flagUp8: cp(0xE240), flagDown8: cp(0xE241), flagUp16: cp(0xE242), flagDown16: cp(0xE243),
    restWhole: cp(0xE4E3), restHalf: cp(0xE4E4), restQuarter: cp(0xE4E5), rest8: cp(0xE4E6), rest16: cp(0xE4E7),
    flat: cp(0xE260), natural: cp(0xE261), sharp: cp(0xE262), dot: cp(0xE1E7),
    digits: Array.from({ length: 10 }, (_, i) => cp(0xE080 + i)),
  };
  const FONT = '"NotenSymbole"';
  // Aus der Schrift gemessen, in Zwischenräumen.
  const M = {
    headW: 1.18, wholeW: 1.688, clefW: 2.74,
    stemUp: [1.18, 0.168], stemDown: [0, -0.168], stemLen: 3.5, stemW: 0.13,
    accW: { sharp: 0.996, flat: 0.904, natural: 0.672 },
    digitW: 1.88, dotW: 0.4, lineW: 0.065, ledgerW: 0.09, barW: 0.16,
  };
  const COL = { ink: "#14120f", ok: "#16a34a", miss: "#dc2626", ghost: "#dc2626",
                now: "#f43f5e", muted: "#8b93a5", played: "#2563eb", label: "#475569" };

  const bottomDiatonic = clef => clef === "treble" ? 30 : 18;   // E4 bzw. G2

  let canvas = null, ctx = null;
  function attach(c) { canvas = c; ctx = c.getContext("2d"); }

  function glyph(ch, x, y, size, colour) {
    ctx.font = `${size}px ${FONT}`;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = colour || COL.ink;
    ctx.fillText(ch, x, y);
  }

  /* --- Layout -------------------------------------------------------- *
   * spec.staves: [{ clef, above, below }], above/below in Halbschritten
   * über Linie 5 bzw. unter Linie 1, die der Inhalt braucht.
   * spec.keyFifths, spec.time ({beats, beatType} | null), spec.labels (bool)
   * Ergebnis L beschreibt alles, was zum Zeichnen nötig ist.
   * ------------------------------------------------------------------ */
  function layout(spec) {
    const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    if (!cssW || !cssH) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.round(cssW * dpr), bh = Math.round(cssH * dpr);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const staves = spec.staves.map(s => {
      // Reserven: Violinschlüssel ragt 2.8 Halbschritte über Linie 5 und 3.3
      // unter Linie 1; Notenkopf plus Luft = 2; Beschriftung nochmal 3.
      const above = Math.max(3, (s.above || 0) + 2) + (spec.labels ? 3 : 0);
      const below = Math.max(3.5, (s.below || 0) + 2);
      return { clef: s.clef, bd: bottomDiatonic(s.clef), above, below };
    });
    const gapSteps = staves.length > 1 ? 6 : 0;
    const total = staves.reduce((a, s) => a + 8 + s.above + s.below, 0) + gapSteps * (staves.length - 1);
    // Zweite Grenze aus der Breite: Schluessel, Vorzeichnung, Taktart und der
    // Abstand zur Jetzt-Linie kosten zusammen fixedSpaces Abstaende; rechts der
    // Linie sollen mindestens zehn frei bleiben, sonst kleben die Noten auf
    // schmalen Buehnen aneinander, egal wie klein der Vorlauf ist.
    const nKey0 = Math.abs(spec.keyFifths || 0);
    const fixedSpaces = 0.4 + M.clefW + 0.5 + nKey0 * 1.05 + (spec.time ? 0.4 + M.digitW : 0) + 0.9 + 3.5 + (staves.length > 1 ? 0.9 : 0);
    const widthAvail = cssW - 2 * Math.max(10, cssW * 0.02);
    const GAP = Math.min(spec.maxGap || 44, (2 * cssH) / total, widthAvail / (fixedSpaces + 10));
    const contentH = total * GAP / 2;
    let y = (cssH - contentH) / 2;
    for (const s of staves) {
      y += s.above * GAP / 2;
      s.topY = y;
      s.bottomY = y + 4 * GAP;
      y = s.bottomY + s.below * GAP / 2 + gapSteps * GAP / 2;
    }

    const left = Math.max(10, cssW * 0.02) + (staves.length > 1 ? GAP * 0.9 : 0);
    const right = cssW - Math.max(10, cssW * 0.02);
    const nKey = Math.abs(spec.keyFifths || 0);
    let fixed = left + GAP * 0.4 + M.clefW * GAP + GAP * 0.5 + nKey * GAP * 1.05;
    if (spec.time) fixed += GAP * 0.4 + M.digitW * GAP;
    const contentLeft = fixed + GAP * 0.9;
    const nowX = contentLeft + GAP * 3.5;
    return { W: cssW, H: cssH, GAP, staves, left, right, contentLeft, nowX,
             keyFifths: spec.keyFifths || 0, time: spec.time || null };
  }

  const yFor = (L, si, diatonic) => L.staves[si].bottomY - (diatonic - L.staves[si].bd) * L.GAP / 2;

  /* --- Fester Teil: Linien, Schlüssel, Tonart, Takt ----------------- */
  function drawStaves(L) {
    ctx.clearRect(0, 0, L.W, L.H);
    const GAP = L.GAP;
    ctx.strokeStyle = COL.ink; ctx.lineCap = "butt";
    ctx.lineWidth = Math.max(1, GAP * M.lineW);
    for (const s of L.staves) {
      for (let i = 0; i < 5; i++) {
        const y = s.bottomY - i * GAP;
        ctx.beginPath(); ctx.moveTo(L.left, y); ctx.lineTo(L.right, y); ctx.stroke();
      }
    }
    // Klaviersystem: Klammer und durchgehender Taktstrich links
    if (L.staves.length > 1) {
      const top = L.staves[0].topY, bot = L.staves[L.staves.length - 1].bottomY;
      ctx.lineWidth = Math.max(1, GAP * M.barW);
      ctx.beginPath(); ctx.moveTo(L.left, top); ctx.lineTo(L.left, bot); ctx.stroke();
      const bx = L.left - GAP * 0.35, mid = (top + bot) / 2, w = GAP * 0.55;
      ctx.fillStyle = COL.ink;
      ctx.beginPath();
      ctx.moveTo(bx, top);
      ctx.bezierCurveTo(bx - w, top + (mid - top) * 0.5, bx + w * 0.2, mid - GAP * 0.3, bx - w * 0.9, mid);
      ctx.bezierCurveTo(bx + w * 0.2, mid + GAP * 0.3, bx - w, bot - (bot - mid) * 0.5, bx, bot);
      ctx.bezierCurveTo(bx - w * 0.55, bot - (bot - mid) * 0.5, bx + w * 0.05, mid + GAP * 0.25, bx - w * 0.55, mid);
      ctx.bezierCurveTo(bx + w * 0.05, mid - GAP * 0.25, bx - w * 0.55, top + (mid - top) * 0.5, bx, top);
      ctx.fill();
    }
    let x = L.left + GAP * 0.4;
    L.staves.forEach((s, si) => {
      // Schlüssel: Violinschlüssel auf der G-Linie (2. von unten), Bassschlüssel auf der F-Linie (4.)
      if (s.clef === "treble") glyph(G.gClef, x, s.bottomY - GAP, GAP * 4);
      else glyph(G.fClef, x, s.bottomY - 3 * GAP, GAP * 4);
      // Tonart
      let kx = x + M.clefW * GAP + GAP * 0.5;
      for (const k of NT.music.keySignature(L.keyFifths, s.clef)) {
        glyph(k.kind === "sharp" ? G.sharp : G.flat, kx, s.bottomY - k.step * GAP / 2, GAP * 4);
        kx += GAP * 1.05;
      }
      // Taktart: Zähler auf Linie 4, Nenner auf Linie 2 zentriert
      if (L.time) {
        const tx = kx + GAP * 0.4;
        drawDigits(String(L.time.beats), tx, s.bottomY - 3 * GAP, GAP);
        drawDigits(String(L.time.beatType), tx, s.bottomY - GAP, GAP);
      }
    });
  }
  function drawDigits(str, x, y, GAP) {
    let cx = x;
    for (const ch of str) { glyph(G.digits[+ch], cx, y, GAP * 4); cx += M.digitW * GAP * 0.92; }
  }

  // Alles rechts des festen Teils wird beim Scrollen abgeschnitten.
  function clipContent(L) {
    ctx.save(); ctx.beginPath(); ctx.rect(L.contentLeft - L.GAP * 0.6, 0, L.W, L.H); ctx.clip();
  }
  const unclip = () => ctx.restore();

  /* --- Noten --------------------------------------------------------- *
   * note: { diatonic, dur (Viertel), accidental: null|"sharp"|"flat"|"natural" }
   * o: { colour, alpha, stemUp (optional), label (Text über der Note) }
   * x ist die linke Kante des Notenkopfs.
   * ------------------------------------------------------------------ */
  function ledger(L, s, step, x, w, colour) {
    const GAP = L.GAP;
    ctx.strokeStyle = colour; ctx.lineWidth = Math.max(1, GAP * M.ledgerW);
    const line = st => { const ly = s.bottomY - st * GAP / 2; ctx.beginPath(); ctx.moveTo(x - GAP * 0.35, ly); ctx.lineTo(x + w + GAP * 0.35, ly); ctx.stroke(); };
    if (step < 0) for (let st = -2; st >= step; st -= 2) line(st);
    if (step > 8) for (let st = 10; st <= step; st += 2) line(st);
  }

  function drawNote(L, si, note, x, o) {
    o = o || {};
    const GAP = L.GAP, s = L.staves[si], colour = o.colour || COL.ink;
    const step = note.diatonic - s.bd, y = s.bottomY - step * GAP / 2;
    const d = NT.music.durationParts(note.dur == null ? 1 : note.dur);
    const w = (d.kind === "whole" ? M.wholeW : M.headW) * GAP;
    if (o.alpha != null) { ctx.save(); ctx.globalAlpha = o.alpha; }

    ledger(L, s, step, x, w, colour);
    glyph(d.kind === "whole" ? G.whole : d.kind === "half" ? G.half : G.black, x, y, GAP * 4, colour);

    let topY = y - GAP * 0.5;
    if (d.kind !== "whole" && !o.noStem) {
      const up = o.stemUp != null ? o.stemUp : step < 4;
      const [ax, ay] = up ? M.stemUp : M.stemDown;
      const sx = x + ax * GAP, sy = y - ay * GAP;
      const ey = up ? sy - M.stemLen * GAP : sy + M.stemLen * GAP;
      ctx.strokeStyle = colour; ctx.lineWidth = Math.max(1.2, GAP * M.stemW); ctx.lineCap = "butt";
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, ey); ctx.stroke();
      if (d.flags === 1) glyph(up ? G.flagUp8 : G.flagDown8, sx - (up ? 0 : ctx.lineWidth / 2), ey, GAP * 4, colour);
      if (d.flags === 2) glyph(up ? G.flagUp16 : G.flagDown16, sx - (up ? 0 : ctx.lineWidth / 2), ey, GAP * 4, colour);
      if (up) topY = Math.min(topY, ey);
    }
    if (d.dots) {
      // Auf einer Linie sitzt der Punkt im Zwischenraum darüber.
      const dy = (step % 2 === 0) ? y - GAP * 0.5 : y;
      glyph(G.dot, x + w + GAP * 0.3, dy, GAP * 4, colour);
    }
    if (note.accidental) {
      const acc = note.accidental;
      glyph(G[acc], x - (M.accW[acc] + 0.22) * GAP, y, GAP * 4, colour);
    }
    if (o.label) {
      ctx.font = `700 ${Math.round(GAP * 0.95)}px "Segoe UI", system-ui, sans-serif`;
      ctx.textBaseline = "alphabetic"; ctx.textAlign = "center";
      ctx.fillStyle = o.labelColour || COL.label;
      ctx.fillText(o.label, x + w / 2, topY - GAP * 0.45);
      ctx.textAlign = "start";
    }
    if (o.alpha != null) ctx.restore();
    return { y, w };
  }

  // Akkord: Köpfe, gemeinsamer Hals, Sekunden versetzt.
  function drawChord(L, si, notes, x, o) {
    o = o || {};
    if (notes.length === 1) return drawNote(L, si, notes[0], x, o);
    const GAP = L.GAP, s = L.staves[si], colour = o.colour || COL.ink;
    const sorted = notes.slice().sort((a, b) => a.diatonic - b.diatonic);
    const steps = sorted.map(n => n.diatonic - s.bd);
    const mean = steps.reduce((a, b) => a + b, 0) / steps.length;
    const up = o.stemUp != null ? o.stemUp : mean < 4;
    const d = NT.music.durationParts(sorted[0].dur == null ? 1 : sorted[0].dur);
    const w = (d.kind === "whole" ? M.wholeW : M.headW) * GAP;
    if (o.alpha != null) { ctx.save(); ctx.globalAlpha = o.alpha; }
    // Sekunden: bei Hals oben rückt der obere Kopf nach rechts, bei Hals unten der untere nach links.
    const xs = sorted.map(() => x);
    for (let i = 1; i < sorted.length; i++) {
      if (steps[i] - steps[i - 1] === 1 && xs[i - 1] === x) xs[i] = up ? x + w : x - w;
      else if (steps[i] - steps[i - 1] === 1) xs[i] = x;
    }
    if (!up) for (let i = 0; i < xs.length; i++) if (xs[i] === x - w) { /* schon versetzt */ }
    sorted.forEach((n, i) => drawNote(L, si, Object.assign({}, n, { dur: d.base * (d.dots ? 1.5 : 1) }), xs[i], { colour, stemUp: up, label: i === sorted.length - 1 ? o.label : null, labelColour: o.labelColour, noStem: true }));
    // gemeinsamer Hals über alle Köpfe: drawNote zeichnet je Note einen kurzen Hals;
    // hier zusätzlich der lange von unterstem zu oberstem Kopf.
    if (d.kind !== "whole") {
      const [ax, ay] = up ? M.stemUp : M.stemDown;
      const lowY = s.bottomY - steps[0] * GAP / 2, highY = s.bottomY - steps[steps.length - 1] * GAP / 2;
      const sx = x + ax * GAP;
      const from = up ? lowY - ay * GAP : highY - ay * GAP;
      const to = up ? highY - ay * GAP - M.stemLen * GAP : lowY - ay * GAP + M.stemLen * GAP;
      ctx.strokeStyle = colour; ctx.lineWidth = Math.max(1.2, GAP * M.stemW);
      ctx.beginPath(); ctx.moveTo(sx, from); ctx.lineTo(sx, to); ctx.stroke();
      if (d.flags === 1) glyph(up ? G.flagUp8 : G.flagDown8, sx - (up ? 0 : ctx.lineWidth / 2), to, GAP * 4, colour);
      if (d.flags === 2) glyph(up ? G.flagUp16 : G.flagDown16, sx - (up ? 0 : ctx.lineWidth / 2), to, GAP * 4, colour);
    }
    if (o.alpha != null) ctx.restore();
  }

  function drawRest(L, si, dur, x, colour) {
    const GAP = L.GAP, s = L.staves[si], d = NT.music.durationParts(dur);
    colour = colour || COL.ink;
    if (d.base >= 4) glyph(G.restWhole, x, s.bottomY - 3 * GAP, GAP * 4, colour);        // hängt an Linie 4
    else if (d.base >= 2) glyph(G.restHalf, x, s.bottomY - 2 * GAP, GAP * 4, colour);    // sitzt auf Linie 3
    else if (d.base >= 1) glyph(G.restQuarter, x, s.bottomY - 2 * GAP, GAP * 4, colour);
    else if (d.base >= 0.5) glyph(G.rest8, x, s.bottomY - 2 * GAP, GAP * 4, colour);
    else glyph(G.rest16, x, s.bottomY - 2 * GAP, GAP * 4, colour);
    if (d.dots) glyph(G.dot, x + GAP * 1.3, s.bottomY - 2.5 * GAP, GAP * 4, colour);
  }

  function drawBarline(L, x, colour) {
    const top = L.staves[0].topY, bot = L.staves[L.staves.length - 1].bottomY;
    ctx.strokeStyle = colour || COL.ink; ctx.lineWidth = Math.max(1, L.GAP * M.barW);
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bot); ctx.stroke();
  }

  function drawNowLine(L) {
    const GAP = L.GAP, top = L.staves[0].topY - GAP * 1.6, bot = L.staves[L.staves.length - 1].bottomY + GAP * 1.6;
    ctx.save();
    ctx.strokeStyle = COL.now; ctx.globalAlpha = 0.55; ctx.lineWidth = Math.max(2, GAP * 0.1);
    ctx.shadowColor = COL.now; ctx.shadowBlur = GAP * 0.6;
    ctx.beginPath(); ctx.moveTo(L.nowX, top); ctx.lineTo(L.nowX, bot); ctx.stroke();
    ctx.restore();
  }

  // Tatsächlich gespielte Note als Geist neben der verlangten.
  function drawGhost(L, si, midi, x, preferFlat) {
    if (!(midi > 0)) return;
    const s = NT.music.spell(midi, preferFlat);
    const acc = s.alter === 1 ? "sharp" : s.alter === -1 ? "flat" : null;
    drawNote(L, si, { diatonic: s.diatonic, dur: 1, accidental: acc }, x + L.GAP * 1.5, { colour: COL.ghost, alpha: 0.4 });
  }

  // Welcher Staff für eine Note im Klaviersystem: nach Hand, sonst nach Höhe.
  const staffFor = (L, note) => L.staves.length === 1 ? 0 : (note.hand === "l" ? 1 : note.hand === "r" ? 0 : (note.midi < 60 ? 1 : 0));

  return { G, M, COL, attach, layout, yFor, drawStaves, clipContent, unclip, drawNote, drawChord,
           drawRest, drawBarline, drawNowLine, drawGhost, staffFor, bottomDiatonic,
           get ctx() { return ctx; }, get canvas() { return canvas; } };
})();
