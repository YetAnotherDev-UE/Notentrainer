/* game.js: die Spielmechanik.
 * Betriebsarten: single (Note steht, warten), ear (Ton hören, Taste suchen),
 * run (Zufallsnoten laufen ein), interval (Lauf, beschriftet mit der Bewegung
 * zur vorigen Note), rhythm (nur der Zeitpunkt zählt, jede Taste), scale
 * (Tonleiter), phrase (Phrasen aus Stücken), piece (ganzes Stück, gewertet),
 * play (Abspielen, ohne Wertung).
 * Im Lauf ist der Fälligkeitszeitpunkt die einzige Quelle für Bild und
 * Wertung: x folgt aus der Restzeit, die Wertung aus dem Abstand des
 * Anschlags. Ereignisse werden roh mitgeschrieben.
 * Einstellungen kommen als cfg herein: die gespeicherten Werte, überdeckt
 * von dem, was ein Abenteuer-Level oder ein Aufruf vorgibt (override).
 * Metronom und Einzähler: Klicks werden 160 ms voraus auf die Zeitachse des
 * AudioContext gelegt, damit sie nicht am Bildtakt hängen. */
"use strict";
window.NT = window.NT || {};

NT.game = (() => {
  const N = NT.notation, MU = NT.music;
  const WINDOW = 150;
  const TIMED = ["run", "interval", "rhythm", "scale", "phrase", "piece", "play"];
  const STATIC = ["single", "ear"];
  // Notenwerte je Rhythmus-Stufe (Einstellung), in Vierteln.
  const RHYTHM_SETS = { 1: [1, 2], 2: [1, 2, 4], 3: [1, 2, 0.5], 4: [1, 2, 0.5, 1.5], 5: [1, 2, 4, 0.5, 1.5] };
  const S = {
    mode: "single", running: false, rafId: 0, L: null, spec: null, cfg: null,
    lane: [], bars: [], lastBeat: 0, planned: 0, spawnedAll: false,
    target: null, targetShownAt: 0, flash: null, ghost: null, ghostTimer: 0, hint: null, replayTimer: 0, nextTimer: 0, limit: 0,
    streak: 0, bestStreak: 0, multiplier: 1, hits: 0, misses: 0, xpGained: 0, strays: 0,
    particles: [], session: null, startedAt: 0, source: null, piece: null, pieces: [], hand: "r", preferFlat: false,
    leadBeats: 4, t0: 0, iois: [], vels: [], total: 0,
    countIn: 0, beatsPerBar: 4, nextClick: 0, countShown: null, anyPitch: false, pool: null, level: null, sessionRow: null, aborted: false,
  };
  const history = [];             // alle events (Verlauf + Sitzung), fürs Gewichten und die Statistik
  let settings = null;            // von app.js gesetzt (gemeinsames Objekt)
  let canvas = null;
  const hooks = { hud: () => {}, feedback: () => {}, finish: () => {}, shake: () => {}, sound: () => {}, play: () => {}, click: () => {}, count: () => {} };

  const cfg = () => S.cfg || settings;
  const beatMs = () => 60000 / (cfg().bpm || 80);
  const now = () => performance.now();

  /* --- Gewichtete Zufallsauswahl (Einzeln, Lauf) --------------------- */
  function candidatesFor(c) {
    const out = [];
    for (let m = c.low; m <= c.high; m++) {
      const black = MU.isBlack(m);
      if (c.keys === "white" && black) continue;
      if (c.keys === "black" && !black) continue;
      out.push(m);
    }
    return out;
  }
  const candidates = () => candidatesFor(cfg());
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
    return { midi, diatonic: s.diatonic, dur: dur || 1, accidental: s.alter === 1 ? "sharp" : s.alter === -1 ? "flat" : null, hand: cfg().clef === "bass" ? "l" : "r" };
  };

  // Beschriftung ueber der Note: "octave" = D4, "name" = D, "off" = nichts.
  // Im Rhythmus gibt es nichts zu benennen, da bleibt die Beschriftung aus.
  const labelsOn = () => { const l = cfg().labels; return !!l && l !== "off" && S.mode !== "rhythm"; };
  const labelFor = midi => { const c = cfg(); return c.labels === "octave" ? MU.name(midi, c.naming, S.preferFlat) : c.labels === "name" ? MU.shortName(midi, c.naming, S.preferFlat) : null; };
  const fullName = midi => MU.name(midi, cfg().naming, S.preferFlat);

  /* --- Quellen: liefern Gruppen gleichzeitiger Noten mit Vorlauf in Schlägen --- */
  function randomSource(count, pool) {
    let n = 0, last = null;
    return { next() { if (n >= count) return null; const m = pickWeighted(pool, last); if (m == null) return null; last = m; n++; return { notes: [noteFromMidi(m, 1)], advance: 1, bar: false }; } };
  }
  // Intervalle: jede Note ist relativ zur vorigen beschriftet (Sekunde
  // aufwärts, Terz abwärts). Die erste Note ist ein Orientierungston mit
  // Namen. Nur weisse Tasten, gezählt wird der Buchstabenabstand.
  function intervalSource(count, pool, maxIv) {
    const white = pool.filter(m => !MU.isBlack(m));
    if (white.length < 2) return randomSource(count, pool);
    const maxSteps = Math.max(1, (maxIv || 5) - 1);
    const anchors = [60, 67, 53, 72, 48, 55, 65].filter(m => white.includes(m));
    let prev = anchors.length ? anchors[Math.floor(Math.random() * anchors.length)] : white[Math.floor(Math.random() * white.length)];
    let n = 0;
    return { next() {
      if (n >= count) return null;
      let note;
      if (n === 0) { note = noteFromMidi(prev, 1); note.label = fullName(prev); }
      else {
        const pd = MU.spell(prev).diatonic;
        const opts = white.filter(m => { const d = MU.spell(m).diatonic - pd; return d !== 0 && Math.abs(d) <= maxSteps; });
        const m = opts.length ? pickWeighted(opts, prev) : pickWeighted(white, prev);
        const d = MU.spell(m).diatonic - pd;
        note = noteFromMidi(m, 1);
        note.label = (d > 0 ? "↑ " : "↓ ") + MU.intervalName(d);
        prev = m;
      }
      n++;
      return { notes: [note], advance: 1, bar: false };
    } };
  }
  // Rhythmus: Takte aus zufälligen Notenwerten auf einer Tonhöhe. Nach einer
  // punktierten Viertel folgt ein Achtel, eine Ganze nur im leeren Takt.
  function rhythmSource(bars, set, withRests, bpb, midi) {
    const seq = [], near = (a, b) => Math.abs(a - b) < 0.01;
    for (let b = 0; b < bars; b++) {
      let left = bpb, first = true, guard = 0;
      while (left > 0.01 && guard++ < 32) {
        let opts = set.filter(d => d <= left + 0.01 && (!near(d, 1.5) || left - 1.5 >= 0.49) && (!near(d, 4) || left >= bpb - 0.01));
        if (!opts.length) opts = [left >= 0.99 ? 1 : 0.5];
        const d = opts[Math.floor(Math.random() * opts.length)];
        const rest = withRests && !first && d <= 1 && Math.random() < 0.2;
        seq.push({ notes: [rest ? { isRest: true, dur: d } : noteFromMidi(midi, d)], advance: d, bar: first });
        left -= d; first = false;
        if (near(d, 1.5)) { seq.push({ notes: [noteFromMidi(midi, 0.5)], advance: 0.5, bar: false }); left -= 0.5; }
      }
    }
    if (seq.length) seq[seq.length - 1].advance += 1;
    let i = 0;
    return { next: () => i < seq.length ? seq[i++] : null, length: seq.filter(g => !g.notes[0].isRest).length };
  }
  function scaleSource(root, type, octaves) {
    const seq = MU.scale(root, type, octaves); let i = 0;
    return { next() { if (i >= seq.length) return null; const m = seq[i++]; return { notes: [noteFromMidi(m, 1)], advance: 1, bar: false }; }, length: seq.length };
  }
  // Phrasen: ein bis zwei Takte aus einem gewählten Stück, gewichtet nach
  // Fehlern je (Stück, Takt), gefiltert nach Hand und Tonumfang. Mit `only`
  // (Menge "stück:takt") nur bestimmte Takte, fürs Nachsitzen.
  function phraseSource(pieces, hand, count, only) {
    let produced = 0, queue = [];
    const c = cfg();
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
          if (only && !only.has(p.id + ":" + mi)) continue;
          const len = !only && Math.random() < 0.5 && mi + 1 < p.measures.length ? 2 : 1;
          const ms = p.measures.slice(mi, mi + len);
          const ns = notes.filter(n => n.measure >= mi && n.measure < mi + len);
          if (!ns.length) continue;
          if (ns.some(n => n.midi < c.low || n.midi > c.high)) continue;
          const k = p.id + ":" + mi, v = measureErr.get(k);
          const w = v ? 1 + 4 * (v.bad / v.n) : 2;
          out.push({ piece: p, from: mi, measures: ms, notes: ns, w });
        }
      }
      return out;
    }
    function fill() {
      const cands = candidatesOf(); if (!cands.length) return false;
      const total = cands.reduce((a, q) => a + q.w, 0); let r = Math.random() * total, pick = cands[cands.length - 1];
      for (const q of cands) { r -= q.w; if (r <= 0) { pick = q; break; } }
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
  const usesPieces = () => S.mode === "phrase" || S.mode === "play" || S.mode === "piece";
  function buildSpec() {
    const c = cfg();
    const labels = labelsOn();
    let staves, fifths = 0, time = null, fingers = false;
    if (usesPieces()) {
      const pieces = S.mode === "phrase" ? S.pieces : [S.piece];
      fifths = pieces.length && pieces[0] ? pieces[0].fifths : 0;
      time = S.mode !== "phrase" && S.piece ? S.piece.time : null;
      const hand = S.hand;
      const midisOf = h => pieces.flatMap(p => NT.musicxml.notesFor(p, h).map(n => n.midi));
      if (hand === "both") staves = [Object.assign({ clef: "treble" }, stepsFor("treble", midisOf("r"))), Object.assign({ clef: "bass" }, stepsFor("bass", midisOf("l")))];
      else staves = [Object.assign({ clef: hand === "l" ? "bass" : "treble" }, stepsFor(hand === "l" ? "bass" : "treble", midisOf(hand)))];
      fingers = pieces.some(p => p && p.notes.some(n => n.finger));
    } else if (S.mode === "scale") {
      // MIDI 60 = C4: Violinschlüssel ab der vierten Oktave (+60), Bassschlüssel ab der dritten (+48).
      const seq = MU.scale(c.scaleRoot + (c.clef === "bass" ? 48 : 60), c.scaleType, c.scaleOctaves);
      staves = [Object.assign({ clef: c.clef }, stepsFor(c.clef, seq))];
      fifths = MU.fifthsOf(c.scaleRoot % 12, c.scaleType === "dur" ? "dur" : "moll");
    } else if (S.mode === "rhythm") {
      staves = [{ clef: c.clef, above: 0, below: 0 }];
      time = { beats: S.beatsPerBar, beatType: 4 };
    } else {
      staves = [Object.assign({ clef: c.clef }, stepsFor(c.clef, S.pool || candidates()))];
    }
    S.preferFlat = fifths < 0;
    // Platz für den Phrasentitel unter dem letzten System.
    if (usesPieces()) staves[staves.length - 1].below = (staves[staves.length - 1].below || 0) + 3;
    S.spec = { staves, keyFifths: fifths, time, labels, fingers, maxGap: 44 };
    return S.spec;
  }
  function relayout() { if (canvas) N.attach(canvas); if (!S.spec) buildSpec(); S.L = N.layout(S.spec); return S.L; }

  /* --- Ereignisse ------------------------------------------------------ */
  function record(row) {
    row.id = S.session + "-" + (S.hits + S.misses + S.strays + history.length);
    row.session = S.session; row.t = Date.now(); row.mode = S.mode;
    if (S.level) row.level = S.level.id;
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
  const hudState = () => ({ streak: S.streak, multiplier: S.multiplier, hits: S.hits, misses: S.misses, accuracy: accuracy(), xp: S.xpGained, progress: progress() });
  function progress() {
    if (STATIC.includes(S.mode)) return S.limit ? Math.min(1, (S.hits + S.misses) / S.limit) : null;
    const total = S.total || 0; if (!total) return null;
    return Math.min(1, (S.hits + S.misses) / total);
  }

  /* --- Einzeln und Gehör ------------------------------------------------ */
  function nextTarget() {
    const m = pickWeighted(S.pool || candidates(), S.target);
    S.target = m; S.targetShownAt = now(); S.ghost = null; S.flash = null; S.hint = null;
    if (S.mode === "ear") { clearTimeout(S.replayTimer); S.replayTimer = setTimeout(() => { if (S.running && S.target === m) hooks.play({ midi: m, dur: 1.5 }); }, 250); }
    draw();
  }
  function replay() { if (S.mode === "ear" && S.target != null && S.running) hooks.play({ midi: S.target, dur: 1.5 }); }
  function judgeSingle(midi, velocity) {
    if (S.target == null || S.nextTimer) return;
    const correct = midi === S.target;
    record({ midi: S.target, shownAt: S.targetShownAt, hitAt: now(), playedMidi: midi, correct, velocity });
    reward(correct);
    const done = S.limit && S.hits + S.misses >= S.limit;
    if (correct) {
      S.flash = "ok"; S.ghost = null; S.hint = null;
      hooks.feedback("ok", fullName(S.target) + " · " + Math.round(now() - S.targetShownAt) + " ms");
      burst(S.target);
      draw();
      S.nextTimer = setTimeout(() => { S.nextTimer = 0; if (!S.running) return; if (done) finish(); else nextTarget(); }, S.mode === "ear" ? 650 : 240);
    } else {
      S.flash = "miss"; S.ghost = midi;
      if (S.mode === "ear") {
        S.hint = midi > S.target ? "tiefer" : "höher";
        hooks.feedback("miss", "Gespielt: " + fullName(midi) + ". Der gesuchte Ton liegt " + S.hint + ".");
        clearTimeout(S.replayTimer); S.replayTimer = setTimeout(replay, 500);
      } else hooks.feedback("miss", "Gespielt: " + fullName(midi) + ", gesucht: " + fullName(S.target));
      draw();
      clearTimeout(S.ghostTimer);
      S.ghostTimer = setTimeout(() => { S.flash = null; S.ghost = null; draw(); }, 700);
      if (done) S.nextTimer = setTimeout(() => { S.nextTimer = 0; if (S.running) finish(); }, 800);
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
                      piece: n.piece, measure: n.measure, sounded: false, label: n.label || null, finger: n.finger || null });
      }
      S.lastBeat += g.advance;
    }
  }
  const nameOf = n => S.anyPitch ? "Schlag" : fullName(n.midi);
  function expire(t) {
    for (const n of S.lane) {
      if (n.state === "pending" && t > n.dueAt + WINDOW) {
        n.state = "miss";
        record({ midi: n.midi, shownAt: n.dueAt - S.leadBeats * beatMs(), hitAt: 0, dueAt: n.dueAt, playedMidi: 0, correct: false, piece: n.piece, measure: n.measure });
        reward(false);
        hooks.feedback("miss", "Verpasst: " + nameOf(n));
      }
      if (S.mode === "play" && !n.sounded && t >= n.dueAt) { n.sounded = true; n.state = n.isRest ? "rest" : "played"; if (!n.isRest) hooks.play(n); }
    }
    if (S.L) {
      const cut = S.L.contentLeft - S.L.GAP * 4;
      S.lane = S.lane.filter(n => xFor(n.dueAt, t) > cut);
      S.bars = S.bars.filter(b => xFor(b.at, t) > cut);
    } else S.L = relayout();
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
      if ((S.anyPitch || n.midi === midi) && d < exactDiff) { exact = n; exactDiff = d; }
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
      hooks.feedback("ok", nameOf(n) + " · " + (off > 0 ? "+" + off + " ms (spät)" : off < 0 ? off + " ms (früh)" : "genau"));
      burst(n.midi, S.L ? N.staffFor(S.L, n) : 0);
    } else {
      hooks.feedback("miss", "Gespielt: " + fullName(midi) + ", gesucht: " + fullName(n.midi));
    }
  }

  /* --- Metronom und Einzähler ------------------------------------------- */
  // Schlag k liegt bei t0 + k * beatMs; k < 0 ist der Einzähler. Betont wird
  // der Taktanfang: in Stücken der Taktstrich, sonst jeder erste Schlag.
  function scheduleClicks(t) {
    const c = cfg();
    if (!S.countIn && !c.metronome) return;
    const bm = beatMs(), bpb = S.beatsPerBar;
    while (S.t0 + S.nextClick * bm <= t + 160) {
      const k = S.nextClick++, at = S.t0 + k * bm;
      if (at < t - 40) continue;
      if (k < 0) { if (S.countIn) hooks.click(k === -S.countIn, at); continue; }
      if (!c.metronome) continue;
      if (S.spawnedAll && k > S.lastBeat - 0.5) continue;
      const accent = S.bars.length ? S.bars.some(b => Math.abs(b.at - at) < 5) : k % bpb === 0;
      hooks.click(accent, at);
    }
  }
  function showCount(t) {
    let n = null;
    if (S.countIn && t < S.t0) {
      const rem = (S.t0 - t) / beatMs();
      if (rem <= S.countIn + 0.02) n = Math.max(1, S.countIn - Math.ceil(rem) + 1);
    }
    if (n !== S.countShown) { S.countShown = n; hooks.count(n, S.countIn); }
  }

  /* --- Zeichnen ---------------------------------------------------------- */
  function colourOf(n) {
    return n.state === "hit" ? N.COL.ok : n.state === "miss" ? N.COL.miss : n.state === "played" ? N.COL.played : N.COL.ink;
  }
  function draw() {
    if (canvas) N.attach(canvas);
    const L = S.L || relayout(); if (!L) return;
    N.drawStaves(L);
    const t = now();
    if (STATIC.includes(S.mode)) {
      if (S.target != null) {
        const n = noteFromMidi(S.target, 1);
        const x = L.contentLeft + (L.right - L.contentLeft) * 0.42;
        const colour = S.flash === "ok" ? N.COL.ok : S.flash === "miss" ? N.COL.miss : N.COL.ink;
        const hidden = S.mode === "ear" && S.flash !== "ok";
        if (hidden) {
          const s = L.staves[0];
          N.drawText(L, "?", x + N.M.headW * L.GAP / 2, (s.topY + s.bottomY) / 2, 2.2, S.flash === "miss" ? N.COL.miss : N.COL.muted);
          if (S.hint) N.drawText(L, S.hint === "höher" ? "▲ höher" : "▼ tiefer", x + L.GAP * 2.6, (s.topY + s.bottomY) / 2, 1.0, N.COL.miss, "left");
        } else N.drawNote(L, 0, n, x, { colour, label: S.mode === "ear" ? fullName(S.target) : labelFor(S.target) });
        if (cfg().ghost || S.mode === "ear") N.drawGhost(L, 0, S.ghost, x, S.preferFlat);
      }
    } else {
      N.clipContent(L);
      for (const b of S.bars) {
        // Der Taktstrich steht mit Abstand vor der ersten Note des Takts, nicht auf ihr.
        const x = xFor(b.at, t) - L.GAP * 1.6;
        N.drawBarline(L, x, N.COL.ink);
        // Titel unter das letzte System, damit er den Notennamen nicht in die Quere kommt.
        if (b.title) { const c = N.ctx; c.font = `600 ${Math.round(L.GAP * 0.75)}px "Baloo 2", "Segoe UI", system-ui, sans-serif`; c.fillStyle = N.COL.muted; c.textAlign = "left"; c.fillText(b.title, x + L.GAP * 0.3, L.staves[L.staves.length - 1].bottomY + L.GAP * 1.9); }
      }
      // Gruppen gleicher Fälligkeit je Staff -> Akkord
      const groups = new Map();
      for (const n of S.lane) {
        const si = N.staffFor(L, n);
        const k = Math.round(n.dueAt) + ":" + si;
        if (!groups.has(k)) groups.set(k, { si, dueAt: n.dueAt, notes: [] });
        groups.get(k).notes.push(n);
      }
      // Blindflug: kurz vor der Linie wird die Note unsichtbar, bis sie gewertet ist.
      const hideMs = (cfg().lookahead || 0) * beatMs();
      for (const g of groups.values()) {
        const x = xFor(g.dueAt, t);
        const rests = g.notes.filter(n => n.isRest), pitched = g.notes.filter(n => !n.isRest);
        for (const r of rests) N.drawRest(L, g.si, r.dur, x, N.COL.muted);
        if (!pitched.length) continue;
        if (hideMs && pitched.every(n => n.state === "pending") && g.dueAt - t < hideMs) continue;
        const anyMiss = pitched.find(n => n.state === "miss"), allHit = pitched.every(n => n.state === "hit");
        const colour = pitched.length === 1 ? colourOf(pitched[0]) : anyMiss ? N.COL.miss : allHit ? N.COL.ok : pitched.some(n => n.state === "played") ? N.COL.played : N.COL.ink;
        N.drawChord(L, g.si, pitched, x, { colour, label: labelsOn() ? pitched.map(n => n.label || labelFor(n.midi)).join(" ") : null, finger: pitched.length === 1 ? pitched[0].finger : null });
        if (cfg().ghost) for (const n of pitched) if (n.state === "miss" && n.playedMidi > 0 && !S.anyPitch) N.drawGhost(L, g.si, n.playedMidi, x, S.preferFlat);
      }
      N.unclip();
      N.drawNowLine(L);
    }
    drawParticles(t);
  }

  /* --- Effekte ------------------------------------------------------------ */
  function burst(midi, si) {
    const L = S.L; if (!L) return;
    const s = MU.spell(midi, S.preferFlat);
    const x = STATIC.includes(S.mode) ? L.contentLeft + (L.right - L.contentLeft) * 0.42 + L.GAP * 0.6 : L.nowX;
    const y = N.yFor(L, si || 0, s.diatonic);
    const colours = ["#22c55e", "#facc15", "#38bdf8", "#f472b6", "#a78bfa"];
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, v = (0.6 + Math.random() * 1.6) * L.GAP * 0.09;
      S.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - L.GAP * 0.04, r: L.GAP * (0.08 + Math.random() * 0.12), born: now(), life: 500 + Math.random() * 300, c: colours[i % colours.length] });
    }
    if (!S.running || STATIC.includes(S.mode)) animateParticles();
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
  let particleLoop = false;
  function animateParticles() {
    if (particleLoop) return;
    particleLoop = true;
    const step = () => { if (S.running && !STATIC.includes(S.mode)) { particleLoop = false; return; } draw(); if (S.particles.length) requestAnimationFrame(step); else particleLoop = false; };
    requestAnimationFrame(step);
  }

  /* --- Steuerung ----------------------------------------------------------- */
  function resetCounters() { S.streak = 0; S.multiplier = 1; S.hits = 0; S.misses = 0; S.xpGained = 0; S.strays = 0; S.bestStreak = 0; S.iois = []; S.vels = []; S.particles = []; }

  // opts: { override, pieces, piece, hand, pool, only, level, title }
  function start(mode, opts) {
    opts = opts || {};
    stop(true);
    S.mode = mode; S.cfg = Object.assign({}, settings, opts.override || {});
    S.piece = opts.piece || null; S.pieces = opts.pieces || []; S.hand = opts.hand || S.cfg.hand || "r";
    S.pool = opts.pool && opts.pool.length ? opts.pool.slice() : null; S.level = opts.level || null;
    S.session = NT.store.newId(); S.startedAt = Date.now(); S.sessionRow = null; S.aborted = false;
    resetCounters();
    S.lane = []; S.bars = []; S.lastBeat = 0; S.planned = 0; S.spawnedAll = false; S.target = null; S.ghost = null; S.flash = null; S.hint = null;
    S.anyPitch = mode === "rhythm";
    S.limit = STATIC.includes(mode) ? (S.cfg.singleCount || 0) : 0;
    const c = S.cfg;
    S.beatsPerBar = mode === "rhythm" ? 4 : (mode === "play" || mode === "piece") && S.piece ? S.piece.time.beats : mode === "phrase" && S.pieces.length ? S.pieces[0].time.beats : 4;
    S.spec = null; relayout();
    if (STATIC.includes(mode)) { S.running = true; nextTarget(); hooks.hud(hudState()); return; }
    if (mode === "run") { S.source = randomSource(c.runLength || 24, S.pool || candidates()); S.total = c.runLength || 24; }
    else if (mode === "interval") { S.source = intervalSource(c.runLength || 24, S.pool || candidates(), c.intervalMax || 5); S.total = c.runLength || 24; }
    else if (mode === "rhythm") { S.source = rhythmSource(c.rhythmBars || 8, c.rhythmDurations || RHYTHM_SETS[c.rhythmSet] || RHYTHM_SETS[3], !!c.rhythmRests, S.beatsPerBar, c.clef === "bass" ? 50 : 71); S.total = S.source.length; }
    else if (mode === "scale") { S.source = scaleSource(c.scaleRoot + (c.clef === "bass" ? 48 : 60), c.scaleType, c.scaleOctaves); S.total = S.source.length; }
    else if (mode === "phrase") { S.source = phraseSource(S.pieces, S.hand, c.phrases || 6, opts.only || null); S.total = 0; }
    else if (mode === "play" || mode === "piece") { S.source = pieceSource(S.piece, S.hand); S.total = mode === "piece" ? NT.musicxml.notesFor(S.piece, S.hand).length : 0; }
    // Vorlauf in Schlägen, aber so gewählt, dass Achtel nicht zusammenkleben.
    S.leadBeats = 4;
    // Lauf und Tonleiter: Viertel brauchen Platz fuer Kopf, Vorzeichen und Luft
    // (3,4 Abstaende). Auf schmalen Buehnen also weniger Schlaege Vorlauf,
    // sonst klebt ein Kreuz am Kopf der Note davor.
    // Ohne Buehnenmasse (Ansicht noch verdeckt) bleibt es bei vier Schlaegen.
    const L = S.L;
    if (L && (mode === "run" || mode === "interval" || mode === "scale")) {
      S.leadBeats = Math.max(2, Math.min(4, (L.right - L.nowX) / (3.4 * L.GAP)));
    }
    if (L && (usesPieces() || mode === "rhythm")) {
      const minGap = 0.5;
      const maxLead = ((L.right - L.nowX) * minGap) / (1.9 * N.M.headW * L.GAP);
      S.leadBeats = Math.max(2, Math.min(4, maxLead));
    }
    // Einzähler: ein Takt Klicks, die erste Note kommt auf die folgende Eins.
    S.countIn = c.countIn !== false ? S.beatsPerBar : 0;
    S.nextClick = -S.countIn; S.countShown = null;
    S.t0 = now() + Math.max(S.leadBeats, S.countIn) * beatMs();
    S.running = true;
    hooks.hud(hudState());
    tick();
  }
  function tick() {
    if (!S.running) return;
    const t = now();
    scheduleClicks(t); showCount(t);
    spawn(t); expire(t);
    if (!S.running) return;
    draw();
    S.rafId = requestAnimationFrame(tick);
  }
  function sessionRow() {
    return { id: S.session, startedAt: S.startedAt, endedAt: Date.now(), mode: S.mode, hits: S.hits, misses: S.misses, xp: S.xpGained, bestStreak: S.bestStreak, bpm: cfg().bpm, level: S.level ? S.level.id : undefined };
  }
  function finish() {
    if (!S.running) return;
    S.running = false; cancelAnimationFrame(S.rafId); clearTimeout(S.replayTimer); clearTimeout(S.nextTimer); S.nextTimer = 0;
    hooks.count(null);
    if (S.mode !== "play") { S.sessionRow = sessionRow(); NT.store.put("sessions", S.sessionRow); }
    hooks.finish(results());
  }
  function stop(silent) {
    if (!S.running) return;
    S.running = false; cancelAnimationFrame(S.rafId); clearTimeout(S.ghostTimer); clearTimeout(S.replayTimer); clearTimeout(S.nextTimer); S.nextTimer = 0;
    hooks.count(null);
    S.aborted = true;
    if (S.mode === "play") { if (!silent) hooks.finish(results()); return; }
    if (!silent && (S.hits + S.misses) > 0) {
      S.sessionRow = sessionRow(); NT.store.put("sessions", S.sessionRow);
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
    const weakest = S.anyPitch ? [] : Array.from(byNote.entries()).filter(([, v]) => v.bad).sort((a, b) => (b[1].bad / b[1].n) - (a[1].bad / a[1].n)).slice(0, 5).map(([midi, v]) => ({ midi, ...v }));
    const missed = S.anyPitch ? [] : Array.from(new Set(mine.filter(e => !e.correct).map(e => e.midi)));
    const badMeasures = Array.from(new Set(mine.filter(e => !e.correct && e.piece != null && e.measure != null).map(e => e.piece + ":" + e.measure)));
    return { mode: S.mode, hits: S.hits, misses: S.misses, accuracy: accuracy(), xp: S.xpGained, bestStreak: S.bestStreak, avgOff, avgReact, evenness, weakest,
             missed, badMeasures, total: S.total || S.limit || 0, level: S.level, bpm: cfg().bpm, timed: TIMED.includes(S.mode) && S.mode !== "play",
             sessionRow: S.sessionRow, aborted: S.aborted, playback: S.mode === "play" };
  }

  // Eingang vom MIDI-Modul
  function onNoteOn(midi, velocity) {
    if (!S.running) return;
    if (STATIC.includes(S.mode)) judgeSingle(midi, velocity);
    else if (S.mode !== "play") judgeRun(midi, velocity, now());
  }

  return { S, history, hooks, start, stop, draw, relayout, buildSpec, onNoteOn, replay, candidates, candidatesFor, results, RHYTHM_SETS, TIMED, STATIC,
           set settings(v) { settings = v; }, get settings() { return settings; }, WINDOW,
           set canvas(c) { canvas = c; }, get canvas() { return canvas; },
           get running() { return S.running; }, get mode() { return S.mode; }, get cfg() { return cfg(); } };
})();
