/* game.js: die Spielmechanik.
 * Betriebsarten: single (Note steht, warten), run (Zufallsnoten laufen ein),
 * phrase (Phrasen aus Stücken mit Rhythmus), scale (Tonleiter), play
 * (Abspielen, ohne Wertung). Im Lauf ist der Fälligkeitszeitpunkt die
 * einzige Quelle für Bild und Wertung: x folgt aus der Restzeit, die Wertung
 * aus dem Abstand des Anschlags. Ereignisse werden roh mitgeschrieben. */
"use strict";
window.NT = window.NT || {};

NT.game = (() => {
  const N = NT.notation, MU = NT.music;
  const WINDOW = 150;
  const S = {
    mode: "single", running: false, rafId: 0, L: null, spec: null,
    lane: [], bars: [], lastBeat: 0, planned: 0, spawnedAll: false,
    target: null, targetShownAt: 0, flash: null, ghost: null, ghostTimer: 0,
    streak: 0, bestStreak: 0, multiplier: 1, hits: 0, misses: 0, xpGained: 0, strays: 0,
    particles: [], shakeUntil: 0,
    session: null, startedAt: 0, source: null, piece: null, hand: "r", preferFlat: false,
    leadBeats: 4, t0: 0, playedCount: 0, iois: [], vels: [],
  };
  const history = [];             // alle events (Verlauf + Sitzung), fürs Gewichten und die Statistik
  let settings = null;            // von app.js gesetzt (gemeinsames Objekt)
  const hooks = { hud: () => {}, feedback: () => {}, finish: () => {}, shake: () => {}, sound: () => {} };

  const beatMs = () => 60000 / (settings.bpm || 80);
  const now = () => performance.now();

  /* --- Gewichtete Zufallsauswahl (Einzeln, Lauf) --------------------- */
  function candidates() {
    const out = [];
    for (let m = settings.low; m <= settings.high; m++) {
      const black = MU.isBlack(m);
      if (settings.keys === "white" && black) continue;
      if (settings.keys === "black" && !black) continue;
      out.push(m);
    }
    return out;
  }
  // Häufig verfehlte Noten kommen öfter dran, über den ganzen Verlauf.
  function pickWeighted(pool, exclude) {
    if (!pool.length) return null;
    const byMidi = new Map();
    for (const e of history) { if (!byMidi.has(e.midi)) byMidi.set(e.midi, []); byMidi.get(e.midi).push(e); }
    const weights = pool.map(m => {
      const seen = byMidi.get(m) || [];
      if (!seen.length) return 2;
      const err = seen.filter(e => !e.correct).length / seen.length;
      const recent = seen.slice(-6), recentErr = recent.filter(e => !e.correct).length / recent.length;
      return 1 + 4 * Math.max(err, recentErr);
    });
    for (let guard = 0; guard < 12; guard++) {
      const total = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total, pick = pool[pool.length - 1];
      for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) { pick = pool[i]; break; } }
      if (pick !== exclude || pool.length === 1) return pick;
    }
    return pool[0];
  }
  const noteFromMidi = (midi, dur) => {
    const s = MU.spell(midi, S.preferFlat);
    return { midi, diatonic: s.diatonic, dur: dur || 1, accidental: s.alter === 1 ? "sharp" : s.alter === -1 ? "flat" : null, hand: settings.clef === "bass" ? "l" : "r" };
  };

  // Beschriftung ueber der Note: "octave" = D4, "name" = D, "off" = nichts.
  const labelsOn = () => !!settings.labels && settings.labels !== "off";
  const labelFor = midi => settings.labels === "octave" ? MU.name(midi, settings.naming, S.preferFlat)
    : settings.labels === "name" ? MU.shortName(midi, settings.naming, S.preferFlat) : null;

  /* --- Quellen: liefern Gruppen gleichzeitiger Noten mit Vorlauf in Schlägen --- */
  function randomSource(count) {
    let n = 0, last = null;
    return { next() { if (n >= count) return null; const m = pickWeighted(candidates(), last); if (m == null) return null; last = m; n++; return { notes: [noteFromMidi(m, 1)], advance: 1, bar: false }; } };
  }
  function scaleSource(root, type, octaves) {
    const seq = MU.scale(root, type, octaves); let i = 0;
    return { next() { if (i >= seq.length) return null; const m = seq[i++]; return { notes: [noteFromMidi(m, 1)], advance: 1, bar: false }; }, length: seq.length };
  }
  // Phrasen: ein bis zwei Takte aus einem gewählten Stück, gewichtet nach
  // Fehlern je (Stück, Takt), gefiltert nach Hand und Tonumfang.
  function phraseSource(pieces, hand, count) {
    let produced = 0, queue = [], gapAfter = false;
    const measureErr = new Map();
    for (const e of history) if (e.piece != null && e.measure != null) {
      const k = e.piece + ":" + e.measure; const v = measureErr.get(k) || { n: 0, bad: 0 };
      v.n++; if (!e.correct) v.bad++; measureErr.set(k, v);
    }
    function candidatesOf() {
      const out = [];
      for (const p of pieces) {
        const notes = NT.musicxml.notesFor(p, hand);
        for (let mi = 0; mi < p.measures.length; mi++) {
          const len = Math.random() < 0.5 && mi + 1 < p.measures.length ? 2 : 1;
          const ms = p.measures.slice(mi, mi + len);
          const ns = notes.filter(n => n.measure >= mi && n.measure < mi + len);
          if (!ns.length) continue;
          if (ns.some(n => n.midi < settings.low || n.midi > settings.high)) continue;
          const k = p.id + ":" + mi, v = measureErr.get(k);
          const w = v ? 1 + 4 * (v.bad / v.n) : 2;
          out.push({ piece: p, from: mi, measures: ms, notes: ns, w });
        }
      }
      return out;
    }
    function fill() {
      const cands = candidatesOf(); if (!cands.length) return false;
      const total = cands.reduce((a, c) => a + c.w, 0); let r = Math.random() * total, pick = cands[cands.length - 1];
      for (const c of cands) { r -= c.w; if (r <= 0) { pick = c; break; } }
      const start = pick.measures[0].startBeat;
      const rests = pick.piece.notes.filter(n => n.isRest && n.measure >= pick.from && n.measure < pick.from + pick.measures.length && (hand === "both" || n.hand === hand));
      const byOnset = new Map();
      for (const n of pick.notes.concat(rests)) { const k = +(n.startBeat - start).toFixed(4); if (!byOnset.has(k)) byOnset.set(k, []); byOnset.get(k).push(n); }
      // Zeitpunkte = Noteneinsaetze vereinigt mit Taktanfaengen, damit jeder
      // Takt seinen Strich bekommt, auch wenn dort keine Note dieser Hand liegt.
      const barSet = new Set(pick.measures.map(m => +(m.startBeat - start).toFixed(4)));
      const onsets = Array.from(new Set([...byOnset.keys(), ...barSet])).sort((a, b) => a - b);
      const len = pick.measures.reduce((a, m) => a + m.lengthBeats, 0);
      onsets.forEach((k, i) => {
        const nextK = i + 1 < onsets.length ? onsets[i + 1] : len;
        const group = (byOnset.get(k) || []).map(n => Object.assign({}, n, { dur: n.durBeats, piece: pick.piece.id, phraseFrom: pick.from }));
        queue.push({ notes: group, advance: nextK - k, bar: barSet.has(k), title: i === 0 ? pick.piece.title + " · Takt " + (pick.from + 1) : null, pieceId: pick.piece.id });
      });
      // Luft zwischen Phrasen: ein Schlag Pause, danach Taktstrich.
      queue[queue.length - 1].advance += 1;
      produced++;
      return true;
    }
    return { next() { if (!queue.length) { if (produced >= count) return null; if (!fill()) return null; } return queue.shift(); } };
  }
  function pieceSource(piece, hand) {
    const notes = NT.musicxml.notesFor(piece, hand).concat(piece.notes.filter(n => n.isRest && (hand === "both" || n.hand === hand)));
    const byOnset = new Map();
    for (const n of notes) { const k = +n.startBeat.toFixed(4); if (!byOnset.has(k)) byOnset.set(k, []); byOnset.get(k).push(n); }
    const barSet = new Set(piece.measures.map(m => +m.startBeat.toFixed(4)));
    const onsets = Array.from(new Set([...byOnset.keys(), ...barSet])).sort((a, b) => a - b); let i = 0;
    return { next() {
      if (i >= onsets.length) return null;
      const k = onsets[i], nextK = i + 1 < onsets.length ? onsets[i + 1] : piece.totalBeats;
      const group = (byOnset.get(k) || []).map(n => Object.assign({}, n, { dur: n.durBeats, piece: piece.id }));
      i++; return { notes: group, advance: nextK - k, bar: barSet.has(k) };
    } };
  }

  /* --- Layout --------------------------------------------------------- */
  function stepsFor(clef, midis) {
    const bd = N.bottomDiatonic(clef);
    let above = 0, below = 0;
    for (const m of midis) { const st = MU.spell(m).diatonic - bd; above = Math.max(above, st - 8); below = Math.max(below, -st); }
    return { above, below };
  }
  function buildSpec() {
    const labels = labelsOn();
    let staves, fifths = 0, time = null;
    if (S.mode === "phrase" || S.mode === "play") {
      const pieces = S.mode === "play" ? [S.piece] : S.pieces;
      fifths = pieces.length ? pieces[0].fifths : 0;
      time = S.mode === "play" && S.piece ? S.piece.time : null;
      const hand = S.hand;
      const midisOf = h => pieces.flatMap(p => NT.musicxml.notesFor(p, h).map(n => n.midi));
      if (hand === "both") staves = [Object.assign({ clef: "treble" }, stepsFor("treble", midisOf("r"))), Object.assign({ clef: "bass" }, stepsFor("bass", midisOf("l")))];
      else staves = [Object.assign({ clef: hand === "l" ? "bass" : "treble" }, stepsFor(hand === "l" ? "bass" : "treble", midisOf(hand)))];
    } else if (S.mode === "scale") {
      // MIDI 60 = C4: Violinschlüssel ab der vierten Oktave (+60), Bassschlüssel ab der dritten (+48).
      const seq = MU.scale(settings.scaleRoot + (settings.clef === "bass" ? 48 : 60), settings.scaleType, settings.scaleOctaves);
      staves = [Object.assign({ clef: settings.clef }, stepsFor(settings.clef, seq))];
      fifths = MU.fifthsOf(settings.scaleRoot % 12, settings.scaleType === "dur" ? "dur" : "moll");
    } else {
      staves = [Object.assign({ clef: settings.clef }, stepsFor(settings.clef, candidates()))];
    }
    S.preferFlat = fifths < 0;
    // Platz für den Phrasentitel unter dem letzten System.
    if (S.mode === "phrase" || S.mode === "play") staves[staves.length - 1].below = (staves[staves.length - 1].below || 0) + 3;
    S.spec = { staves, keyFifths: fifths, time, labels, maxGap: 44 };
    return S.spec;
  }
  function relayout() { if (!S.spec) buildSpec(); S.L = N.layout(S.spec); return S.L; }

  /* --- Ereignisse ------------------------------------------------------ */
  function record(row) {
    row.id = S.session + "-" + (S.hits + S.misses + S.strays + history.length);
    row.session = S.session; row.t = Date.now(); row.mode = S.mode;
    history.push(row); NT.store.queue("events", row);
  }
  function reward(hit) {
    if (hit) {
      S.hits++; S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak);
      S.multiplier = Math.min(4, 1 + Math.floor(S.streak / 10));
      S.xpGained += 10 * S.multiplier;
      hooks.sound(S.streak > 0 && S.streak % 10 === 0 ? "streak" : "hit");
    } else {
      S.misses++; S.streak = 0; S.multiplier = 1;
      hooks.sound("miss"); hooks.shake();
    }
    hooks.hud(hudState());
  }
  const accuracy = () => (S.hits + S.misses) ? S.hits / (S.hits + S.misses) : null;
  const hudState = () => ({ streak: S.streak, multiplier: S.multiplier, hits: S.hits, misses: S.misses, accuracy: accuracy(), xp: S.xpGained, progress: S.mode === "single" ? null : progress() });
  function progress() {
    const total = S.total || 0; if (!total) return null;
    return Math.min(1, (S.hits + S.misses) / total);
  }

  /* --- Einzeln ---------------------------------------------------------- */
  function nextTarget() {
    const m = pickWeighted(candidates(), S.target);
    S.target = m; S.targetShownAt = now(); S.ghost = null; S.flash = null;
    draw();
  }
  function judgeSingle(midi, velocity) {
    if (S.target == null) return;
    const correct = midi === S.target;
    record({ midi: S.target, shownAt: S.targetShownAt, hitAt: now(), playedMidi: midi, correct, velocity });
    reward(correct);
    if (correct) {
      S.flash = "ok"; S.ghost = null;
      hooks.feedback("ok", MU.name(S.target, settings.naming, S.preferFlat) + " · " + Math.round(now() - S.targetShownAt) + " ms");
      burst(S.target);
      draw();
      setTimeout(() => { if (S.mode === "single" && S.running) nextTarget(); }, 240);
    } else {
      S.flash = "miss"; S.ghost = midi;
      hooks.feedback("miss", "Gespielt: " + MU.name(midi, settings.naming, S.preferFlat) + ", gesucht: " + MU.name(S.target, settings.naming, S.preferFlat));
      draw();
      clearTimeout(S.ghostTimer);
      S.ghostTimer = setTimeout(() => { S.flash = null; S.ghost = null; draw(); }, 700);
    }
  }

  /* --- Lauf: Erzeugen, Ablaufen, Werten --------------------------------- */
  function xFor(dueAt, t) { const L = S.L; return L.nowX + ((dueAt - t) / (S.leadBeats * beatMs())) * (L.right - L.nowX); }
  function spawn(t) {
    const horizon = t + (S.leadBeats + 1) * beatMs();
    let guard = 0;
    while (!S.spawnedAll && S.t0 + S.lastBeat * beatMs() < horizon && guard++ < 64) {
      const g = S.source.next();
      if (!g) { S.spawnedAll = true; break; }
      const dueAt = S.t0 + S.lastBeat * beatMs();
      // Neue Phrase aus einem Stück mit anderer Tonart: Vorzeichnung nachziehen.
      if (g.title && S.pieces && g.pieceId) {
        const p = S.pieces.find(q => q.id === g.pieceId);
        if (p && S.spec && p.fifths !== S.spec.keyFifths) { S.spec.keyFifths = p.fifths; S.preferFlat = p.fifths < 0; S.L = N.layout(S.spec); }
      }
      if (g.bar) S.bars.push({ at: dueAt });
      if (g.title) S.bars[S.bars.length - 1] && (S.bars[S.bars.length - 1].title = g.title);
      for (const n of g.notes) {
        S.lane.push({ id: S.planned++, midi: n.midi, diatonic: n.diatonic, accidental: n.accidental, dur: n.dur, hand: n.hand,
                      isRest: !!n.isRest, dueAt, state: n.isRest ? "rest" : "pending", playedAt: 0, playedMidi: 0, velocity: 0,
                      piece: n.piece, measure: n.measure, sounded: false });
      }
      S.lastBeat += g.advance;
    }
  }
  function expire(t) {
    for (const n of S.lane) {
      if (n.state === "pending" && t > n.dueAt + WINDOW) {
        n.state = "miss";
        record({ midi: n.midi, shownAt: n.dueAt - S.leadBeats * beatMs(), hitAt: 0, dueAt: n.dueAt, playedMidi: 0, correct: false, piece: n.piece, measure: n.measure });
        reward(false);
        hooks.feedback("miss", "Verpasst: " + MU.name(n.midi, settings.naming, S.preferFlat));
      }
      if (S.mode === "play" && !n.sounded && t >= n.dueAt) { n.sounded = true; n.state = n.isRest ? "rest" : "played"; if (!n.isRest) hooks.play(n); }
    }
    const cut = S.L.contentLeft - S.L.GAP * 4;
    S.lane = S.lane.filter(n => xFor(n.dueAt, t) > cut);
    S.bars = S.bars.filter(b => xFor(b.at, t) > cut);
    if (S.spawnedAll && !S.lane.some(n => n.state === "pending" || (S.mode === "play" && !n.sounded))) {
      const last = S.t0 + S.lastBeat * beatMs();
      if (t > last + (S.mode === "play" ? 600 : 300)) finish();
    }
  }
  function judgeRun(midi, velocity, t) {
    let best = null, bestDiff = Infinity, exact = null, exactDiff = Infinity;
    for (const n of S.lane) {
      if (n.state !== "pending") continue;
      const d = Math.abs(n.dueAt - t);
      if (d > WINDOW) continue;
      if (n.midi === midi && d < exactDiff) { exact = n; exactDiff = d; }
      if (d < bestDiff) { best = n; bestDiff = d; }
    }
    const n = exact || best;
    if (!n) { S.strays++; return; }        // außerhalb jedes Fensters: nicht werten
    n.playedAt = t; n.playedMidi = midi; n.velocity = velocity;
    n.state = exact ? "hit" : "miss";
    record({ midi: n.midi, shownAt: n.dueAt - S.leadBeats * beatMs(), hitAt: t, dueAt: n.dueAt, playedMidi: midi, correct: !!exact, velocity, piece: n.piece, measure: n.measure });
    reward(!!exact);
    const off = Math.round(t - n.dueAt);
    if (exact) {
      S.iois.push(t); S.vels.push(velocity || 0);
      hooks.feedback("ok", MU.name(n.midi, settings.naming, S.preferFlat) + " · " + (off > 0 ? "+" + off + " ms (spät)" : off < 0 ? off + " ms (früh)" : "genau"));
      burst(n.midi, N.staffFor(S.L, n));
    } else {
      hooks.feedback("miss", "Gespielt: " + MU.name(midi, settings.naming, S.preferFlat) + ", gesucht: " + MU.name(n.midi, settings.naming, S.preferFlat));
    }
  }

  /* --- Zeichnen ---------------------------------------------------------- */
  function colourOf(n) {
    return n.state === "hit" ? N.COL.ok : n.state === "miss" ? N.COL.miss : n.state === "played" ? N.COL.played : N.COL.ink;
  }
  function draw() {
    const L = S.L || relayout(); if (!L) return;
    N.drawStaves(L);
    const t = now();
    if (S.mode === "single") {
      if (S.target != null) {
        const n = noteFromMidi(S.target, 1);
        const x = L.contentLeft + (L.right - L.contentLeft) * 0.42;
        const colour = S.flash === "ok" ? N.COL.ok : S.flash === "miss" ? N.COL.miss : N.COL.ink;
        N.drawNote(L, 0, n, x, { colour, label: labelFor(S.target) });
        if (settings.ghost) N.drawGhost(L, 0, S.ghost, x, S.preferFlat);
      }
    } else {
      N.clipContent(L);
      for (const b of S.bars) {
        // Der Taktstrich steht mit Abstand vor der ersten Note des Takts, nicht auf ihr.
        const x = xFor(b.at, t) - L.GAP * 1.6;
        N.drawBarline(L, x, N.COL.ink);
        // Titel unter das letzte System, damit er den Notennamen nicht in die Quere kommt.
        if (b.title) { const c = N.ctx; c.font = `600 ${Math.round(L.GAP * 0.75)}px system-ui, sans-serif`; c.fillStyle = N.COL.muted; c.textAlign = "left"; c.fillText(b.title, x + L.GAP * 0.3, L.staves[L.staves.length - 1].bottomY + L.GAP * 1.9); }
      }
      // Gruppen gleicher Fälligkeit je Staff -> Akkord
      const groups = new Map();
      for (const n of S.lane) {
        const si = N.staffFor(L, n);
        const k = Math.round(n.dueAt) + ":" + si;
        if (!groups.has(k)) groups.set(k, { si, dueAt: n.dueAt, notes: [] });
        groups.get(k).notes.push(n);
      }
      for (const g of groups.values()) {
        const x = xFor(g.dueAt, t);
        const rests = g.notes.filter(n => n.isRest), pitched = g.notes.filter(n => !n.isRest);
        for (const r of rests) N.drawRest(L, g.si, r.dur, x, N.COL.muted);
        if (!pitched.length) continue;
        const anyMiss = pitched.find(n => n.state === "miss"), allHit = pitched.every(n => n.state === "hit");
        const colour = pitched.length === 1 ? colourOf(pitched[0]) : anyMiss ? N.COL.miss : allHit ? N.COL.ok : pitched.some(n => n.state === "played") ? N.COL.played : N.COL.ink;
        const top = pitched.reduce((a, b) => a.diatonic > b.diatonic ? a : b);
        N.drawChord(L, g.si, pitched, x, { colour, label: labelsOn() ? pitched.map(n => labelFor(n.midi)).join(" ") : null });
        if (settings.ghost) for (const n of pitched) if (n.state === "miss" && n.playedMidi > 0) N.drawGhost(L, g.si, n.playedMidi, x, S.preferFlat);
        void top;
      }
      N.unclip();
      if (S.mode !== "play" || true) N.drawNowLine(L);
    }
    drawParticles(t);
  }

  /* --- Effekte ------------------------------------------------------------ */
  function burst(midi, si) {
    const L = S.L; if (!L) return;
    const s = MU.spell(midi, S.preferFlat);
    const x = S.mode === "single" ? L.contentLeft + (L.right - L.contentLeft) * 0.42 + L.GAP * 0.6 : L.nowX;
    const y = N.yFor(L, si || 0, s.diatonic);
    const colours = ["#22c55e", "#facc15", "#38bdf8", "#f472b6", "#a78bfa"];
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, v = (0.6 + Math.random() * 1.6) * L.GAP * 0.09;
      S.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - L.GAP * 0.04, r: L.GAP * (0.08 + Math.random() * 0.12), born: now(), life: 500 + Math.random() * 300, c: colours[i % colours.length] });
    }
    if (!S.running) animateParticles();
  }
  function drawParticles(t) {
    const c = N.ctx;
    S.particles = S.particles.filter(p => t - p.born < p.life);
    for (const p of S.particles) {
      const k = (t - p.born) / p.life;
      p.x += p.vx; p.y += p.vy; p.vy += S.L.GAP * 0.004;
      c.globalAlpha = 1 - k; c.fillStyle = p.c;
      c.beginPath(); c.arc(p.x, p.y, p.r * (1 - k * 0.5), 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
  }
  function animateParticles() {
    if (S.running) return;
    const step = () => { if (S.running) return; draw(); if (S.particles.length) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* --- Steuerung ----------------------------------------------------------- */
  function resetCounters() { S.streak = 0; S.multiplier = 1; S.hits = 0; S.misses = 0; S.xpGained = 0; S.strays = 0; S.bestStreak = 0; S.iois = []; S.vels = []; S.particles = []; }

  function start(mode, opts) {
    opts = opts || {};
    stop(true);
    S.mode = mode; S.piece = opts.piece || null; S.pieces = opts.pieces || []; S.hand = opts.hand || settings.hand || "r";
    S.session = NT.store.newId(); S.startedAt = Date.now();
    resetCounters();
    S.lane = []; S.bars = []; S.lastBeat = 0; S.planned = 0; S.spawnedAll = false; S.target = null; S.ghost = null; S.flash = null;
    S.spec = null; relayout();
    if (mode === "single") { S.running = true; nextTarget(); hooks.hud(hudState()); return; }
    if (mode === "run") { S.source = randomSource(settings.runLength || 24); S.total = settings.runLength || 24; }
    else if (mode === "scale") { S.source = scaleSource(settings.scaleRoot + (settings.clef === "bass" ? 48 : 60), settings.scaleType, settings.scaleOctaves); S.total = S.source.length; }
    else if (mode === "phrase") { S.source = phraseSource(S.pieces, S.hand, settings.phrases || 6); S.total = 0; }
    else if (mode === "play") { S.source = pieceSource(S.piece, S.hand); S.total = 0; }
    // Vorlauf in Schlägen, aber so gewählt, dass Achtel nicht zusammenkleben.
    S.leadBeats = 4;
    if (mode === "phrase" || mode === "play") {
      const L = S.L, minGap = 0.5;
      const maxLead = ((L.right - L.nowX) * minGap) / (1.9 * N.M.headW * L.GAP);
      S.leadBeats = Math.max(2, Math.min(4, maxLead));
    }
    S.t0 = now() + S.leadBeats * beatMs();
    S.running = true;
    hooks.hud(hudState());
    tick();
  }
  function tick() {
    if (!S.running) return;
    const t = now();
    spawn(t); expire(t);
    if (!S.running) return;
    draw();
    S.rafId = requestAnimationFrame(tick);
  }
  function finish() {
    if (!S.running) return;
    S.running = false; cancelAnimationFrame(S.rafId);
    const res = results();
    if (S.mode !== "play") NT.store.put("sessions", { id: S.session, startedAt: S.startedAt, endedAt: Date.now(), mode: S.mode, hits: S.hits, misses: S.misses, xp: S.xpGained, bestStreak: S.bestStreak, bpm: settings.bpm });
    hooks.finish(res);
  }
  function stop(silent) {
    if (!S.running) return;
    S.running = false; cancelAnimationFrame(S.rafId); clearTimeout(S.ghostTimer);
    if (S.mode === "play") { if (!silent) hooks.finish(results()); return; }
    if (!silent && (S.hits + S.misses) > 0) {
      NT.store.put("sessions", { id: S.session, startedAt: S.startedAt, endedAt: Date.now(), mode: S.mode, hits: S.hits, misses: S.misses, xp: S.xpGained, bestStreak: S.bestStreak, bpm: settings.bpm });
      hooks.finish(results());
    }
  }
  function results() {
    const mine = history.filter(e => e.session === S.session);
    const timed = mine.filter(e => e.correct && typeof e.dueAt === "number");
    const avgOff = timed.length ? timed.reduce((a, e) => a + (e.hitAt - e.dueAt), 0) / timed.length : null;
    const react = mine.filter(e => e.correct && typeof e.dueAt !== "number");
    const avgReact = react.length ? react.reduce((a, e) => a + (e.hitAt - e.shownAt), 0) / react.length : null;
    // Gleichmäßigkeit (Tonleiter): Streuung der Abstände zwischen Treffern und der Anschlagstärke
    let evenness = null;
    if (S.iois.length > 2) {
      const d = S.iois.slice(1).map((t, i) => t - S.iois[i]);
      const mean = d.reduce((a, b) => a + b, 0) / d.length;
      const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / d.length);
      const vmin = Math.min(...S.vels), vmax = Math.max(...S.vels);
      evenness = { ioiSd: sd, ioiMean: mean, velRange: vmax - vmin };
    }
    const byNote = new Map();
    for (const e of mine) { const v = byNote.get(e.midi) || { n: 0, bad: 0 }; v.n++; if (!e.correct) v.bad++; byNote.set(e.midi, v); }
    const weakest = Array.from(byNote.entries()).filter(([, v]) => v.bad).sort((a, b) => (b[1].bad / b[1].n) - (a[1].bad / a[1].n)).slice(0, 5).map(([midi, v]) => ({ midi, ...v }));
    return { mode: S.mode, hits: S.hits, misses: S.misses, accuracy: accuracy(), xp: S.xpGained, bestStreak: S.bestStreak, avgOff, avgReact, evenness, weakest, playback: S.mode === "play" };
  }

  // Eingang vom MIDI-Modul
  function onNoteOn(midi, velocity) {
    if (!S.running) return;
    if (S.mode === "single") judgeSingle(midi, velocity);
    else if (S.mode !== "play") judgeRun(midi, velocity, now());
  }

  return { S, history, hooks, start, stop, draw, relayout, buildSpec, onNoteOn, candidates, results,
           set settings(v) { settings = v; }, get settings() { return settings; }, WINDOW,
           get running() { return S.running; }, get mode() { return S.mode; } };
})();
